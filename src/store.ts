import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './config.js';

export type MessageStatus = 'pending' | 'done' | 'error' | 'stopped';

export interface RepoRef {
  owner: string;
  name: string;
  branch: string;
  htmlUrl: string;
  pagesUrl: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'agent';
  createdAt: number;
  content?: string; // texto do usuario, ou resumo final do agente
  logs?: string[]; // linhas de progresso (apenas role 'agent')
  status?: MessageStatus; // apenas role 'agent'
  pagesUrl?: string;
}

export interface Conversation {
  id: string;
  title: string;
  repo: RepoRef;
  createdAt: number;
  updatedAt: number;
  messages: AgentMessage[];
}

const DATA_DIR = path.resolve('data');
const DATA_FILE = path.join(DATA_DIR, 'conversations.json');

/**
 * Conversas gravadas antes do suporte a multiplos repositorios nao tem o campo
 * `repo`. Em vez de descartar esse historico, elas sao migradas para apontar
 * para o repositorio unico que existia na epoca (GITHUB_REPO no .env, se
 * configurado — senao um repo "desconhecido" so para nao quebrar a UI).
 */
function migrateLegacyRepo(conversation: any): Conversation {
  if (conversation.repo) return conversation;

  const [owner, name] = (config.defaultRepo || '').split('/');
  const repo: RepoRef = owner && name
    ? {
        owner,
        name,
        branch: config.defaultBranch,
        htmlUrl: `https://github.com/${owner}/${name}`,
        pagesUrl: `https://${owner.toLowerCase()}.github.io/${name}/`,
      }
    : {
        owner: 'desconhecido',
        name: 'repositorio-legado',
        branch: 'main',
        htmlUrl: '#',
        pagesUrl: '#',
      };

  return { ...conversation, repo };
}

/**
 * Nenhum job sobrevive a um restart do processo (o servidor acabou de subir,
 * entao nada pode estar rodando de verdade agora). Mensagens que ficaram
 * marcadas como "pending" de uma execucao anterior interrompida abruptamente
 * (crash, restart do tsx watch, etc.) ficariam com o spinner girando pra
 * sempre — aqui elas sao fechadas como "stopped" na carga inicial.
 */
function reconcileOrphanedPending(conversation: Conversation): Conversation {
  let changed = false;
  const messages = conversation.messages.map((m) => {
    if (m.role === 'agent' && m.status === 'pending') {
      changed = true;
      return { ...m, status: 'stopped' as const, content: 'Interrompido (o servidor foi reiniciado enquanto isso rodava).' };
    }
    return m;
  });
  return changed ? { ...conversation, messages } : conversation;
}

function load(): Conversation[] {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    const migrated = (raw as any[]).map(migrateLegacyRepo).map(reconcileOrphanedPending);
    persist(migrated);
    return migrated;
  } catch {
    return [];
  }
}

function persist(conversations: Conversation[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(conversations, null, 2), 'utf-8');
}

let conversations = load();

function save() {
  persist(conversations);
}

export function listConversations(): Pick<Conversation, 'id' | 'title' | 'repo' | 'createdAt' | 'updatedAt'>[] {
  return conversations
    .map(({ id, title, repo, createdAt, updatedAt }) => ({ id, title, repo, createdAt, updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getConversation(id: string): Conversation | undefined {
  return conversations.find((c) => c.id === id);
}

export function createConversation(title: string, repo: RepoRef): Conversation {
  const now = Date.now();
  const conversation: Conversation = {
    id: crypto.randomUUID(),
    title: title.slice(0, 80) || repo.name,
    repo,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  conversations.push(conversation);
  save();
  return conversation;
}

export function renameConversation(id: string, title: string): Conversation | undefined {
  const conversation = getConversation(id);
  if (!conversation) return undefined;
  conversation.title = title.slice(0, 80) || conversation.title;
  conversation.updatedAt = Date.now();
  save();
  return conversation;
}

export function deleteConversation(id: string): boolean {
  const before = conversations.length;
  conversations = conversations.filter((c) => c.id !== id);
  save();
  return conversations.length < before;
}

export function addUserMessage(conversationId: string, content: string): AgentMessage | undefined {
  const conversation = getConversation(conversationId);
  if (!conversation) return undefined;

  const message: AgentMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    createdAt: Date.now(),
    content,
  };
  conversation.messages.push(message);
  conversation.updatedAt = Date.now();
  save();
  return message;
}

export function addPendingAgentMessage(conversationId: string): AgentMessage | undefined {
  const conversation = getConversation(conversationId);
  if (!conversation) return undefined;

  const message: AgentMessage = {
    id: crypto.randomUUID(),
    role: 'agent',
    createdAt: Date.now(),
    logs: [],
    status: 'pending',
  };
  conversation.messages.push(message);
  conversation.updatedAt = Date.now();
  save();
  return message;
}

export function appendLog(conversationId: string, messageId: string, line: string) {
  const conversation = getConversation(conversationId);
  const message = conversation?.messages.find((m) => m.id === messageId);
  if (!message) return;
  message.logs = message.logs || [];
  message.logs.push(line);
  save();
}

export function finishAgentMessage(
  conversationId: string,
  messageId: string,
  update: { status: MessageStatus; content?: string; pagesUrl?: string }
) {
  const conversation = getConversation(conversationId);
  const message = conversation?.messages.find((m) => m.id === messageId);
  if (!message || !conversation) return;
  message.status = update.status;
  message.content = update.content;
  message.pagesUrl = update.pagesUrl;
  conversation.updatedAt = Date.now();
  save();
}

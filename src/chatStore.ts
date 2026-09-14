import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DEFAULT_CHAT_MODEL } from './groqChat.js';

export interface ChatSource {
  title: string;
  url: string;
}

export interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  sources?: ChatSource[];
}

export interface Chat {
  id: string;
  title: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  turns: ChatTurn[];
}

const DATA_DIR = path.resolve('data');
const DATA_FILE = path.join(DATA_DIR, 'chats.json');

function load(): Chat[] {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function persist(chats: Chat[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(chats, null, 2), 'utf-8');
}

let chats = load();

function save() {
  persist(chats);
}

export function listChats(): Pick<Chat, 'id' | 'title' | 'model' | 'createdAt' | 'updatedAt'>[] {
  return chats
    .map(({ id, title, model, createdAt, updatedAt }) => ({ id, title, model, createdAt, updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getChat(id: string): Chat | undefined {
  return chats.find((c) => c.id === id);
}

export function createChat(model?: string): Chat {
  const now = Date.now();
  const chat: Chat = {
    id: crypto.randomUUID(),
    title: 'Nova conversa',
    model: model || DEFAULT_CHAT_MODEL,
    createdAt: now,
    updatedAt: now,
    turns: [],
  };
  chats.push(chat);
  save();
  return chat;
}

export function renameChat(id: string, title: string): Chat | undefined {
  const chat = getChat(id);
  if (!chat) return undefined;
  chat.title = title.slice(0, 80) || chat.title;
  chat.updatedAt = Date.now();
  save();
  return chat;
}

export function setChatModel(id: string, model: string): Chat | undefined {
  const chat = getChat(id);
  if (!chat) return undefined;
  chat.model = model;
  chat.updatedAt = Date.now();
  save();
  return chat;
}

export function deleteChat(id: string): boolean {
  const before = chats.length;
  chats = chats.filter((c) => c.id !== id);
  save();
  return chats.length < before;
}

export function addTurn(
  chatId: string,
  role: ChatTurn['role'],
  content: string,
  sources?: ChatSource[]
): ChatTurn | undefined {
  const chat = getChat(chatId);
  if (!chat) return undefined;

  const turn: ChatTurn = { id: crypto.randomUUID(), role, content, createdAt: Date.now(), sources };
  chat.turns.push(turn);

  if (role === 'user' && chat.title === 'Nova conversa') {
    chat.title = content.slice(0, 60);
  }
  chat.updatedAt = Date.now();
  save();
  return turn;
}

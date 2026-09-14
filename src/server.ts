import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { generateSite } from './generateSite.js';
import { createRepo, getOwner, slugifyRepoName } from './githubApi.js';
import * as store from './store.js';
import * as chatStore from './chatStore.js';
import { listChatModels, DEFAULT_CHAT_MODEL } from './groqChat.js';
import { runChatTurn } from './chatAgent.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIST = path.join(__dirname, '..', 'web', 'dist');
const PORT = Number(process.env.PORT || 3000);

type Client = { res: http.ServerResponse };

const clients = new Set<Client>();
let busy = false;
let currentJob: { conversationId: string; controller: AbortController } | null = null;

function sse(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) client.res.write(payload);
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

async function readBody(req: http.IncomingMessage): Promise<any> {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** Serve o site gerado localmente (dentro do clone em WORK_DIR), sem depender do deploy do GitHub Pages. */
function servePreview(res: http.ServerResponse, conversationId: string, restParts: string[]) {
  const conversation = store.getConversation(conversationId);
  if (!conversation) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Projeto nao encontrado.');
    return;
  }

  const siteDir = path.resolve(config.workDir, conversation.repo.name, 'site');
  const rel = restParts.join('/') || 'index.html';
  let resolved = path.resolve(siteDir, rel);

  if (!resolved.startsWith(siteDir)) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
    resolved = path.join(siteDir, 'index.html');
  }
  if (!fs.existsSync(resolved)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('O site ainda nao foi gerado — rode uma mensagem primeiro.');
    return;
  }

  const ext = path.extname(resolved);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(resolved).pipe(res);
}

function serveStatic(res: http.ServerResponse, pathname: string) {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  let resolved = path.resolve(WEB_DIST, rel);

  if (!resolved.startsWith(WEB_DIST) || !fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
    // SPA fallback — rotas do lado do cliente caem no index.html
    resolved = path.join(WEB_DIST, 'index.html');
    if (!fs.existsSync(resolved)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Frontend nao encontrado. Rode: npm run build:web');
      return;
    }
  }

  const ext = path.extname(resolved);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(resolved).pipe(res);
}

async function runConversationTurn(conversationId: string, prompt: string) {
  const conversation = store.getConversation(conversationId);
  if (!conversation) {
    busy = false;
    return;
  }

  store.addUserMessage(conversationId, prompt);
  sse('message', { conversationId, type: 'user', content: prompt });

  const agentMessage = store.addPendingAgentMessage(conversationId);
  if (!agentMessage) {
    busy = false;
    return;
  }
  sse('message', { conversationId, type: 'agent-start', messageId: agentMessage.id });

  const onLog = (line: string) => {
    console.log(line);
    store.appendLog(conversationId, agentMessage.id, line);
    sse('log', { conversationId, messageId: agentMessage.id, line });
  };

  const workDir = path.resolve(config.workDir, conversation.repo.name);
  const controller = new AbortController();
  currentJob = { conversationId, controller };

  try {
    const summary = await generateSite(prompt, conversation.repo, workDir, onLog, controller.signal);
    const pagesUrl = conversation.repo.pagesUrl;
    store.finishAgentMessage(conversationId, agentMessage.id, { status: 'done', content: summary, pagesUrl });
    sse('done', { conversationId, messageId: agentMessage.id, content: summary, pagesUrl });
  } catch (err) {
    if (controller.signal.aborted) {
      const message = 'Interrompido por você.';
      store.finishAgentMessage(conversationId, agentMessage.id, { status: 'stopped', content: message });
      sse('stopped', { conversationId, messageId: agentMessage.id, content: message });
    } else {
      const message = err instanceof Error ? err.message : String(err);
      store.finishAgentMessage(conversationId, agentMessage.id, { status: 'error', content: message });
      sse('error', { conversationId, messageId: agentMessage.id, content: message });
    }
  } finally {
    busy = false;
    if (currentJob?.conversationId === conversationId) currentJob = null;
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const parts = url.pathname.split('/').filter(Boolean); // ex: ['api','conversations',':id','messages']

  try {
    if (req.method === 'GET' && url.pathname === '/api/status') {
      let owner: string | null = null;
      try {
        owner = await getOwner();
      } catch {
        // token invalido ou sem rede — segue sem o owner, o erro real aparece ao criar um projeto
      }
      sendJson(res, 200, {
        busy,
        agentName: 'Lumen AI',
        model: config.hfModel,
        authorName: config.gitAuthorName,
        githubOwner: owner,
        groqChatAvailable: !!config.groqApiKey,
        webSearchAvailable: !!config.tavilyApiKey,
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/slug') {
      const name = url.searchParams.get('name') || '';
      sendJson(res, 200, { slug: slugifyRepoName(name) });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write(': conectado\n\n');
      const client: Client = { res };
      clients.add(client);
      req.on('close', () => clients.delete(client));
      return;
    }

    // GET/POST /api/conversations
    if (parts[0] === 'api' && parts[1] === 'conversations' && parts.length === 2) {
      if (req.method === 'GET') {
        sendJson(res, 200, store.listConversations());
        return;
      }
      if (req.method === 'POST') {
        const body = await readBody(req);
        const projectName = String(body.projectName || '').trim();
        if (!projectName) {
          sendJson(res, 400, { error: 'Informe um nome para o projeto.' });
          return;
        }

        const slug = slugifyRepoName(projectName);

        let createdRepo;
        try {
          createdRepo = await createRepo(slug);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          sendJson(res, 409, { error: message });
          return;
        }

        const conversation = store.createConversation(projectName, {
          owner: createdRepo.owner,
          name: createdRepo.name,
          branch: createdRepo.branch,
          htmlUrl: createdRepo.htmlUrl,
          pagesUrl: createdRepo.pagesUrl,
        });
        sendJson(res, 201, conversation);
        return;
      }
    }

    // GET/PATCH/DELETE /api/conversations/:id
    if (parts[0] === 'api' && parts[1] === 'conversations' && parts.length === 3) {
      const id = parts[2];

      if (req.method === 'GET') {
        const conversation = store.getConversation(id);
        if (!conversation) {
          sendJson(res, 404, { error: 'Conversa nao encontrada.' });
          return;
        }
        sendJson(res, 200, conversation);
        return;
      }

      if (req.method === 'PATCH') {
        const body = await readBody(req);
        const conversation = store.renameConversation(id, String(body.title || ''));
        if (!conversation) {
          sendJson(res, 404, { error: 'Conversa nao encontrada.' });
          return;
        }
        sendJson(res, 200, conversation);
        return;
      }

      if (req.method === 'DELETE') {
        const ok = store.deleteConversation(id);
        sendJson(res, ok ? 200 : 404, ok ? { ok: true } : { error: 'Conversa nao encontrada.' });
        return;
      }
    }

    // POST /api/conversations/:id/messages
    if (parts[0] === 'api' && parts[1] === 'conversations' && parts[3] === 'messages' && req.method === 'POST') {
      const id = parts[2];
      const conversation = store.getConversation(id);
      if (!conversation) {
        sendJson(res, 404, { error: 'Conversa nao encontrada.' });
        return;
      }

      if (busy) {
        sendJson(res, 409, { error: 'A Lumen AI ja esta trabalhando em outra solicitacao. Aguarde terminar.' });
        return;
      }

      const body = await readBody(req);
      const prompt = String(body.prompt || '').trim();
      if (!prompt) {
        sendJson(res, 400, { error: 'Envie uma mensagem descrevendo o que voce quer no site.' });
        return;
      }

      busy = true;
      sendJson(res, 202, { ok: true });
      runConversationTurn(id, prompt);
      return;
    }

    // POST /api/conversations/:id/stop — interrompe a geracao em andamento dessa conversa
    if (parts[0] === 'api' && parts[1] === 'conversations' && parts[3] === 'stop' && req.method === 'POST') {
      const id = parts[2];
      if (currentJob?.conversationId !== id) {
        sendJson(res, 409, { error: 'Nao ha nada rodando para essa conversa agora.' });
        return;
      }
      currentJob.controller.abort();
      sendJson(res, 200, { ok: true });
      return;
    }

    // GET /api/groq-models — modelos de texto da Groq disponiveis para o modo de chat geral
    if (req.method === 'GET' && url.pathname === '/api/groq-models') {
      if (!config.groqApiKey) {
        sendJson(res, 200, { models: [], defaultModel: DEFAULT_CHAT_MODEL });
        return;
      }
      try {
        const models = await listChatModels();
        sendJson(res, 200, { models, defaultModel: DEFAULT_CHAT_MODEL });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        sendJson(res, 502, { error: message });
      }
      return;
    }

    // GET/POST /api/chats — modo de chat geral (sem ferramentas, sem GitHub)
    if (parts[0] === 'api' && parts[1] === 'chats' && parts.length === 2) {
      if (req.method === 'GET') {
        sendJson(res, 200, chatStore.listChats());
        return;
      }
      if (req.method === 'POST') {
        if (!config.groqApiKey) {
          sendJson(res, 400, { error: 'Configure GROQ_API_KEY no .env para usar o modo de chat.' });
          return;
        }
        const body = await readBody(req);
        const chat = chatStore.createChat(body.model);
        sendJson(res, 201, chat);
        return;
      }
    }

    // GET/PATCH/DELETE /api/chats/:id
    if (parts[0] === 'api' && parts[1] === 'chats' && parts.length === 3) {
      const id = parts[2];

      if (req.method === 'GET') {
        const chat = chatStore.getChat(id);
        if (!chat) {
          sendJson(res, 404, { error: 'Conversa nao encontrada.' });
          return;
        }
        sendJson(res, 200, chat);
        return;
      }

      if (req.method === 'PATCH') {
        const body = await readBody(req);
        let chat = body.title !== undefined ? chatStore.renameChat(id, String(body.title)) : chatStore.getChat(id);
        if (body.model !== undefined) chat = chatStore.setChatModel(id, String(body.model));
        if (!chat) {
          sendJson(res, 404, { error: 'Conversa nao encontrada.' });
          return;
        }
        sendJson(res, 200, chat);
        return;
      }

      if (req.method === 'DELETE') {
        const ok = chatStore.deleteChat(id);
        sendJson(res, ok ? 200 : 404, ok ? { ok: true } : { error: 'Conversa nao encontrada.' });
        return;
      }
    }

    // POST /api/chats/:id/messages — manda uma mensagem e ja retorna a resposta do modelo
    if (parts[0] === 'api' && parts[1] === 'chats' && parts[3] === 'messages' && req.method === 'POST') {
      const id = parts[2];
      const chat = chatStore.getChat(id);
      if (!chat) {
        sendJson(res, 404, { error: 'Conversa nao encontrada.' });
        return;
      }
      if (!config.groqApiKey) {
        sendJson(res, 400, { error: 'Configure GROQ_API_KEY no .env para usar o modo de chat.' });
        return;
      }

      const body = await readBody(req);
      const content = String(body.content || '').trim();
      if (!content) {
        sendJson(res, 400, { error: 'Mensagem vazia.' });
        return;
      }

      chatStore.addTurn(id, 'user', content);

      try {
        const updatedChat = chatStore.getChat(id)!;
        const { content: reply, sources } = await runChatTurn(updatedChat);
        const turn = chatStore.addTurn(id, 'assistant', reply, sources.length > 0 ? sources : undefined);
        sendJson(res, 200, { turn, chat: chatStore.getChat(id) });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        sendJson(res, 502, { error: message });
      }
      return;
    }

    // GET /api/conversations/:id/preview/* — serve o site gerado localmente
    if (parts[0] === 'api' && parts[1] === 'conversations' && parts[3] === 'preview' && req.method === 'GET') {
      servePreview(res, parts[2], parts.slice(4));
      return;
    }

    if (req.method === 'GET') {
      serveStatic(res, url.pathname);
      return;
    }

    res.writeHead(404);
    res.end();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendJson(res, 500, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(`Lumen AI disponivel em http://localhost:${PORT}`);
});

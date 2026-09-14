import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { config } from './config.js';
import { groqChat } from './groqChat.js';
import { webSearch } from './webSearch.js';
import type { Chat, ChatSource } from './chatStore.js';

const SYSTEM_PROMPT =
  'Voce e a Lumen AI em modo de conversa geral: responda de forma clara e util sobre qualquer assunto ' +
  '(duvidas, estudos, escrita, etc). Responda em portugues do Brasil, a menos que o usuario escreva em outro idioma. ' +
  'Quando a pergunta envolver fatos que podem ter mudado, ser especificos ou atuais (empresas, pessoas, precos, ' +
  'noticias, eventos recentes), use a ferramenta web_search em vez de responder so de memoria — voce pode nao ' +
  'saber ou estar desatualizado sobre esses temas. Nunca invente informacao que pareça factual sem ter certeza.';

const SEARCH_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'web_search',
    description:
      'Pesquisa na internet informacoes atuais ou especificas (empresas, pessoas, precos, noticias, eventos). ' +
      'Use sempre que nao tiver certeza absoluta sobre o fato perguntado.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Os termos de busca.' },
      },
      required: ['query'],
    },
  },
};

const MAX_TOOL_ROUNDS = 4;

// Modelos "compound" da Groq ja tem busca embutida e nao aceitam ferramentas customizadas.
function supportsCustomTools(model: string): boolean {
  return !model.startsWith('groq/compound');
}

export interface ChatTurnResult {
  content: string;
  sources: ChatSource[];
}

export async function runChatTurn(chat: Chat): Promise<ChatTurnResult> {
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...chat.turns.map((t): ChatCompletionMessageParam => ({ role: t.role, content: t.content })),
  ];

  const canSearch = !!config.tavilyApiKey && supportsCustomTools(chat.model);
  const tools = canSearch ? [SEARCH_TOOL] : undefined;
  const sources: ChatSource[] = [];
  const seenUrls = new Set<string>();

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await groqChat.chat.completions.create({
      model: chat.model,
      messages,
      tools,
      tool_choice: tools ? 'auto' : undefined,
      max_tokens: 1500,
    });

    const message = response.choices[0].message;
    messages.push(message as ChatCompletionMessageParam);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return { content: message.content || '(resposta vazia)', sources };
    }

    for (const call of message.tool_calls) {
      let result: string;
      try {
        const args = JSON.parse(call.function.arguments || '{}');
        const results = await webSearch(args.query);
        for (const r of results) {
          if (!seenUrls.has(r.url)) {
            seenUrls.add(r.url);
            sources.push({ title: r.title, url: r.url });
          }
        }
        result = JSON.stringify(results);
      } catch (err) {
        result = `Erro na busca: ${err instanceof Error ? err.message : String(err)}`;
      }

      messages.push({ role: 'tool', tool_call_id: call.id, content: result });
    }
  }

  return { content: 'Não consegui concluir a busca a tempo — tente reformular a pergunta.', sources };
}

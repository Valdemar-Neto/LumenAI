import OpenAI from 'openai';
import { config } from './config.js';

export const DEFAULT_CHAT_MODEL = 'openai/gpt-oss-120b';

/**
 * Cliente dedicado ao modo de chat geral — sempre fala direto com a Groq
 * (independente do INFERENCE_PROVIDER usado pelo construtor de sites), pois o
 * usuario pediu especificamente para escolher entre modelos da Groq aqui.
 */
export const groqChat = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: config.groqApiKey || 'sem-chave-configurada',
});

export interface GroqModelInfo {
  id: string;
  name: string;
  contextWindow: number;
}

let modelsCache: { at: number; models: GroqModelInfo[] } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Lista os modelos da Groq que servem para chat de texto (exclui audio/TTS e classificadores). */
export async function listChatModels(): Promise<GroqModelInfo[]> {
  if (modelsCache && Date.now() - modelsCache.at < CACHE_TTL_MS) return modelsCache.models;

  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${config.groqApiKey}` },
  });
  if (!res.ok) {
    throw new Error(`Nao foi possivel listar os modelos da Groq (${res.status}). Confira o GROQ_API_KEY no .env.`);
  }

  const data = (await res.json()) as {
    data: { id: string; name?: string; context_window?: number; output_modalities?: string[] }[];
  };

  const models = data.data
    .filter((m) => m.output_modalities?.includes('text') && !m.id.includes('prompt-guard'))
    .map((m) => ({ id: m.id, name: m.name || m.id, contextWindow: m.context_window || 0 }))
    .sort((a, b) => a.id.localeCompare(b.id));

  modelsCache = { at: Date.now(), models };
  return models;
}

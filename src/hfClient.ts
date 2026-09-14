import OpenAI from 'openai';
import { config } from './config.js';

// Ambos expoem uma API compativel com a da OpenAI (incluindo tool/function calling):
// - 'huggingface': router.huggingface.co (Inference Providers), usa a cota de creditos da HF.
// - 'groq': api.groq.com direto, usa a cota/plano da propria conta Groq.
const isGroq = config.inferenceProvider === 'groq';

export const hf = new OpenAI({
  baseURL: isGroq ? 'https://api.groq.com/openai/v1' : 'https://router.huggingface.co/v1',
  apiKey: isGroq ? config.groqApiKey : config.hfToken,
});

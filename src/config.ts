import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variavel de ambiente obrigatoria ausente: ${name}. Confira seu arquivo .env (veja .env.example).`
    );
  }
  return value;
}

const inferenceProvider = (process.env.INFERENCE_PROVIDER || 'huggingface').toLowerCase();

function requiredForProvider(provider: string, name: string): string {
  if (inferenceProvider !== provider) return process.env[name] || '';
  return required(name);
}

export const config = {
  // 'huggingface' (via router.huggingface.co, usa a cota de creditos da HF) ou
  // 'groq' (direto na API da Groq, com o plano/cota da propria Groq).
  inferenceProvider,

  hfToken: requiredForProvider('huggingface', 'HF_TOKEN'),
  groqApiKey: requiredForProvider('groq', 'GROQ_API_KEY'),

  // Opcional: habilita a ferramenta de busca na web no modo de chat geral.
  // Sem isso, o chat responde so com o conhecimento do proprio modelo (pode alucinar
  // sobre fatos especificos/atuais). Cadastro gratis, sem cartao: https://tavily.com
  tavilyApiKey: process.env.TAVILY_API_KEY || '',

  hfModel:
    process.env.HF_MODEL ||
    (inferenceProvider === 'groq' ? 'openai/gpt-oss-120b' : 'Qwen/Qwen3-Coder-480B-A35B-Instruct:novita'),

  githubToken: required('GITHUB_TOKEN'),
  // Dono das novas contas/repos criados pela Lumen AI. Se vazio, e detectado
  // automaticamente a partir do token (GET /user) na primeira chamada.
  githubOwner: process.env.GITHUB_OWNER || '',

  // Usados apenas pelo CLI (`npm run generate`), que continua operando sobre um
  // unico repositorio fixo por conveniencia. A interface web cria um repositorio
  // novo por projeto/conversa via API do GitHub, sem depender destas variaveis.
  defaultRepo: process.env.GITHUB_REPO || '', // formato: usuario/repositorio
  defaultBranch: process.env.GITHUB_BRANCH || 'main',

  gitAuthorName: process.env.GIT_AUTHOR_NAME || 'HF Site Agent',
  gitAuthorEmail: process.env.GIT_AUTHOR_EMAIL || 'agent@example.com',

  workDir: process.env.WORK_DIR || '.workdir',
  maxSteps: Number(process.env.MAX_STEPS || 25),
};

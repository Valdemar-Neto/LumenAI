import path from 'node:path';
import { generateSite } from './generateSite.js';
import { config } from './config.js';

const prompt = process.argv.slice(2).join(' ').trim();

if (!prompt) {
  console.error('Uso: npm run generate -- "descricao do site que voce quer criar"');
  console.error('Exemplo: npm run generate -- "landing page para uma cafeteria, tom acolhedor, cores terrosas"');
  process.exit(1);
}

if (!config.defaultRepo) {
  console.error(
    'GITHUB_REPO nao esta definido no .env. O CLI so sabe trabalhar num repositorio fixo (uso rapido/legado).'
  );
  console.error(
    'Para criar varios sites em repositorios separados, use a interface web: npm run dev (ou npm run build:web && npm run serve).'
  );
  process.exit(1);
}

const [owner, name] = config.defaultRepo.split('/');
if (!owner || !name) {
  console.error('GITHUB_REPO invalido no .env — use o formato usuario/repositorio.');
  process.exit(1);
}

const workDir = path.resolve(config.workDir, name);

generateSite(prompt, { owner, name, branch: config.defaultBranch }, workDir)
  .then((summary) => {
    console.log('\nResumo do agente:\n' + summary);
  })
  .catch((err) => {
    console.error('Erro ao gerar o site:', err);
    process.exit(1);
  });

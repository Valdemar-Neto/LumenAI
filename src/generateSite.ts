import path from 'node:path';
import fs from 'node:fs';
import { config } from './config.js';
import { ensureRepoCloned, commitAndPush, type RepoTarget } from './githubRepo.js';
import { runAgent } from './agentLoop.js';

function pagesWorkflow(branch: string) {
  return `name: Deploy site no GitHub Pages

on:
  push:
    branches: ["${branch}"]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: 'site'
      - id: deployment
        uses: actions/deploy-pages@v4
`;
}

export type Logger = (message: string) => void;

export async function generateSite(
  prompt: string,
  repo: RepoTarget,
  workDir: string,
  onLog: Logger = console.log,
  signal?: AbortSignal
): Promise<string> {
  onLog(`Clonando/atualizando ${repo.owner}/${repo.name} (branch ${repo.branch})...`);
  await ensureRepoCloned(workDir, repo, onLog);

  const siteDir = path.join(workDir, 'site');
  fs.mkdirSync(siteDir, { recursive: true });

  const workflowDir = path.join(workDir, '.github', 'workflows');
  fs.mkdirSync(workflowDir, { recursive: true });
  fs.writeFileSync(path.join(workflowDir, 'deploy-pages.yml'), pagesWorkflow(repo.branch), 'utf-8');

  onLog('Rodando o agente (modelo: ' + config.hfModel + ')...');
  const summary = await runAgent(prompt, siteDir, onLog, signal);

  onLog('Enviando para o GitHub...');
  await commitAndPush(workDir, repo, `agente: ${prompt.slice(0, 72)}`, onLog);

  onLog('Pronto! Se ainda nao fez isso, habilite o GitHub Pages em:');
  onLog(`  https://github.com/${repo.owner}/${repo.name}/settings/pages`);
  onLog('  Em "Build and deployment" -> Source: "GitHub Actions".');

  return summary;
}

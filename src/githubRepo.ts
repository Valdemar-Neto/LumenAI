import fs from 'node:fs';
import { simpleGit } from 'simple-git';
import { config } from './config.js';

type Logger = (message: string) => void;

export interface RepoTarget {
  owner: string;
  name: string;
  branch: string;
}

function authenticatedUrl(repo: RepoTarget): string {
  return `https://x-access-token:${config.githubToken}@github.com/${repo.owner}/${repo.name}.git`;
}

export async function ensureRepoCloned(workDir: string, repo: RepoTarget, onLog: Logger = console.log) {
  const alreadyCloned = fs.existsSync(workDir) && fs.existsSync(`${workDir}/.git`);

  if (!alreadyCloned) {
    fs.mkdirSync(workDir, { recursive: true });
    try {
      await simpleGit().clone(authenticatedUrl(repo), workDir, ['--branch', repo.branch, '--single-branch']);
    } catch (err) {
      // Repositorio recem-criado no GitHub pode ainda nao ter a branch/commit inicial.
      onLog('Nao foi possivel clonar diretamente na branch configurada, tentando clone padrao...');
      await simpleGit().clone(authenticatedUrl(repo), workDir);
    }
    return;
  }

  // Reaponta o remote para o token/repo atual (pode ter sido trocado desde o ultimo clone).
  const git = simpleGit(workDir);
  await git.remote(['set-url', 'origin', authenticatedUrl(repo)]);
  try {
    await git.pull('origin', repo.branch);
  } catch {
    onLog('Pull falhou (a branch pode ainda nao existir remotamente) — seguindo com o estado local.');
  }
}

export async function commitAndPush(
  workDir: string,
  repo: RepoTarget,
  message: string,
  onLog: Logger = console.log
) {
  const git = simpleGit(workDir);
  await git.addConfig('user.name', config.gitAuthorName);
  await git.addConfig('user.email', config.gitAuthorEmail);

  await git.add('.');
  const status = await git.status();

  if (status.staged.length === 0) {
    onLog('Nada para commitar — o site ja esta atualizado.');
    return;
  }

  await git.commit(message);
  await git.remote(['set-url', 'origin', authenticatedUrl(repo)]);
  await git.push(['-u', 'origin', `HEAD:${repo.branch}`]);
}

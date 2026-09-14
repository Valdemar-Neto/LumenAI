import { config } from './config.js';

const API_BASE = 'https://api.github.com';

export interface CreatedRepo {
  owner: string;
  name: string;
  branch: string;
  htmlUrl: string;
  pagesUrl: string;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${config.githubToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

let cachedOwner: string | null = null;

/** Descobre o dono (usuario dono do token) para criar repositorios na conta certa. */
export async function getOwner(): Promise<string> {
  if (config.githubOwner) return config.githubOwner;
  if (cachedOwner) return cachedOwner;

  const res = await fetch(`${API_BASE}/user`, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(
      'Nao foi possivel identificar o dono do token do GitHub (GET /user falhou). Confira se o GITHUB_TOKEN e valido.'
    );
  }
  const data = (await res.json()) as { login: string };
  cachedOwner = data.login;
  return cachedOwner;
}

/** Converte um nome de projeto em algo valido como nome de repositorio no GitHub. */
export function slugifyRepoName(input: string): string {
  const slug = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
  return slug || `site-${Date.now()}`;
}

/**
 * Cria um novo repositorio publico no GitHub (com README inicial, para ja ter
 * uma branch para clonar) e tenta habilitar o GitHub Pages via API. Se a
 * habilitacao via API falhar, o workflow de deploy (actions/configure-pages)
 * ainda consegue habilitar sozinho no primeiro push.
 */
export async function createRepo(name: string): Promise<CreatedRepo> {
  const res = await fetch(`${API_BASE}/user/repos`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      description: 'Site gerado e mantido pela Lumen AI.',
      private: false,
      auto_init: true,
    }),
  });

  if (res.status === 422) {
    throw new Error(`Já existe um repositório chamado "${name}" na sua conta GitHub. Escolha outro nome.`);
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      'O token do GitHub não tem permissão para criar repositórios. Use um token classic com o escopo "repo" ' +
        '(ou um fine-grained com acesso a "All repositories" e permissão "Administration: Read and write"), e atualize o GITHUB_TOKEN no .env.'
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Erro ao criar repositório no GitHub (${res.status}): ${text}`);
  }

  const repo = (await res.json()) as { name: string; html_url: string; default_branch: string; owner: { login: string } };
  const owner = repo.owner?.login || (await getOwner());
  const branch = repo.default_branch || 'main';

  try {
    await fetch(`${API_BASE}/repos/${owner}/${repo.name}/pages`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ build_type: 'workflow' }),
    });
  } catch {
    // nao critico — o workflow habilita o Pages sozinho no primeiro push
  }

  return {
    owner,
    name: repo.name,
    branch,
    htmlUrl: repo.html_url,
    pagesUrl: `https://${owner.toLowerCase()}.github.io/${repo.name}/`,
  };
}

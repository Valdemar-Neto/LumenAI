import fs from 'node:fs';
import path from 'node:path';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export const toolDefinitions: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'Lista todos os arquivos ja existentes dentro da pasta do site (util para ver o estado atual antes de editar).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Le o conteudo atual de um arquivo do site.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Caminho relativo dentro da pasta do site, ex: index.html' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Cria ou sobrescreve um arquivo do site com o conteudo fornecido.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Caminho relativo dentro da pasta do site, ex: css/style.css' },
          content: { type: 'string', description: 'Conteudo completo do arquivo (nao use trechos parciais).' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finish',
      description: 'Chame esta funcao quando o site estiver completo e pronto para publicacao.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Resumo em portugues do que foi criado/alterado.' },
        },
        required: ['summary'],
      },
    },
  },
];

function resolveSafePath(siteDir: string, relativePath: string): string {
  const base = path.resolve(siteDir);
  const target = path.resolve(siteDir, relativePath);
  if (!target.startsWith(base)) {
    throw new Error(`Caminho fora da pasta do site nao e permitido: ${relativePath}`);
  }
  return target;
}

export function listFiles(siteDir: string): string[] {
  const results: string[] = [];
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        results.push(path.relative(siteDir, full));
      }
    }
  }
  if (fs.existsSync(siteDir)) walk(siteDir);
  return results;
}

const MAX_READ_CHARS = 12000; // trava de seguranca contra arquivos gigantes estourando a janela de contexto

export function readFile(siteDir: string, relativePath: string): string {
  const target = resolveSafePath(siteDir, relativePath);
  if (!fs.existsSync(target)) return `[arquivo nao encontrado: ${relativePath}]`;
  const content = fs.readFileSync(target, 'utf-8');
  if (content.length <= MAX_READ_CHARS) return content;
  return `${content.slice(0, MAX_READ_CHARS)}\n\n[... arquivo truncado, ${content.length - MAX_READ_CHARS} caracteres a mais nao mostrados ...]`;
}

export function writeFile(siteDir: string, relativePath: string, content: string): void {
  const target = resolveSafePath(siteDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf-8');
}

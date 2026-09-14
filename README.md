# HF Site Agent

Agente de IA que gera sites estaticos (HTML/CSS/JS) a partir de um prompt em linguagem natural, usando a API de inferencia da **Hugging Face** com tool calling, e versiona o resultado automaticamente num **repositorio GitHub** que voce criar — com deploy automatico via **GitHub Pages**.

## Como funciona

1. Voce descreve o site que quer (ex: `"landing page para uma cafeteria, tom acolhedor"`).
2. O agente clona seu repositorio GitHub.
3. Ele roda um loop de raciocinio (ReAct) chamando um modelo via `router.huggingface.co` (API compativel com OpenAI, com suporte a function/tool calling).
4. O modelo usa 4 ferramentas — `list_files`, `read_file`, `write_file`, `finish` — para escrever os arquivos do site dentro da pasta `site/`.
5. O agente faz commit e push para o seu repositorio.
6. Um workflow do GitHub Actions (`.github/workflows/deploy-pages.yml`), gerado automaticamente, publica a pasta `site/` no GitHub Pages a cada push.

Rodar de novo com um novo prompt (ex: `"adicione uma secao de depoimentos"`) faz o agente ler o que ja existe e iterar em cima, em vez de recomecar do zero.

> ⚠️ **O servidor so le o `.env` na inicializacao.** Se voce editar `HF_TOKEN`,
> `GITHUB_TOKEN` ou qualquer outra variavel com o servidor ja rodando, reinicie
> o processo (`Ctrl+C` e rode `npm run dev`/`npm run serve` de novo) — senao ele
> continua usando os valores antigos ate reiniciar.

## Pre-requisitos

- Node.js 20+
- Git instalado
- Uma conta na Hugging Face com um token de **Inference Providers**
- Um repositorio no GitHub ja criado (pode estar vazio) e um token de acesso com permissao de escrita nele

## Setup

### 1. Crie o token da Hugging Face

Acesse https://huggingface.co/settings/tokens/new?ownUserPermissions=inference.serverless.write&tokenType=fineGrained e crie um token *fine-grained* com a permissao **"Make calls to Inference Providers"**.

Escolha um modelo cujo **provedor ativo** suporte tool/function calling (nem todo modelo listado suporta em todos os provedores — confira o campo `supports_tools` de cada provider em `https://router.huggingface.co/v1/models`, ou teste com uma chamada real, antes de trocar `HF_MODEL`; usar um provedor sem suporte da erro `400 tools/tool_choice not supported`). Bons candidatos atuais:
- `Qwen/Qwen3-Coder-480B-A35B-Instruct:novita` (recomendado — especializado em codigo)
- `deepseek-ai/DeepSeek-V3.2:novita`
- `meta-llama/Llama-3.3-70B-Instruct:novita`

Use o sufixo `:provedor` no nome do modelo para forcar um provedor especifico que voce ja confirmou que suporta tools, em vez de depender do roteamento automatico (que pode cair num provedor sem suporte).

### 2. Crie o repositorio no GitHub

Crie um repositorio novo (pode ser vazio) — esse sera o destino do site gerado. Depois, em **Settings > Pages**, defina **Source: GitHub Actions** (o workflow que o agente cria cuida do resto).

Gere um token do GitHub (classic, escopo `repo`, ou fine-grained com permissao de leitura/escrita em "Contents") em https://github.com/settings/tokens.

### 3. Configure o projeto

```bash
npm install
cp .env.example .env
```

Edite `.env` preenchendo `HF_TOKEN`, `GITHUB_TOKEN` e `GITHUB_REPO` (formato `usuario/repositorio`).

### 4. Gere seu primeiro site

```bash
npm run generate -- "landing page de uma cafeteria em Natal, tom acolhedor, cores terrosas, secoes: hero, cardapio, localizacao e contato"
```

Acompanhe o log no terminal. Ao final, o site estara publicado (alguns minutos apos o push, enquanto o Actions roda) em:

```
https://<usuario>.github.io/<repositorio>/
```

## Estrutura do projeto

```
src/
  config.ts        variaveis de ambiente
  hfClient.ts       cliente OpenAI-compativel apontando pro router da Hugging Face
  tools.ts          definicao e execucao das ferramentas do agente (ler/listar/escrever arquivos)
  agentLoop.ts      loop ReAct: manda mensagens+tools pro modelo, executa tool_calls, repete
  githubRepo.ts     clone/pull/commit/push do repositorio alvo via simple-git
  generateSite.ts   orquestra tudo (clone -> agente -> workflow do Pages -> push)
  cli.ts            ponto de entrada (linha de comando)
```

## Proximos passos sugeridos

- **Loop de autocritica visual**: apos o agente terminar, rodar o site num sandbox (ex: E2B, Vercel Sandbox) e mandar um screenshot de volta para um modelo com visao, pedindo criticas antes do push.
- **Suporte a Next.js/React**: hoje o agente gera HTML/CSS/JS puro (mais simples e sem etapa de build). Para React, seria necessario adicionar um passo de `npm run build` num sandbox antes do deploy.
- **Multiplos projetos**: adaptar `GITHUB_REPO`/`WORK_DIR` para receber parametros por chamada, permitindo gerenciar varios sites com a mesma base de codigo.
- **Interface web**: expor `generateSite()` atras de uma API (ex: NestJS) com um chat + preview ao vivo, em vez de rodar so via CLI.

## Seguranca

- Nunca commite o arquivo `.env` (ja esta no `.gitignore`).
- O token do GitHub fica embutido apenas localmente na URL remota autenticada usada pelo `simple-git` — nao e persistido em nenhum arquivo do repositorio.
- O agente so pode escrever dentro da pasta `site/` (validado em `tools.ts`), mesmo que o modelo tente enviar um caminho como `../../etc/passwd`.

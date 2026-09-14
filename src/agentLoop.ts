import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { hf } from './hfClient.js';
import { config } from './config.js';
import { toolDefinitions, listFiles, readFile, writeFile } from './tools.js';

const SYSTEM_PROMPT = `Voce e um agente especialista em construir sites estaticos (HTML, CSS e JavaScript puro, sem framework e sem etapa de build).

Regras:
- Todo o conteudo do site vive dentro da pasta que voce acessa atraves das ferramentas — nao existe caminho fora dela.
- Sempre comece chamando list_files para ver o que ja existe (o site pode ja ter sido gerado antes e agora esta sendo alterado/iterado).
- Se ja existirem arquivos relevantes, leia-os com read_file antes de sobrescrever, para manter consistencia.
- Depois de ler um arquivo uma vez, nao leia de novo — voce ja tem o conteudo, va direto para write_file.
- Gere HTML semantico, CSS moderno (flexbox/grid, variaveis CSS) e, se necessario, JavaScript simples — sem dependencias externas de build.
- Garanta responsividade basica (meta viewport, media queries para mobile).
- Sempre garanta que exista um index.html na raiz da pasta do site.
- Escreva todo o conteudo textual em portugues do Brasil, a menos que o pedido diga o contrario.
- Va em passos pequenos: um arquivo por chamada de write_file.
- Quando o site estiver pronto para publicacao, chame finish com um resumo em portugues do que foi criado ou alterado.
- Nunca invente ferramentas — use apenas list_files, read_file, write_file e finish.`;

// Referencia a uma chamada de ferramenta "pesada" (que carrega o conteudo
// completo de um arquivo) para poder encolhe-la depois que ela deixa de estar
// entre as mais recentes — evita que o historico va crescendo sem limite e
// estoure a cota de tokens por minuto de provedores com TPM baixo (ex: Groq
// free tier), mas mantem as ultimas KEEP_RECENT_HEAVY intactas para o modelo
// conseguir editar varios arquivos relacionados sem perder o conteudo deles.
interface HeavyRef {
  kind: 'read_file' | 'write_file';
  path: string;
  assistantMsgIndex: number;
  toolCallId: string;
  resultMsgIndex: number;
}

const KEEP_RECENT_HEAVY = 3;
const REPEATED_READ_LIMIT = 4; // passos seguidos so lendo/listando (sem escrever) antes de cutucar o modelo

const TRUNCATE_NOTICE = (path: string, kind: 'lido' | 'escrito') =>
  `[conteudo de ${path} (${kind} anteriormente) omitido do historico para economizar tokens — chame read_file de novo se precisar ve-lo]`;

function shrinkOldHeavyContent(messages: ChatCompletionMessageParam[], heavyRefs: HeavyRef[]) {
  for (let i = 0; i < heavyRefs.length - KEEP_RECENT_HEAVY; i++) {
    const ref = heavyRefs[i];

    if (ref.kind === 'read_file') {
      const msg = messages[ref.resultMsgIndex] as { content?: string };
      if (typeof msg.content === 'string' && msg.content.length > 200 && !msg.content.startsWith('[conteudo')) {
        msg.content = TRUNCATE_NOTICE(ref.path, 'lido');
      }
    } else {
      const assistantMsg = messages[ref.assistantMsgIndex] as { tool_calls?: any[] };
      const call = assistantMsg.tool_calls?.find((c) => c.id === ref.toolCallId);
      if (call) {
        try {
          const parsed = JSON.parse(call.function.arguments);
          if (typeof parsed.content === 'string' && parsed.content.length > 200) {
            call.function.arguments = JSON.stringify({ path: parsed.path, content: TRUNCATE_NOTICE(ref.path, 'escrito') });
          }
        } catch {
          // argumentos ja nao sao JSON valido — deixa como esta
        }
      }
    }
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.name === 'APIUserAbortError');
}

export async function runAgent(
  prompt: string,
  siteDir: string,
  onLog: (message: string) => void = console.log,
  signal?: AbortSignal
): Promise<string> {
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ];
  const heavyRefs: HeavyRef[] = [];
  let readOnlyStreak = 0;

  for (let step = 0; step < config.maxSteps; step++) {
    if (signal?.aborted) throw new DOMException('Interrompido pelo usuário', 'AbortError');

    shrinkOldHeavyContent(messages, heavyRefs);

    if (readOnlyStreak >= REPEATED_READ_LIMIT) {
      messages.push({
        role: 'system',
        content:
          'Voce so leu/listou arquivos nos ultimos passos, sem escrever nada. Pare de reler — use o conteudo que ja tem e chame write_file agora com a alteracao pedida, ou finish se nao houver mais nada a fazer.',
      });
      readOnlyStreak = 0;
    }

    onLog(`Passo ${step + 1}/${config.maxSteps}: consultando o modelo...`);
    let response;
    try {
      response = await hf.chat.completions.create(
        {
          model: config.hfModel,
          messages,
          tools: toolDefinitions,
          tool_choice: 'auto',
          max_tokens: 4000,
        },
        { signal }
      );
    } catch (err) {
      if (isAbortError(err)) throw new DOMException('Interrompido pelo usuário', 'AbortError');
      throw err;
    }

    const message = response.choices[0].message;
    const assistantMsgIndex = messages.length;
    messages.push(message as ChatCompletionMessageParam);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      // Modelo respondeu em texto livre sem chamar nenhuma ferramenta.
      return message.content ?? 'Agente finalizou sem resumo explicito.';
    }

    const calledWriteOrFinish = message.tool_calls.some(
      (c) => c.function.name === 'write_file' || c.function.name === 'finish'
    );
    readOnlyStreak = calledWriteOrFinish ? 0 : readOnlyStreak + 1;

    for (const call of message.tool_calls) {
      let args: Record<string, any> = {};
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch {
        // argumentos malformados — segue com objeto vazio
      }

      let result: string;

      switch (call.function.name) {
        case 'list_files':
          onLog('  -> listando arquivos existentes');
          result = JSON.stringify(listFiles(siteDir));
          break;
        case 'read_file':
          onLog(`  -> lendo ${args.path}`);
          result = readFile(siteDir, args.path);
          break;
        case 'write_file':
          onLog(`  -> escrevendo ${args.path}`);
          writeFile(siteDir, args.path, args.content ?? '');
          result = `Arquivo salvo: ${args.path}`;
          break;
        case 'finish':
          return args.summary || 'Site concluido.';
        default:
          result = `Ferramenta desconhecida: ${call.function.name}`;
      }

      const resultMsgIndex = messages.length;
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: result,
      });

      if (call.function.name === 'read_file' || call.function.name === 'write_file') {
        heavyRefs.push({
          kind: call.function.name,
          path: args.path,
          assistantMsgIndex,
          toolCallId: call.id,
          resultMsgIndex,
        });
      }
    }
  }

  return 'Numero maximo de passos atingido — revise o resultado manualmente antes de publicar.';
}

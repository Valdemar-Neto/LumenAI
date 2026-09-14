import { AlertTriangle, Eye, FileText, FolderOpen, GitBranch, PencilLine, Rocket, UploadCloud } from 'lucide-react';

export type ParsedLine =
  | { kind: 'thinking'; step: number; total: number }
  | { kind: 'tool'; icon: typeof FileText; text: string }
  | { kind: 'setup'; icon: typeof GitBranch; text: string }
  | { kind: 'hidden' };

/** Traduz uma linha crua de log do agente num item visual amigavel (icone + texto curto). */
export function parseLogLine(line: string): ParsedLine {
  const thinking = line.match(/^Passo (\d+)\/(\d+): consultando o modelo\.\.\.$/);
  if (thinking) return { kind: 'thinking', step: Number(thinking[1]), total: Number(thinking[2]) };

  const listing = line.match(/^ {2}-> listando arquivos existentes$/);
  if (listing) return { kind: 'tool', icon: FolderOpen, text: 'Olhando os arquivos existentes' };

  const reading = line.match(/^ {2}-> lendo (.+)$/);
  if (reading) return { kind: 'tool', icon: FileText, text: `Lendo ${reading[1]}` };

  const writing = line.match(/^ {2}-> escrevendo (.+)$/);
  if (writing) return { kind: 'tool', icon: PencilLine, text: `Escrevendo ${writing[1]}` };

  if (/^Clonando\/atualizando/.test(line)) return { kind: 'setup', icon: GitBranch, text: 'Preparando o repositório' };
  if (/^Rodando o agente/.test(line)) return { kind: 'setup', icon: Eye, text: 'Planejando as mudanças' };
  if (/^Enviando para o GitHub/.test(line)) return { kind: 'setup', icon: UploadCloud, text: 'Enviando para o GitHub' };
  if (/^Nada para commitar/.test(line)) return { kind: 'setup', icon: UploadCloud, text: 'Nada novo para enviar' };
  if (/^Pronto!/.test(line)) return { kind: 'setup', icon: Rocket, text: 'Deploy configurado' };
  if (/^(Nao foi possivel clonar|Pull falhou)/.test(line)) return { kind: 'setup', icon: AlertTriangle, text: line };

  // Linhas so informativas (URLs de instrucao) que ficaram redundantes agora
  // que o Pages e habilitado automaticamente — nao precisam aparecer no chat.
  if (/^ {2}(https?:\/\/|Em ")/.test(line)) return { kind: 'hidden' };

  return { kind: 'setup', icon: GitBranch, text: line };
}

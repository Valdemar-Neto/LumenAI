import { useState } from 'react';
import { ArrowUpRight, Eye, EyeOff } from 'lucide-react';
import { parseLogLine } from '@/lib/parseLogLine';
import { Markdown } from '@/components/Markdown';
import type { AgentMessage } from '@/types';

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 h-full pt-1 px-2">
      <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

interface MessageBubbleProps {
  message: AgentMessage;
  conversationId: string;
}

export function MessageBubble({ message, conversationId }: MessageBubbleProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewNonce, setPreviewNonce] = useState(0);

  if (message.role === 'user') {
    return (
      <div className="flex w-full justify-end animate-msg-enter">
        <div className="max-w-[85%] sm:max-w-[75%] bg-gray-800/80 text-gray-100 rounded-2xl rounded-br-sm px-4 py-3 text-[15px] leading-relaxed border border-gray-700 shadow-sm whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    );
  }

  const isPending = message.status === 'pending';
  const isError = message.status === 'error';
  const isStopped = message.status === 'stopped';

  const items = (message.logs || []).map(parseLogLine).filter((item) => item.kind !== 'hidden');
  const previewUrl = `/api/conversations/${conversationId}/preview/index.html?v=${previewNonce}`;

  return (
    <div className="flex w-full justify-start animate-msg-enter">
      <div className="flex gap-4 max-w-[90%] sm:max-w-[85%] w-full sm:w-auto">
        <div className="w-8 h-8 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center shrink-0 mt-1 shadow-sm overflow-hidden">
          <img src="/lumen-logo.png" alt="Lumen AI" className="w-full h-full object-contain p-1" />
        </div>

        <div className="text-gray-300 py-1.5 text-[15px] leading-relaxed min-w-0 flex-1">
          {items.length === 0 && isPending && <TypingDots />}

          {items.length > 0 && (
            <div className="flex flex-col gap-1 text-[13px] text-gray-500">
              {items.map((item, i) =>
                item.kind === 'thinking' ? null : (
                  <div key={i} className="flex items-center gap-1.5">
                    <item.icon className="w-3.5 h-3.5 shrink-0 text-lumen-500/70" />
                    <span className={item.text.startsWith('Nao foi') || item.text.startsWith('Pull falhou') ? 'text-amber-500' : ''}>
                      {item.text}
                    </span>
                  </div>
                )
              )}
              {isPending && <TypingDots />}
            </div>
          )}

          {message.status === 'done' && message.content && (
            <div className={items.length > 0 ? 'mt-3 pt-3 border-t border-dashed border-gray-800' : ''}>
              <Markdown>{message.content}</Markdown>
            </div>
          )}

          {isError && (
            <p className={`text-red-400 ${items.length > 0 ? 'mt-3 pt-3 border-t border-dashed border-gray-800' : ''}`}>
              Deu um erro ao publicar: {message.content}
            </p>
          )}

          {isStopped && (
            <p className={`text-gray-500 italic ${items.length > 0 ? 'mt-3 pt-3 border-t border-dashed border-gray-800' : ''}`}>
              ⏹ {message.content || 'Interrompido por você.'}
            </p>
          )}

          {message.status === 'done' && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setPreviewNonce(Date.now());
                  setPreviewOpen((v) => !v);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 px-3.5 py-1.5 text-xs font-semibold text-gray-200 transition-colors hover:bg-gray-700"
              >
                {previewOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {previewOpen ? 'Fechar preview' : 'Ver preview'}
              </button>

              {message.pagesUrl && (
                <a
                  href={message.pagesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-lumen-500 px-3.5 py-1.5 text-xs font-semibold text-gray-950 transition-[filter] hover:brightness-110"
                >
                  Site publicado
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          )}

          {previewOpen && (
            <div className="mt-3 w-full sm:w-[560px] overflow-hidden rounded-xl border border-gray-700 bg-white shadow-lg">
              <div className="flex items-center justify-between bg-gray-800 px-3 py-1.5">
                <span className="text-[11px] font-mono text-gray-400">preview local — pode ficar levemente defasado do publicado</span>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-lumen-400 hover:underline shrink-0 ml-2"
                >
                  abrir em nova aba
                </a>
              </div>
              <iframe title="Preview do site" src={previewUrl} className="h-[420px] w-full border-0" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

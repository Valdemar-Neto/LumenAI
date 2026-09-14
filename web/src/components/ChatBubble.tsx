import { Globe } from 'lucide-react';
import { Markdown } from '@/components/Markdown';
import type { ChatTurn } from '@/types';

export function ChatBubble({ turn }: { turn: ChatTurn }) {
  if (turn.role === 'user') {
    return (
      <div className="flex w-full justify-end animate-msg-enter">
        <div className="max-w-[85%] sm:max-w-[75%] bg-gray-800/80 text-gray-100 rounded-2xl rounded-br-sm px-4 py-3 text-[15px] leading-relaxed border border-gray-700 shadow-sm whitespace-pre-wrap break-words">
          {turn.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-start animate-msg-enter">
      <div className="flex gap-4 max-w-[90%] sm:max-w-[85%] min-w-0">
        <div className="w-8 h-8 rounded-full bg-gray-900 border border-gray-700 flex items-center justify-center shrink-0 mt-1 shadow-sm overflow-hidden">
          <img src="/lumen-logo.png" alt="Lumen AI" className="w-full h-full object-contain p-1" />
        </div>
        <div className="py-1.5 min-w-0 flex-1">
          <Markdown>{turn.content}</Markdown>

          {turn.sources && turn.sources.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {turn.sources.map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={s.title}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-800 bg-gray-900/60 px-2.5 py-1 text-[11px] text-gray-400 hover:text-lumen-400 hover:border-gray-700 transition-colors max-w-[220px]"
                >
                  <Globe className="w-3 h-3 shrink-0" />
                  <span className="truncate">{s.title || new URL(s.url).hostname}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

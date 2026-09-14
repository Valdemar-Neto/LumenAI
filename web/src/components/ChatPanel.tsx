import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Globe, Menu, MessageCircle, SendHorizontal } from 'lucide-react';
import { ChatBubble } from '@/components/ChatBubble';
import { useChats } from '@/hooks/useChats';

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 pl-12 pt-1">
      <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

interface ChatPanelProps {
  chats: ReturnType<typeof useChats>;
  onOpenSidebar: () => void;
  webSearchAvailable: boolean;
}

export function ChatPanel({ chats: useChatsHook, onOpenSidebar, webSearchAvailable }: ChatPanelProps) {
  const { active, models, sending, loading, changeModel, sendMessage, createChat } = useChatsHook;

  const [draft, setDraft] = useState('');
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [active?.turns.length, sending]);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }

  function submit(text: string) {
    const value = text.trim();
    if (!value || sending || !active) return;
    sendMessage(value);
    setDraft('');
    requestAnimationFrame(autoResize);
  }

  const hasDraft = draft.trim().length > 0;
  const currentModel = models.find((m) => m.id === active?.model);
  const canSearch = webSearchAvailable && !!active && !active.model.startsWith('groq/compound');

  return (
    <div className="flex-1 flex flex-col relative w-full h-full overflow-hidden bg-gray-950">
      <div className="absolute inset-0 bg-grid-pattern z-0 opacity-[0.03] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-lumen-500/5 rounded-full blur-[100px] z-0 pointer-events-none" />

      <header className="glass-header z-20 w-full px-4 py-3 flex items-center justify-between sticky top-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onOpenSidebar} className="md:hidden p-2 -ml-2 text-gray-400 hover:text-gray-200 rounded-md">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex flex-col min-w-0">
            <h1 className="text-sm font-medium text-gray-200 truncate">{active ? active.title : 'Chat geral'}</h1>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-500 font-mono">Lumen AI · modo conversa</span>
              {active && (
                <span
                  title={canSearch ? 'Busca na web ativada' : 'Busca na web desativada'}
                  className={`inline-flex items-center gap-1 text-[10px] ${canSearch ? 'text-lumen-500/80' : 'text-gray-600'}`}
                >
                  <Globe className="w-3 h-3" />
                </span>
              )}
            </div>
          </div>
        </div>

        {active && (
          <div className="relative">
            <button
              onClick={() => setModelMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-800"
            >
              <span className="font-mono truncate max-w-[160px]">{currentModel?.id || active.model}</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            </button>
            {modelMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setModelMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 w-64 max-h-72 overflow-y-auto rounded-md border border-gray-700 bg-gray-900 shadow-lg py-1">
                  {models.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        changeModel(active.id, m.id);
                        setModelMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-mono hover:bg-gray-800 ${
                        m.id === active.model ? 'text-lumen-400' : 'text-gray-300'
                      }`}
                    >
                      {m.id}
                      <span className="block text-[10px] text-gray-500 font-sans">
                        contexto: {m.contextWindow.toLocaleString('pt-BR')} tokens
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto z-10 relative scroll-smooth flex flex-col">
        <div className="flex-1 flex flex-col w-full max-w-3xl mx-auto px-4 py-8">
          {!loading && !active && (
            <div className="flex-1 flex flex-col items-center justify-center text-center my-auto">
              <div className="mb-6 relative group">
                <div className="absolute inset-0 bg-lumen-500/20 rounded-2xl blur-xl group-hover:bg-lumen-500/30 transition-all duration-500" />
                <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-700 flex items-center justify-center relative z-10 shadow-2xl">
                  <MessageCircle className="w-8 h-8 text-lumen-400" />
                </div>
              </div>
              <h2 className="text-2xl font-semibold text-gray-100 mb-2 tracking-tight">Chat geral</h2>
              <p className="text-gray-400 text-sm max-w-md mx-auto leading-relaxed mb-6">
                Converse sobre qualquer assunto — estudos, dúvidas, escrita — usando os modelos de texto da Groq.
              </p>
              <button
                onClick={() => createChat()}
                className="inline-flex items-center gap-2 rounded-lg bg-lumen-500 text-gray-950 font-medium text-sm px-4 py-2.5 hover:brightness-110 transition-all"
              >
                Começar conversa
              </button>
            </div>
          )}

          {active && active.turns.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center my-auto">
              <div className="mb-6 relative group">
                <div className="absolute inset-0 bg-lumen-500/20 rounded-2xl blur-xl group-hover:bg-lumen-500/30 transition-all duration-500" />
                <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-700 flex items-center justify-center relative z-10 shadow-2xl">
                  <MessageCircle className="w-8 h-8 text-lumen-400" />
                </div>
              </div>
              <h2 className="text-2xl font-semibold text-gray-100 mb-2 tracking-tight">Sobre o que vamos falar?</h2>
              <p className="text-gray-400 text-sm max-w-md mx-auto leading-relaxed">
                Pergunte qualquer coisa — o modelo atual é <span className="font-mono text-lumen-500/80">{active.model}</span>.
              </p>
            </div>
          )}

          {active && active.turns.length > 0 && (
            <div className="w-full flex flex-col gap-6 pb-4">
              {active.turns.map((turn) => (
                <ChatBubble key={turn.id} turn={turn} />
              ))}
              {sending && <TypingDots />}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>
        <div className="h-36 shrink-0" />
      </main>

      <div className="absolute bottom-0 left-0 w-full z-20 bg-gradient-to-t from-gray-950 via-gray-950/95 to-transparent pt-8 pb-6 px-4">
        <div className="max-w-3xl mx-auto w-full relative">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(draft);
            }}
            className={`relative flex items-end bg-gray-900 border rounded-xl transition-all duration-200 shadow-2xl input-glow overflow-hidden px-3 py-3 ${hasDraft ? 'border-gray-500' : 'border-gray-700'}`}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={draft}
              disabled={sending || !active}
              placeholder={active ? 'Envie uma mensagem...' : 'Crie uma conversa para começar...'}
              className="w-full bg-transparent text-gray-100 placeholder-gray-500 text-[15px] resize-none focus:outline-none max-h-40 overflow-y-auto leading-relaxed px-3 py-1.5 min-h-[44px] disabled:opacity-60"
              onChange={(e) => {
                setDraft(e.target.value);
                autoResize();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit(draft);
                }
              }}
            />
            <button
              type="submit"
              disabled={sending || !hasDraft || !active}
              className={`p-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 mb-0.5 border ${
                hasDraft
                  ? 'bg-lumen-500 text-gray-950 border-lumen-400'
                  : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-lumen-500 hover:text-gray-950 hover:border-lumen-400'
              }`}
            >
              <SendHorizontal className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

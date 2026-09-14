import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Bug, ChevronDown, Code, Database, FolderGit2, Github, Image as ImageIcon, Layout, Menu, Paintbrush, Paperclip, Plus, Square, Terminal } from 'lucide-react';
import { MessageBubble } from '@/components/MessageBubble';
import { NewProjectDialog } from '@/components/NewProjectDialog';
import type { useLumen } from '@/hooks/useLumen';
import type { StatusResponse } from '@/types';

const STARTER_PROMPTS = [
  {
    icon: Layout,
    title: 'Criar Landing Page',
    text: 'Crie uma landing page moderna para uma startup de IA com tema escuro...',
  },
  {
    icon: Paintbrush,
    title: 'Ajustar Estilos',
    text: 'Mude a cor primária do botão para azul e adicione cantos arredondados...',
  },
  {
    icon: Bug,
    title: 'Corrigir Bug',
    text: 'O menu mobile não está fechando ao clicar em um link, pode corrigir?',
  },
  {
    icon: Database,
    title: 'Nova Funcionalidade',
    text: 'Adicione um formulário de contato simples integrado a uma API...',
  },
];

interface ProjectPanelProps {
  lumen: ReturnType<typeof useLumen>;
  status: StatusResponse | null;
  onOpenSidebar: () => void;
  newProjectOpen: boolean;
  onNewProjectOpenChange: (open: boolean) => void;
}

export function ProjectPanel({ lumen, status, onOpenSidebar, newProjectOpen, onNewProjectOpenChange }: ProjectPanelProps) {
  const { conversations, active, busy, loading, createProject, sendMessage, stopGeneration } = lumen;

  const [draft, setDraft] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasMessages = (active?.messages.length ?? 0) > 0;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [active?.messages.length, active?.messages.at(-1)?.logs?.length]);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }

  function submit(text: string) {
    const value = text.trim();
    if (!value || busy || !active) return;
    sendMessage(value);
    setDraft('');
    requestAnimationFrame(autoResize);
  }

  const hasDraft = draft.trim().length > 0;

  return (
    <div className="flex-1 flex flex-col relative w-full h-full overflow-hidden bg-gray-950">
      <div className="absolute inset-0 bg-grid-pattern z-0 opacity-[0.03] pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-lumen-500/5 rounded-full blur-[100px] z-0 pointer-events-none" />

      <NewProjectDialog
        open={newProjectOpen}
        githubOwner={status?.githubOwner ?? null}
        onOpenChange={onNewProjectOpenChange}
        onCreate={async (name) => {
          await createProject(name);
        }}
      />

      <header className="glass-header z-20 w-full px-4 py-3 flex items-center justify-between sticky top-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onOpenSidebar} className="md:hidden p-2 -ml-2 text-gray-400 hover:text-gray-200 rounded-md">
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 group cursor-default">
              <h1 className="text-sm font-medium text-gray-200 flex items-center gap-1 truncate">
                {active ? active.title : 'Lumen AI'}
                {!active && <span className="text-xs text-gray-500 font-normal">v1.0</span>}
                <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0" />
              </h1>
            </div>
            <div className="text-[11px] text-gray-500 font-mono flex items-center gap-1.5 mt-0.5 min-w-0">
              <span className="truncate max-w-[150px] sm:max-w-xs text-lumen-500/70" title={status?.model}>
                {status?.model?.split('/').pop()?.split(':')[0] || '…'}
              </span>
              {active && (
                <>
                  <span className="w-1 h-1 rounded-full bg-gray-700 shrink-0" />
                  <span className="truncate">{active.repo.name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md border border-lumen-900/50 bg-lumen-900/10">
            <span className="relative flex h-1.5 w-1.5">
              {!busy && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lumen-400 opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 bg-lumen-500 ${busy ? 'animate-pulse' : ''}`} />
            </span>
            <span className="text-[11px] font-medium text-lumen-400/90 uppercase tracking-wider">
              {busy ? 'Processando' : 'Pronta'}
            </span>
          </div>

          {active && (
            <a
              href={active.repo.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir repositório no GitHub"
              className="p-1.5 text-gray-400 hover:text-gray-200 transition-colors rounded-md hover:bg-gray-800 border border-transparent hover:border-gray-700"
            >
              <Github className="w-4 h-4" />
            </a>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto z-10 relative scroll-smooth flex flex-col">
        <div className="flex-1 flex flex-col w-full max-w-3xl mx-auto px-4 py-8">
          {!loading && !active && (
            <div className="flex-1 flex flex-col items-center justify-center text-center my-auto">
              <div className="mb-6 relative group">
                <div className="absolute inset-0 bg-lumen-500/20 rounded-2xl blur-xl group-hover:bg-lumen-500/30 transition-all duration-500" />
                <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-700 flex items-center justify-center relative z-10 shadow-2xl">
                  <FolderGit2 className="w-8 h-8 text-lumen-400" />
                </div>
              </div>

              <h2 className="text-2xl font-semibold text-gray-100 mb-2 tracking-tight">
                {conversations.length === 0 ? 'Crie seu primeiro projeto' : 'Selecione ou crie um projeto'}
              </h2>
              <p className="text-gray-400 text-sm max-w-md mx-auto leading-relaxed mb-6">
                Cada projeto vira um repositório próprio no GitHub, com deploy automático via GitHub Pages.
              </p>

              <button
                onClick={() => onNewProjectOpenChange(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-lumen-500 text-gray-950 font-medium text-sm px-4 py-2.5 hover:brightness-110 transition-all"
              >
                <Plus className="w-4 h-4" />
                Novo Projeto
              </button>
            </div>
          )}

          {active && !hasMessages && (
            <div className="flex-1 flex flex-col items-center justify-center text-center my-auto">
              <div className="mb-6 relative group">
                <div className="absolute inset-0 bg-lumen-500/20 rounded-2xl blur-xl group-hover:bg-lumen-500/30 transition-all duration-500" />
                <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-700 flex items-center justify-center relative z-10 shadow-2xl">
                  <Terminal className="w-8 h-8 text-lumen-400" />
                </div>
              </div>

              <h2 className="text-2xl font-semibold text-gray-100 mb-2 tracking-tight">Como posso ajudar hoje?</h2>
              <p className="text-gray-400 text-sm max-w-md mx-auto leading-relaxed">
                Sou seu agente de desenvolvimento. Descreva o que você quer construir em <b>{active.repo.name}</b>.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-10 w-full max-w-xl mx-auto">
                {STARTER_PROMPTS.map(({ icon: Icon, title, text }, i) => (
                  <button
                    key={title}
                    onClick={() => {
                      setDraft(text.replace(/"/g, ''));
                      requestAnimationFrame(() => {
                        autoResize();
                        textareaRef.current?.focus();
                      });
                    }}
                    className={`text-left p-3.5 rounded-xl border border-gray-800 bg-gray-900/50 hover:bg-gray-800 hover:border-gray-600 transition-all group shadow-sm hover:shadow-md ${i >= 2 ? 'hidden sm:block' : ''}`}
                  >
                    <div className="flex items-center gap-2 mb-1.5 text-gray-300 group-hover:text-lumen-400 transition-colors">
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-medium">{title}</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-snug">"{text}"</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {active && hasMessages && (
            <div className="w-full flex flex-col gap-6 pb-4">
              {active.messages.map((message) => (
                <MessageBubble key={message.id} message={message} conversationId={active.id} />
              ))}
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
            className={`relative flex flex-col bg-gray-900 border rounded-xl transition-all duration-200 shadow-2xl input-glow overflow-hidden ${hasDraft ? 'border-gray-500' : 'border-gray-700'}`}
          >
            <div className="relative flex items-end w-full px-3 py-3">
              <button type="button" disabled title="Anexos em breve" className="p-2 text-gray-600 rounded-lg shrink-0 mb-0.5 cursor-not-allowed">
                <Paperclip className="w-5 h-5" />
              </button>

              <textarea
                ref={textareaRef}
                rows={1}
                value={draft}
                disabled={busy || !active}
                placeholder={active ? 'Envie uma mensagem para Lumen AI...' : 'Crie um projeto para começar...'}
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

              {busy ? (
                <button
                  type="button"
                  onClick={stopGeneration}
                  title="Parar geração"
                  className="p-2 rounded-lg shrink-0 mb-0.5 border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-gray-100 transition-colors"
                >
                  <Square className="w-4 h-4 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!hasDraft || !active}
                  className={`p-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 mb-0.5 border ${
                    hasDraft
                      ? 'bg-lumen-500 text-gray-950 border-lumen-400'
                      : 'bg-gray-800 text-gray-400 border-gray-700 hover:bg-lumen-500 hover:text-gray-950 hover:border-lumen-400'
                  }`}
                >
                  <ArrowUp className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-800 bg-gray-900/50">
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-600 flex items-center gap-1.5 cursor-not-allowed" title="Em breve">
                  <Code className="w-3.5 h-3.5" />
                  Base de código
                </span>
                <span className="text-xs text-gray-600 flex items-center gap-1.5 cursor-not-allowed" title="Em breve">
                  <ImageIcon className="w-3.5 h-3.5" />
                  Imagem
                </span>
              </div>
              <span className="text-[10px] text-gray-500 hidden sm:block">A IA pode cometer erros. Verifique o código.</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

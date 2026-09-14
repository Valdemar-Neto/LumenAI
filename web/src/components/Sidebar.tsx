import { useState } from 'react';
import { MessageCircle, MessageSquare, MoreHorizontal, Pencil, Settings, SquarePen, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { groupByDate } from '@/lib/groupByDate';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { ChatSummary, ConversationSummary } from '@/types';

export type SidebarMode = 'projects' | 'chat';

interface SidebarItem {
  id: string;
  title: string;
  subtitle: string;
  updatedAt: number;
}

interface SidebarProps {
  mode: SidebarMode;
  onModeChange: (mode: SidebarMode) => void;
  chatAvailable: boolean;

  conversations: ConversationSummary[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onRenameProject: (id: string, title: string) => void;
  onDeleteProject: (id: string) => void;

  chats: ChatSummary[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onRenameChat: (id: string, title: string) => void;
  onDeleteChat: (id: string) => void;

  authorName: string;
  open: boolean;
  onClose: () => void;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function Sidebar({
  mode,
  onModeChange,
  chatAvailable,
  conversations,
  activeProjectId,
  onSelectProject,
  onNewProject,
  onRenameProject,
  onDeleteProject,
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onRenameChat,
  onDeleteChat,
  authorName,
  open,
  onClose,
}: SidebarProps) {
  const [renaming, setRenaming] = useState<SidebarItem | null>(null);
  const [draftTitle, setDraftTitle] = useState('');

  const isProjects = mode === 'projects';

  const items: SidebarItem[] = isProjects
    ? conversations.map((c) => ({ id: c.id, title: c.title, subtitle: c.repo.name, updatedAt: c.updatedAt }))
    : chats.map((c) => ({ id: c.id, title: c.title, subtitle: c.model, updatedAt: c.updatedAt }));

  const activeId = isProjects ? activeProjectId : activeChatId;
  const groups = groupByDate(items);

  function openRename(item: SidebarItem) {
    setRenaming(item);
    setDraftTitle(item.title);
  }

  function confirmRename() {
    if (renaming && draftTitle.trim()) {
      if (isProjects) onRenameProject(renaming.id, draftTitle.trim());
      else onRenameChat(renaming.id, draftTitle.trim());
    }
    setRenaming(null);
  }

  function handleSelect(id: string) {
    if (isProjects) onSelectProject(id);
    else onSelectChat(id);
    onClose();
  }

  function handleDelete(id: string) {
    if (isProjects) onDeleteProject(id);
    else onDeleteChat(id);
  }

  function handleNew() {
    if (isProjects) onNewProject();
    else onNewChat();
    onClose();
  }

  return (
    <>
      <aside
        className={cn(
          'w-64 bg-gray-900 border-r border-gray-800 flex flex-col transition-transform duration-300 z-30 absolute md:relative h-full',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-1">
          <img
            src="/lumen-logo.png"
            alt="Lumen AI"
            className="w-7 h-7 object-contain drop-shadow-[0_0_8px_rgba(74,222,128,0.45)]"
          />
          <span className="text-[15px] font-semibold text-gray-100 tracking-tight">Lumen AI</span>
        </div>

        <div className="flex gap-1 mx-4 mt-3 p-1 rounded-lg bg-gray-950/60 border border-gray-800">
          <button
            onClick={() => onModeChange('projects')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors',
              isProjects ? 'bg-gray-800 text-gray-100' : 'text-gray-500 hover:text-gray-300'
            )}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Projetos
          </button>
          <button
            onClick={() => chatAvailable && onModeChange('chat')}
            disabled={!chatAvailable}
            title={chatAvailable ? undefined : 'Configure GROQ_API_KEY no .env para usar o chat'}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
              !isProjects ? 'bg-gray-800 text-gray-100' : 'text-gray-500 hover:text-gray-300'
            )}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Chat
          </button>
        </div>

        <div className="p-4 pt-3">
          <button
            onClick={handleNew}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg border border-gray-700 transition-colors group"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center overflow-hidden">
                <img src="/lumen-logo.png" alt="" className="w-4 h-4 object-contain" />
              </div>
              {isProjects ? 'Novo Projeto' : 'Nova conversa'}
            </span>
            <SquarePen className="w-4 h-4 text-gray-400 group-hover:text-gray-200 transition-colors" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto sidebar-scroll px-3 pb-4">
          {groups.map((group) => (
            <div key={group.label} className="mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
                {group.label}
              </h3>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.id} className="group relative">
                    <button
                      onClick={() => handleSelect(item.id)}
                      className={cn(
                        'w-full text-left px-3 py-2 pr-8 rounded-md text-sm transition-colors flex items-center gap-3',
                        item.id === activeId
                          ? 'bg-gray-800 text-gray-200 font-medium'
                          : 'hover:bg-gray-800/50 text-gray-400 hover:text-gray-200'
                      )}
                    >
                      {isProjects ? (
                        <MessageSquare className="w-4 h-4 shrink-0 text-gray-500 group-hover:text-gray-400" />
                      ) : (
                        <MessageCircle className="w-4 h-4 shrink-0 text-gray-500 group-hover:text-gray-400" />
                      )}
                      <span className="min-w-0 flex flex-col">
                        <span className="truncate">{item.title}</span>
                        <span className="truncate text-[11px] text-gray-600 font-mono">{item.subtitle}</span>
                      </span>
                    </button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 opacity-0 transition-opacity hover:bg-gray-700 hover:text-gray-200 group-hover:opacity-100"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => openRename(item)}>
                          <Pencil /> Renomear
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          destructive
                          onClick={() => handleDelete(item.id)}
                          title={isProjects ? 'Remove só da lista — o repositório continua no GitHub.' : undefined}
                        >
                          <Trash2 /> {isProjects ? 'Remover da lista' : 'Excluir'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {items.length === 0 && (
            <p className="px-2.5 py-4 text-xs text-gray-500">
              {isProjects ? 'Nenhum projeto ainda.' : 'Nenhuma conversa ainda.'}
            </p>
          )}
        </div>

        <div className="p-3 border-t border-gray-800">
          <button
            title="Configurações (em breve)"
            className="w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-800 text-gray-300 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-medium text-gray-300">
                {initials(authorName)}
              </div>
              <div className="text-left">
                <p className="text-sm font-medium leading-none">{authorName}</p>
                <p className="text-xs text-gray-500 mt-1">Configurações</p>
              </div>
            </div>
            <Settings className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-sm z-20 md:hidden" onClick={onClose} />}

      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear conversa</DialogTitle>
          </DialogHeader>
          {isProjects && (
            <p className="text-xs text-gray-500 mb-3 -mt-2">
              Muda só o nome exibido aqui — o repositório no GitHub continua com o mesmo nome.
            </p>
          )}
          <Input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
            autoFocus
          />
          <DialogFooter>
            <button
              onClick={() => setRenaming(null)}
              className="px-3 py-1.5 text-sm rounded-md text-gray-300 hover:bg-gray-800"
            >
              Cancelar
            </button>
            <button
              onClick={confirmRename}
              className="px-3 py-1.5 text-sm rounded-md bg-lumen-500 text-gray-950 font-medium hover:brightness-110"
            >
              Salvar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

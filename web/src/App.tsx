import { useState } from 'react';
import { Sidebar, type SidebarMode } from '@/components/Sidebar';
import { ProjectPanel } from '@/components/ProjectPanel';
import { ChatPanel } from '@/components/ChatPanel';
import { useLumen } from '@/hooks/useLumen';
import { useChats } from '@/hooks/useChats';

export default function App() {
  const lumen = useLumen();
  const chats = useChats();

  const [mode, setMode] = useState<SidebarMode>('projects');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  return (
    <div className="bg-gray-950 text-gray-200 font-sans h-screen flex overflow-hidden selection:bg-lumen-500/30 selection:text-lumen-400">
      <Sidebar
        mode={mode}
        onModeChange={setMode}
        chatAvailable={lumen.status?.groqChatAvailable ?? false}
        conversations={lumen.conversations}
        activeProjectId={lumen.activeId}
        onSelectProject={lumen.openConversation}
        onNewProject={() => {
          setMode('projects');
          setNewProjectOpen(true);
        }}
        onRenameProject={lumen.renameChat}
        onDeleteProject={lumen.deleteChat}
        chats={chats.chats}
        activeChatId={chats.activeId}
        onSelectChat={chats.openChat}
        onNewChat={() => chats.createChat()}
        onRenameChat={chats.renameChatItem}
        onDeleteChat={chats.deleteChatItem}
        authorName={lumen.status?.authorName || 'Você'}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {mode === 'projects' ? (
        <ProjectPanel
          lumen={lumen}
          status={lumen.status}
          onOpenSidebar={() => setSidebarOpen(true)}
          newProjectOpen={newProjectOpen}
          onNewProjectOpenChange={setNewProjectOpen}
        />
      ) : (
        <ChatPanel
          chats={chats}
          onOpenSidebar={() => setSidebarOpen(true)}
          webSearchAvailable={lumen.status?.webSearchAvailable ?? false}
        />
      )}
    </div>
  );
}

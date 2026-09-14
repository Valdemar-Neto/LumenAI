import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentMessage, Conversation, ConversationSummary, StatusResponse } from '@/types';

const LOCAL_PENDING_ID = 'local-pending';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data as T;
}

export function useLumen() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<Conversation | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const activeIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const refreshList = useCallback(async () => {
    const list = await api<ConversationSummary[]>('/api/conversations');
    setConversations(list);
    return list;
  }, []);

  const openConversation = useCallback(async (id: string) => {
    const conversation = await api<Conversation>(`/api/conversations/${id}`);
    setActiveId(id);
    setActive(conversation);
  }, []);

  /** Cria um projeto novo: cria o repositorio no GitHub e a conversa associada a ele. */
  const createProject = useCallback(async (projectName: string) => {
    const conversation = await api<Conversation>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ projectName }),
    });
    setConversations((prev) => [
      { id: conversation.id, title: conversation.title, repo: conversation.repo, createdAt: conversation.createdAt, updatedAt: conversation.updatedAt },
      ...prev,
    ]);
    setActiveId(conversation.id);
    setActive(conversation);
    return conversation;
  }, []);

  const renameChat = useCallback(
    async (id: string, title: string) => {
      await api(`/api/conversations/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) });
      await refreshList();
      setActive((prev) => (prev && prev.id === id ? { ...prev, title } : prev));
    },
    [refreshList]
  );

  const deleteChat = useCallback(
    async (id: string) => {
      await api(`/api/conversations/${id}`, { method: 'DELETE' });
      const list = await refreshList();
      if (activeIdRef.current === id) {
        if (list.length > 0) {
          await openConversation(list[0].id);
        } else {
          setActiveId(null);
          setActive(null);
        }
      }
    },
    [refreshList, openConversation]
  );

  const sendMessage = useCallback(async (text: string) => {
    const conversationId = activeIdRef.current;
    if (!conversationId) return;

    const userMessage: AgentMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      createdAt: Date.now(),
      content: text,
    };
    const pendingMessage: AgentMessage = {
      id: LOCAL_PENDING_ID,
      role: 'agent',
      createdAt: Date.now(),
      logs: [],
      status: 'pending',
    };

    setActive((prev) =>
      prev && prev.id === conversationId
        ? { ...prev, messages: [...prev.messages, userMessage, pendingMessage] }
        : prev
    );
    setBusy(true);

    try {
      await api(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ prompt: text }),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setActive((prev) => {
        if (!prev || prev.id !== conversationId) return prev;
        return {
          ...prev,
          messages: prev.messages.map((m) =>
            m.id === LOCAL_PENDING_ID ? { ...m, status: 'error', content: message } : m
          ),
        };
      });
      setBusy(false);
    }
  }, []);

  const stopGeneration = useCallback(async () => {
    const conversationId = activeIdRef.current;
    if (!conversationId) return;
    try {
      await api(`/api/conversations/${conversationId}/stop`, { method: 'POST' });
    } catch {
      // se ja tiver terminado sozinho entre o clique e a chamada, ignora
    }
  }, []);

  // Bootstrap: carrega status + lista de conversas, abre a mais recente (se houver).
  useEffect(() => {
    (async () => {
      try {
        const [statusData, list] = await Promise.all([api<StatusResponse>('/api/status'), refreshList()]);
        setStatus(statusData);
        setBusy(statusData.busy);

        if (list.length > 0) {
          await openConversation(list[0].id);
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Conexao SSE global — atualiza a conversa ativa em tempo real.
  useEffect(() => {
    const source = new EventSource('/api/events');

    source.addEventListener('message', (ev) => {
      const data = JSON.parse(ev.data);
      if (data.type !== 'agent-start' || data.conversationId !== activeIdRef.current) return;
      setActive((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.map((m) => (m.id === LOCAL_PENDING_ID ? { ...m, id: data.messageId } : m)),
        };
      });
    });

    source.addEventListener('log', (ev) => {
      const data = JSON.parse(ev.data);
      if (data.conversationId !== activeIdRef.current) return;
      setActive((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.map((m) =>
            m.id === data.messageId ? { ...m, logs: [...(m.logs || []), data.line] } : m
          ),
        };
      });
    });

    const finalize = (status: 'done' | 'error' | 'stopped') => (ev: MessageEvent) => {
      const data = JSON.parse(ev.data);
      setBusy(false);
      refreshList();
      if (data.conversationId !== activeIdRef.current) return;
      setActive((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.map((m) =>
            m.id === data.messageId || m.id === LOCAL_PENDING_ID
              ? { ...m, id: data.messageId, status, content: data.content, pagesUrl: data.pagesUrl }
              : m
          ),
        };
      });
    };

    source.addEventListener('done', finalize('done'));
    source.addEventListener('error', finalize('error'));
    source.addEventListener('stopped', finalize('stopped'));

    return () => source.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshList]);

  return {
    conversations,
    active,
    activeId,
    status,
    busy,
    loading,
    openConversation,
    createProject,
    renameChat,
    deleteChat,
    sendMessage,
    stopGeneration,
  };
}

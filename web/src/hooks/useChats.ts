import { useCallback, useEffect, useRef, useState } from 'react';
import type { Chat, ChatSummary, ChatTurn, GroqModelInfo } from '@/types';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data as T;
}

export function useChats() {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<Chat | null>(null);
  const [models, setModels] = useState<GroqModelInfo[]>([]);
  const [defaultModel, setDefaultModel] = useState('openai/gpt-oss-120b');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const activeIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const refreshList = useCallback(async () => {
    const list = await api<ChatSummary[]>('/api/chats');
    setChats(list);
    return list;
  }, []);

  const openChat = useCallback(async (id: string) => {
    const chat = await api<Chat>(`/api/chats/${id}`);
    setActiveId(id);
    setActive(chat);
  }, []);

  const createChat = useCallback(async () => {
    const chat = await api<Chat>('/api/chats', { method: 'POST', body: JSON.stringify({ model: defaultModel }) });
    setChats((prev) => [
      { id: chat.id, title: chat.title, model: chat.model, createdAt: chat.createdAt, updatedAt: chat.updatedAt },
      ...prev,
    ]);
    setActiveId(chat.id);
    setActive(chat);
    return chat;
  }, [defaultModel]);

  const renameChatItem = useCallback(
    async (id: string, title: string) => {
      await api(`/api/chats/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) });
      await refreshList();
      setActive((prev) => (prev && prev.id === id ? { ...prev, title } : prev));
    },
    [refreshList]
  );

  const changeModel = useCallback(async (id: string, model: string) => {
    await api(`/api/chats/${id}`, { method: 'PATCH', body: JSON.stringify({ model }) });
    setActive((prev) => (prev && prev.id === id ? { ...prev, model } : prev));
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, model } : c)));
  }, []);

  const deleteChatItem = useCallback(
    async (id: string) => {
      await api(`/api/chats/${id}`, { method: 'DELETE' });
      const list = await refreshList();
      if (activeIdRef.current === id) {
        if (list.length > 0) {
          await openChat(list[0].id);
        } else {
          setActiveId(null);
          setActive(null);
        }
      }
    },
    [refreshList, openChat]
  );

  const sendMessage = useCallback(async (text: string) => {
    const chatId = activeIdRef.current;
    if (!chatId) return;

    const userTurn: ChatTurn = { id: crypto.randomUUID(), role: 'user', content: text, createdAt: Date.now() };
    setActive((prev) => (prev && prev.id === chatId ? { ...prev, turns: [...prev.turns, userTurn] } : prev));
    setSending(true);

    try {
      const { turn } = await api<{ turn: ChatTurn }>(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: text }),
      });
      setActive((prev) => (prev && prev.id === chatId ? { ...prev, turns: [...prev.turns, turn] } : prev));
      refreshList();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const errorTurn: ChatTurn = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Deu erro: ${message}`,
        createdAt: Date.now(),
      };
      setActive((prev) => (prev && prev.id === chatId ? { ...prev, turns: [...prev.turns, errorTurn] } : prev));
    } finally {
      setSending(false);
    }
  }, [refreshList]);

  useEffect(() => {
    (async () => {
      try {
        const [modelsData, list] = await Promise.all([
          api<{ models: GroqModelInfo[]; defaultModel: string }>('/api/groq-models'),
          refreshList(),
        ]);
        setModels(modelsData.models);
        setDefaultModel(modelsData.defaultModel);
        if (list.length > 0) await openChat(list[0].id);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    chats,
    active,
    activeId,
    models,
    defaultModel,
    sending,
    loading,
    openChat,
    createChat,
    renameChatItem,
    deleteChatItem,
    changeModel,
    sendMessage,
  };
}

export type MessageStatus = 'pending' | 'done' | 'error' | 'stopped';

export interface RepoRef {
  owner: string;
  name: string;
  branch: string;
  htmlUrl: string;
  pagesUrl: string;
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'agent';
  createdAt: number;
  content?: string;
  logs?: string[];
  status?: MessageStatus;
  pagesUrl?: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  repo: RepoRef;
  createdAt: number;
  updatedAt: number;
}

export interface Conversation extends ConversationSummary {
  messages: AgentMessage[];
}

export interface StatusResponse {
  busy: boolean;
  agentName: string;
  model: string;
  authorName: string;
  githubOwner: string | null;
  groqChatAvailable: boolean;
  webSearchAvailable: boolean;
}

export interface ChatSource {
  title: string;
  url: string;
}

export interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  sources?: ChatSource[];
}

export interface ChatSummary {
  id: string;
  title: string;
  model: string;
  createdAt: number;
  updatedAt: number;
}

export interface Chat extends ChatSummary {
  turns: ChatTurn[];
}

export interface GroqModelInfo {
  id: string;
  name: string;
  contextWindow: number;
}

import { config } from './config.js';

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
}

const MAX_CONTENT_CHARS = 800; // mantem o resultado enxuto o suficiente pra nao estourar TPM

export async function webSearch(query: string, maxResults = 5): Promise<WebSearchResult[]> {
  if (!config.tavilyApiKey) {
    throw new Error('TAVILY_API_KEY nao configurada.');
  }

  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.tavilyApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      search_depth: 'basic',
      max_results: maxResults,
      include_answer: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Busca na web falhou (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { results: { title: string; url: string; content: string }[] };

  return data.results.map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content.length > MAX_CONTENT_CHARS ? r.content.slice(0, MAX_CONTENT_CHARS) + '…' : r.content,
  }));
}

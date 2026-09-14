import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Renderiza markdown (titulos, listas, tabelas, negrito, codigo) com o visual da Lumen AI. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown-body text-[15px] leading-relaxed text-gray-300">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-lg font-semibold text-gray-100 mt-4 mb-2 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-semibold text-gray-100 mt-4 mb-2 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="text-[15px] font-semibold text-gray-100 mt-3 mb-1.5 first:mt-0">{children}</h3>,
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-gray-100">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-lumen-400 hover:underline">
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="mb-3 ml-5 list-disc space-y-1 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 ml-5 list-decimal space-y-1 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-2 border-lumen-500/40 pl-3 text-gray-400 italic last:mb-0">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-4 border-gray-800" />,
          code: ({ className, children, ...props }) => {
            const isBlock = /language-/.test(className || '');
            if (isBlock) {
              return (
                <code className={`block overflow-x-auto rounded-lg bg-gray-900 border border-gray-800 p-3 font-mono text-[13px] text-gray-200 ${className || ''}`} {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-[13px] text-lumen-300" {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="mb-3 last:mb-0">{children}</pre>,
          table: ({ children }) => (
            <div className="mb-3 overflow-x-auto last:mb-0">
              <table className="w-full border-collapse text-left text-[13px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="border-b border-gray-700">{children}</thead>,
          th: ({ children }) => <th className="px-2.5 py-1.5 font-semibold text-gray-200">{children}</th>,
          td: ({ children }) => <td className="border-t border-gray-800 px-2.5 py-1.5 align-top">{children}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

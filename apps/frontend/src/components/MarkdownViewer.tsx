import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownViewerProps {
  value: string
  label: string
}

export function MarkdownViewer({ value, label }: MarkdownViewerProps) {
  if (!value.trim()) {
    return (
      <div
        role="region"
        aria-label={label}
        className="min-h-48 rounded border border-border-subtle bg-surface-muted p-4 text-sm text-text-muted"
      >
        Nothing to preview yet.
      </div>
    )
  }

  return (
    <div
      role="region"
      aria-label={label}
      className="min-h-48 rounded border border-border-subtle bg-surface-default p-4 text-text-primary prose prose-slate max-w-none"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={defaultUrlTransform}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          img: ({ alt }) => <span role="img" aria-label={alt || 'Image'}>[Image: {alt || 'untitled'}]</span>,
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  )
}

import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownViewerProps {
  value: string
  label: string
  emptyMessage?: string
  labelledBy?: string
}

export function MarkdownViewer({
  value,
  label,
  emptyMessage = 'Nothing to preview yet.',
  labelledBy,
}: MarkdownViewerProps) {
  const accessibleNameProps = labelledBy
    ? { 'aria-labelledby': labelledBy }
    : { 'aria-label': label }

  if (!value.trim()) {
    return (
      <div
        role="region"
        {...accessibleNameProps}
        className="min-h-48 overflow-x-auto break-words rounded border border-border-subtle bg-surface-muted p-4 text-sm text-text-muted"
      >
        {emptyMessage}
      </div>
    )
  }

  return (
    <div
      role="region"
      {...accessibleNameProps}
      className="min-h-48 overflow-x-auto break-words rounded border border-border-subtle bg-surface-default p-4 text-text-primary prose prose-slate max-w-none"
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

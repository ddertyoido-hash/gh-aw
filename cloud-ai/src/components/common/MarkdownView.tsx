/**
 * Markdown renderer for model output: GitHub-flavoured markdown, syntax
 * highlighted code with a per-block copy button, and safe defaults for links.
 */
import { useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Check, Copy } from 'lucide-react'
import { copyText } from '../../lib/utils'

interface MarkdownViewProps {
  content: string
  className?: string
}

export function MarkdownView({ content, className }: MarkdownViewProps) {
  return (
    <div className={className ?? 'markdown'}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false)
  const text = extractText(children)

  return (
    <div className="group relative">
      <pre>{children}</pre>
      <button
        type="button"
        onClick={async () => {
          const ok = await copyText(text)
          if (!ok) return
          setCopied(true)
          setTimeout(() => setCopied(false), 1800)
        }}
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg border border-white/20 bg-slate-950/60 px-2 py-1 text-[11.5px] text-slate-200 opacity-0 transition group-hover:opacity-100 focus-ring"
        aria-label="Copy code"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

function extractText(node: ReactNode): string {
  if (node === null || node === undefined || node === false) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  const element = node as { props?: { children?: ReactNode } }
  if (element.props?.children !== undefined) return extractText(element.props.children)
  return ''
}

import { parseIrcFormatting, splitUrls } from '../../../shared/irc-format'

interface Props {
  text: string
  onOpenUrl?: (url: string) => void
}

function spanClass(span: {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  reverse?: boolean
  fg?: number
  bg?: number
}): string {
  const parts = ['fmt']
  if (span.bold) parts.push('fmt-b')
  if (span.italic) parts.push('fmt-i')
  if (span.underline) parts.push('fmt-u')
  if (span.strikethrough) parts.push('fmt-s')
  if (span.reverse) parts.push('fmt-r')
  if (span.fg !== undefined) parts.push(`fg-${span.fg % 16}`)
  if (span.bg !== undefined) parts.push(`bg-${span.bg % 16}`)
  return parts.join(' ')
}

/** Render IRC formatting codes as styled spans — never HTML injection. */
export function FormattedText({ text, onOpenUrl }: Props): React.JSX.Element {
  // ACTION CTCP display
  if (text.startsWith('\x01ACTION ') && text.endsWith('\x01')) {
    const body = text.slice(8, -1)
    return (
      <span className="action">
        <FormattedText text={body} onOpenUrl={onOpenUrl} />
      </span>
    )
  }

  const spans = parseIrcFormatting(text)
  return (
    <>
      {spans.map((span, i) => {
        const pieces = splitUrls(span.text)
        return (
          <span key={i} className={spanClass(span)}>
            {pieces.map((p, j) =>
              p.type === 'url' ? (
                <button
                  key={j}
                  type="button"
                  className="msg-link"
                  onClick={() => onOpenUrl?.(p.value)}
                  title={p.value}
                >
                  {p.value}
                </button>
              ) : (
                <span key={j}>{p.value}</span>
              )
            )}
          </span>
        )
      })}
    </>
  )
}

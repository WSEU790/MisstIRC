import { useEffect, useRef, useState } from 'react'
import type { IrcMessageView } from '../../../shared/types'
import { FormattedText } from './FormattedText'

interface Props {
  title: string
  topic?: string
  nick: string
  messages: IrcMessageView[]
  nicks: string[]
  connectionId: string
  buffer: string
  onSend: (text: string) => void
  onTopic?: (topic: string) => void
  disabled?: boolean
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

export function Conversation({
  title,
  topic,
  nick,
  messages,
  nicks,
  connectionId,
  buffer,
  onSend,
  onTopic,
  disabled
}: Props): React.JSX.Element {
  const [text, setText] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const [completions, setCompletions] = useState<string[]>([])
  const [compIdx, setCompIdx] = useState(0)
  const [compPrefix, setCompPrefix] = useState('')
  const [compStart, setCompStart] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  function submit(): void {
    const value = text
    if (!value.trim()) return
    onSend(value)
    setHistory((h) => [...h.slice(-99), value])
    setHistIdx(-1)
    setText('')
    setCompletions([])
  }

  async function completeNick(): Promise<void> {
    const input = inputRef.current
    if (!input) return
    const caret = input.selectionStart ?? text.length

    let list = completions
    let start = compStart
    let prefix = compPrefix

    if (!list.length) {
      const before = text.slice(0, caret)
      const match = before.match(/(\S+)$/)
      prefix = match?.[1] ?? ''
      if (!prefix || prefix.startsWith('/')) return
      start = caret - prefix.length
      list = await window.misstirc.getCompletions(connectionId, buffer, prefix)
      if (!list.length) {
        list = nicks.filter((n) => n.toLowerCase().startsWith(prefix.toLowerCase()))
      }
      setCompletions(list)
      setCompPrefix(prefix)
      setCompStart(start)
      setCompIdx(0)
    }
    if (!list.length) return

    const idx = list.length ? compIdx % list.length : 0
    const pick = list[idx]!
    const suffix = start === 0 ? ': ' : ' '
    // Replace from original prefix start through current caret/word end
    const afterCaret = text.slice(caret).replace(/^\S+\s?/, '')
    const next = text.slice(0, start) + pick + suffix + afterCaret
    setText(next)
    setCompIdx((idx + 1) % list.length)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Tab') {
      e.preventDefault()
      void completeNick()
      return
    }
    if (e.key !== 'Tab') {
      setCompletions([])
      setCompPrefix('')
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!history.length) return
      const next = histIdx < 0 ? history.length - 1 : Math.max(0, histIdx - 1)
      setHistIdx(next)
      setText(history[next] ?? '')
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (histIdx < 0) return
      const next = histIdx + 1
      if (next >= history.length) {
        setHistIdx(-1)
        setText('')
      } else {
        setHistIdx(next)
        setText(history[next] ?? '')
      }
    }
  }

  return (
    <section className="conversation">
      <div className="buffer-header">
        <h1>{title}</h1>
        {topic !== undefined ? (
          <div
            className="topic"
            title="Double-click to set topic"
            onDoubleClick={() => {
              if (!onTopic) return
              const next = window.prompt('Set topic', topic)
              if (next !== null) onTopic(next)
            }}
          >
            <FormattedText text={topic || '(no topic)'} />
          </div>
        ) : null}
      </div>
      <div className="messages" role="log" aria-live="polite">
        {messages.length === 0 ? (
          <div style={{ color: 'var(--text-dim)' }}>No messages yet. Try /join #channel</div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`msg ${m.kind}`}>
              <span className="time">{formatTime(m.timestamp)}</span>
              <span className={`nick${m.nick === nick ? '' : ' other'}`}>
                {m.kind === 'privmsg' || m.kind === 'notice' ? m.nick ?? '' : '—'}
              </span>
              <span className="body">
                {m.kind === 'notice' ? (
                  <>
                    -{m.nick}- <FormattedText text={m.text} />
                  </>
                ) : m.kind === 'privmsg' && m.text.startsWith('\x01ACTION ') ? (
                  <>
                    * {m.nick} <FormattedText text={m.text} />
                  </>
                ) : (
                  <FormattedText text={m.text} />
                )}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <div className="composer">
        <input
          ref={inputRef}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={disabled ? 'Connecting…' : 'Message, /command, Tab to complete nicks'}
          aria-label="Message input"
          autoFocus
        />
        <button type="button" className="btn btn-primary" disabled={disabled} onClick={submit}>
          Send
        </button>
      </div>
    </section>
  )
}

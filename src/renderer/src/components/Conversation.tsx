import { useEffect, useRef, useState } from 'react'
import type { IrcMessageView } from '../../../shared/types'

interface Props {
  title: string
  topic?: string
  nick: string
  messages: IrcMessageView[]
  onSend: (text: string) => void
  disabled?: boolean
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function Conversation({
  title,
  topic,
  nick,
  messages,
  onSend,
  disabled
}: Props): React.JSX.Element {
  const [text, setText] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const bottomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

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
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
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
        {topic ? <div className="topic">{topic}</div> : null}
      </div>
      <div className="messages" ref={listRef} role="log" aria-live="polite">
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
                {m.kind === 'notice' ? `-${m.nick}- ${m.text}` : m.text}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <div className="composer">
        <input
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={disabled ? 'Connecting…' : 'Message or /command'}
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

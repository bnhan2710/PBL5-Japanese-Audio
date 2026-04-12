import { useMemo, useRef, useState } from 'react'
import { Bot, Copy, MessageCircle, Send, X } from 'lucide-react'

import { apiFetch } from '@/lib/apiClient'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

function renderBoldMarkdown(text: string) {
  const lines = text.split('\n')
  return lines.map((line, lineIndex) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g)
    return (
      <span key={`line-${lineIndex}`}>
        {parts.map((part, partIndex) => {
          const isBold = part.startsWith('**') && part.endsWith('**') && part.length > 4
          if (isBold) {
            return <strong key={`part-${partIndex}`}>{part.slice(2, -2)}</strong>
          }
          return <span key={`part-${partIndex}`}>{part}</span>
        })}
        {lineIndex < lines.length - 1 && <br />}
      </span>
    )
  })
}

export function AIChatWidget() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Xin chào, mình là trợ lý AI (LM Studio Gemma 4). Bạn có thể dán nội dung hoặc gõ yêu cầu để mình hỗ trợ.',
    },
  ])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const messagesBoxRef = useRef<HTMLDivElement>(null)

  const canSend = input.trim().length > 0 && !sending

  const requestMessages = useMemo(
    () => messages.map((item) => ({ role: item.role, content: item.content })),
    [messages]
  )

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (messagesBoxRef.current) {
        messagesBoxRef.current.scrollTop = messagesBoxRef.current.scrollHeight
      }
    })
  }

  const sendMessage = async () => {
    const prompt = input.trim()
    if (!prompt || sending) return

    setError('')
    setSending(true)
    setInput('')

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: prompt }]
    setMessages(nextMessages)
    scrollToBottom()

    try {
      const response = await apiFetch(`${API_BASE}/api/ai-chat/completions`, {
        method: 'POST',
        body: JSON.stringify({
          messages: nextMessages,
          temperature: 0.7,
        }),
      })

      if (!response.ok) {
        const detail = await response.json().catch(() => ({ detail: 'Chat failed' }))
        throw new Error(detail.detail || 'Chat failed')
      }

      const data = await response.json()
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply || '' }])
      scrollToBottom()
    } catch (err: any) {
      setError(err?.message || 'Không thể kết nối AI chat. Hãy kiểm tra LM Studio đang chạy.')
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Mình chưa thể trả lời lúc này vì kết nối LM Studio lỗi. Bạn thử lại sau nhé.',
        },
      ])
      scrollToBottom()
    } finally {
      setSending(false)
    }
  }

  const handleCopy = async (content: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 1200)
    } catch {
      // no-op
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="fixed right-5 bottom-5 z-[900]">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="h-14 w-14 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-xl hover:scale-105 transition-transform flex items-center justify-center"
          title="Mở AI Chat"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      ) : (
        <div className="w-[360px] max-w-[calc(100vw-24px)] h-[560px] max-h-[80vh] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white flex items-center justify-center">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">AI Chat</p>
                <p className="text-[11px] text-muted-foreground">LM Studio • Gemma 4</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={messagesBoxRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-background">
            {messages.map((message, idx) => (
              <div key={idx} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[88%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground border border-border'
                  }`}
                >
                  {renderBoldMarkdown(message.content)}
                  {message.role === 'assistant' && (
                    <div className="mt-2 pt-2 border-t border-border/60 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleCopy(message.content, idx)}
                        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="h-3 w-3" />
                        {copiedIdx === idx ? 'Đã copy' : 'Copy'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="max-w-[88%] rounded-xl px-3 py-2 text-sm bg-muted text-muted-foreground border border-border">
                  AI đang trả lời...
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border p-3 bg-card">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={3}
              placeholder="Dán nội dung hoặc nhập câu hỏi..."
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-blue-500"
            />
            {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={sendMessage}
                disabled={!canSend}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                <Send className="h-3.5 w-3.5" /> Gửi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

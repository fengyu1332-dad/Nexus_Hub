'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Flower2, Send, X, Minimize2, Maximize2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDict } from '@/components/I18nProvider'

// ── Types ──────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'flora'
  content: string
  timestamp: number
  sources?: { title: string; postId: string; subredditName?: string; similarity: number }[]
}

// ── Sub-components ────────────────────────────────────────

function ChatBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'

  return (
    <div className={cn('flex gap-2 mb-3', isUser && 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
          isUser
            ? 'bg-zinc-200 text-zinc-600'
            : 'bg-gradient-to-br from-rose-400 to-pink-500 text-white'
        )}>
        {isUser ? dict.flora.me : <Flower2 className='h-3.5 w-3.5' />}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
          isUser
            ? 'bg-zinc-900 text-white rounded-tr-sm'
            : 'bg-rose-50 text-zinc-800 rounded-tl-sm border border-rose-100'
        )}>
        {msg.content}

        {/* Sources */}
        {msg.sources && msg.sources.length > 0 && (
          <div className='mt-3 pt-2.5 border-t border-rose-200/50'>
            <p className='text-[10px] text-rose-400 font-medium mb-2 uppercase tracking-wide'>
              {dict.flora.sources}
            </p>
            {msg.sources.slice(0, 2).map((s) => (
              <a
                key={s.postId}
                href={`/r/${s.subredditName || 'DevShowcase'}/post/${s.postId}`}
                target='_blank'
                rel='noopener'
                className='block mb-1.5 rounded-lg border border-rose-200 bg-white/60 px-3 py-2 hover:bg-white hover:border-rose-300 hover:shadow-sm transition-all group'>
                <p className='text-xs font-medium text-zinc-700 group-hover:text-rose-600 truncate leading-snug'>
                  {s.title}
                </p>
                <span className='text-[10px] text-rose-400 group-hover:text-rose-500'>
                  {dict.flora.readMore}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────

export function FloraChat() {
  const dict = useDict()
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: 'welcome',
      role: 'flora',
      content: dict.flora.welcomeMessage,
      timestamp: Date.now(),
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on open
  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus()
    }
  }, [isOpen, isMinimized])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isLoading) return

    const userMsg: Message = {
      id: 'u-' + Date.now(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }

    // Build history from last 5 rounds (10 messages), excluding welcome
    const history = messages
      .filter((m) => m.id !== 'welcome')
      .slice(-10)
      .map((m) => ({
        role: m.role,
        content: m.content.substring(0, 1000),
      }))

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      })

      const data = await res.json()

      const floraMsg: Message = {
        id: 'f-' + Date.now(),
        role: 'flora',
        content: data.reply || dict.flora.errorReply,
        timestamp: Date.now(),
        sources: data.sources,
      }

      setMessages((prev) => [...prev, floraMsg])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: 'f-' + Date.now(),
          role: 'flora',
          content: dict.flora.networkError,
          timestamp: Date.now(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ── Closed state: floating button ───────────────────────
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className='fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 text-white shadow-lg shadow-rose-200 hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center justify-center group'
        title={dict.flora.title}>
        <Flower2 className='h-6 w-6 group-hover:animate-bounce' />
        {/* Unread dot */}
        <span className='absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-white animate-pulse' />
      </button>
    )
  }

  // ── Open state: chat panel ──────────────────────────────
  return (
    <div
      className={cn(
        'fixed bottom-5 right-5 z-50 flex flex-col bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden transition-all duration-300',
        isMinimized ? 'w-72 h-14' : 'w-[380px] h-[560px] max-h-[calc(100vh-40px)]'
      )}>
      {/* ── Header ─────────────────────────────────────── */}
      <div className='flex-shrink-0 flex items-center justify-between px-4 py-3 bg-gradient-to-r from-rose-400 to-pink-500 text-white'>
        <div className='flex items-center gap-2.5'>
          <div className='w-8 h-8 rounded-full bg-white/20 flex items-center justify-center'>
            <Flower2 className='h-4 w-4' />
          </div>
          <div>
            <p className='text-sm font-semibold leading-tight'>{dict.flora.name}</p>
            <p className='text-[10px] text-white/70 leading-tight'>
              {isLoading ? dict.flora.typing : dict.flora.online}
            </p>
          </div>
        </div>

        <div className='flex items-center gap-1'>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className='p-1.5 rounded-lg hover:bg-white/20 transition-colors'
            title={isMinimized ? dict.flora.expand : dict.flora.collapse}>
            {isMinimized ? (
              <Maximize2 className='h-3.5 w-3.5' />
            ) : (
              <Minimize2 className='h-3.5 w-3.5' />
            )}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className='p-1.5 rounded-lg hover:bg-white/20 transition-colors'
            title={dict.flora.close}>
            <X className='h-3.5 w-3.5' />
          </button>
        </div>
      </div>

      {/* ── Messages ────────────────────────────────────── */}
      {!isMinimized && (
        <>
          <div className='flex-1 overflow-y-auto px-3 py-4 bg-zinc-50/50'>
            {messages.map((msg) => (
              <ChatBubble key={msg.id} msg={msg} />
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className='flex items-center gap-2 mb-3'>
                <div className='w-7 h-7 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center'>
                  <Flower2 className='h-3.5 w-3.5 text-white' />
                </div>
                <div className='bg-rose-50 rounded-2xl rounded-tl-sm px-4 py-2.5 border border-rose-100'>
                  <div className='flex gap-1'>
                    <span className='w-2 h-2 rounded-full bg-rose-300 animate-bounce' style={{ animationDelay: '0ms' }} />
                    <span className='w-2 h-2 rounded-full bg-rose-300 animate-bounce' style={{ animationDelay: '150ms' }} />
                    <span className='w-2 h-2 rounded-full bg-rose-300 animate-bounce' style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Input ──────────────────────────────────── */}
          <div className='flex-shrink-0 border-t border-zinc-100 p-3 bg-white'>
            <div className='flex gap-2'>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={dict.flora.placeholder}
                rows={1}
                disabled={isLoading}
                className='flex-1 resize-none rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300 disabled:opacity-50 placeholder:text-zinc-400'
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className='flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-r from-rose-400 to-pink-500 text-white flex items-center justify-center hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all'>
                {isLoading ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                  <Send className='h-4 w-4' />
                )}
              </button>
            </div>
            <p className='text-[10px] text-zinc-400 mt-1.5 text-center'>
              {dict.flora.footer}
            </p>
          </div>
        </>
      )}
    </div>
  )
}

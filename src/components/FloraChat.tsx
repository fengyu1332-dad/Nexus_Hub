'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Flower2, Send, X, Minimize2, Maximize2, Loader2, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Dictionary } from '@/i18n/types'

// ── Types ──────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'flora'
  content: string
  timestamp: number
  sources?: { title: string; postId: string; subredditName?: string; similarity: number }[]
}

interface SourceItem {
  title: string
  postId: string
  subredditName?: string
  similarity: number
}

// ── Sub-components ────────────────────────────────────────

function ChatBubble({
  msg,
  dict,
  isStreaming,
}: {
  msg: Message
  dict: any
  isStreaming?: boolean
}) {
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
            : 'bg-rose-50 text-zinc-800 rounded-tl-sm border border-rose-100',
          isStreaming && 'animate-pulse'
        )}>
        {msg.content}
        {isStreaming && (
          <span className='inline-block w-1.5 h-4 bg-rose-400 ml-0.5 animate-pulse rounded-sm' />
        )}

        {/* Sources */}
        {!isStreaming && msg.sources && msg.sources.length > 0 && (
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

export function FloraChat({ dict }: { dict: Dictionary }) {
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
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [streamingSources, setStreamingSources] = useState<SourceItem[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Auto-scroll on new messages or streaming content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // Focus input on open
  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus()
    }
  }, [isOpen, isMinimized])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return

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
    setIsStreaming(true)
    setStreamingContent('')
    setStreamingSources([])

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
        signal: controller.signal,
      })

      // 非流式回退
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('text/event-stream')) {
        const data = await res.json()
        setIsStreaming(false)
        setMessages((prev) => [
          ...prev,
          {
            id: 'f-' + Date.now(),
            role: 'flora',
            content: data.reply || dict.flora.errorReply,
            timestamp: Date.now(),
            sources: data.sources,
          },
        ])
        return
      }

      // 流式读取
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let sources: SourceItem[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data:')) continue

          const data = trimmed.slice(5).trim()
          if (data === '[DONE]') {
            // Stream complete — push final message
            setIsStreaming(false)
            setStreamingContent((prev) => {
              setMessages((prevMsgs) => [
                ...prevMsgs,
                {
                  id: 'f-' + Date.now(),
                  role: 'flora',
                  content: prev,
                  timestamp: Date.now(),
                  sources,
                },
              ])
              return ''
            })
            setStreamingSources([])
            return
          }

          try {
            const parsed = JSON.parse(data)
            if (parsed.type === 'sources') {
              sources = parsed.data || []
              setStreamingSources(sources)
            } else if (parsed.type === 'delta' && parsed.content) {
              setStreamingContent((prev) => prev + parsed.content)
            }
          } catch {
            // skip unparseable frames
          }
        }
      }

      // Stream ended without [DONE] — push whatever we got
      setIsStreaming(false)
      setStreamingContent((prev) => {
        if (prev) {
          setMessages((prevMsgs) => [
            ...prevMsgs,
            {
              id: 'f-' + Date.now(),
              role: 'flora',
              content: prev,
              timestamp: Date.now(),
              sources,
            },
          ])
        }
        return ''
      })
      setStreamingSources([])
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // User stopped — save partial content
        setIsStreaming(false)
        setStreamingContent((prev) => {
          if (prev) {
            setMessages((prevMsgs) => [
              ...prevMsgs,
              {
                id: 'f-' + Date.now(),
                role: 'flora',
                content: prev,
                timestamp: Date.now(),
                sources: [],
              },
            ])
          }
          return ''
        })
        return
      }
      setIsStreaming(false)
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
      abortRef.current = null
    }
  }, [input, isStreaming, messages, dict])

  const stopGenerating = useCallback(() => {
    abortRef.current?.abort()
  }, [])

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
        className='fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 text-white shadow-lg shadow-rose-200 hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center justify-center group max-sm:bottom-4 max-sm:right-4 max-sm:w-12 max-sm:h-12'
        title={dict.flora.title}>
        <Flower2 className='h-6 w-6 max-sm:h-5 max-sm:w-5 group-hover:animate-bounce' />
        {/* Unread dot */}
        <span className='absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-white animate-pulse' />
      </button>
    )
  }

  // ── Open state: chat panel ──────────────────────────────
  return (
    <div
      className={cn(
        'fixed z-50 flex flex-col bg-white shadow-2xl border border-zinc-200 overflow-hidden transition-all duration-300',
        // Desktop sizing
        'bottom-5 right-5 rounded-2xl',
        isMinimized
          ? 'w-72 h-14'
          : 'w-[380px] h-[560px] max-h-[calc(100vh-40px)]',
        // Mobile sizing — fullscreen when expanded, bottom bar when minimized
        !isMinimized && 'max-sm:inset-0 max-sm:rounded-none max-sm:w-full max-sm:h-full max-sm:max-h-none',
        isMinimized && 'max-sm:inset-x-2 max-sm:bottom-2 max-sm:w-auto max-sm:h-12 max-sm:rounded-xl'
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
              {isStreaming ? dict.flora.streaming : dict.flora.online}
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
              <ChatBubble key={msg.id} msg={msg} dict={dict} />
            ))}

            {/* Streaming bubble */}
            {isStreaming && streamingContent && (
              <ChatBubble
                msg={{
                  id: 'streaming',
                  role: 'flora',
                  content: streamingContent,
                  timestamp: Date.now(),
                  sources: streamingSources,
                }}
                dict={dict}
                isStreaming
              />
            )}

            {/* Loading indicator (before first token) */}
            {isStreaming && !streamingContent && (
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
                disabled={isStreaming}
                className='flex-1 resize-none rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300 disabled:opacity-50 placeholder:text-zinc-400'
              />
              {isStreaming ? (
                <button
                  onClick={stopGenerating}
                  title={dict.flora.stopGenerating}
                  className='flex-shrink-0 w-9 h-9 rounded-xl bg-zinc-500 text-white flex items-center justify-center hover:bg-zinc-600 hover:shadow-md transition-all'>
                  <Square className='h-3.5 w-3.5' />
                </button>
              ) : (
                <button
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  className='flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-r from-rose-400 to-pink-500 text-white flex items-center justify-center hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all'>
                  <Send className='h-4 w-4' />
                </button>
              )}
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

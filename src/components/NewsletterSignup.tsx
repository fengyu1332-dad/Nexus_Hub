'use client'

import { useState } from 'react'
import { Mail, CheckCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function NewsletterSignup({ className }: { className?: string }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setStatus('loading')
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus('success')
        setMessage(data.message)
        setEmail('')
      } else {
        setStatus('error')
        setMessage(data.message)
      }
    } catch {
      setStatus('error')
      setMessage('网络错误，请稍后重试')
    }
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-6 shadow-sm',
        className
      )}>
      <div className='flex items-center gap-2 mb-3'>
        <div className='w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center'>
          <Mail className='h-4 w-4 text-white' />
        </div>
        <h3 className='font-semibold text-zinc-800'>📬 The Architect 每周学术快报</h3>
      </div>

      <p className='text-sm text-zinc-500 mb-4'>
        每周日早上，AI 自动汇总本周 Owl 情报雷达抓取的所有高优资讯，生成精美周报直达你的邮箱。
      </p>

      {status === 'success' ? (
        <div className='flex items-center gap-2 text-emerald-600 bg-emerald-50 rounded-lg px-4 py-3 text-sm'>
          <CheckCircle className='h-4 w-4 flex-shrink-0' />
          <span>{message}</span>
        </div>
      ) : (
        <form onSubmit={handleSubscribe} className='flex gap-2'>
          <input
            type='email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder='your@email.com'
            required
            disabled={status === 'loading'}
            className='flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300 disabled:opacity-50'
          />
          <button
            type='submit'
            disabled={status === 'loading'}
            className='flex-shrink-0 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-medium text-white hover:shadow-md disabled:opacity-50 transition-all'>
            {status === 'loading' ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              '订阅'
            )}
          </button>
        </form>
      )}

      {status === 'error' && (
        <p className='text-xs text-red-500 mt-2'>{message}</p>
      )}

      <p className='text-[10px] text-zinc-400 mt-3'>
        每周一封，绝不骚扰 · 可随时退订 · 由 The Architect 自动生成
      </p>
    </div>
  )
}

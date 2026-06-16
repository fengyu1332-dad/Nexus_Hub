'use client'

import { useState, useCallback } from 'react'

export interface AIWriteParams {
  text: string
  action: 'polish' | 'expand' | 'summarize'
  context?: string
  style?: 'academic' | 'casual' | 'professional'
  signal?: AbortSignal
}

export interface AIWriteResult {
  result: string
  action: string
  inputLength: number
  outputLength: number
}

export async function aiWrite(params: AIWriteParams): Promise<AIWriteResult> {
  const res = await fetch('/api/ai/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: params.text,
      action: params.action,
      context: params.context,
      style: params.style || 'academic',
    }),
    signal: params.signal,
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `AI write failed: ${res.status}`)
  }

  return res.json()
}

export function useAIWrite() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const write = useCallback(async (params: AIWriteParams): Promise<string> => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await aiWrite(params)
      return data.result
    } catch (err: any) {
      const msg = err?.message || 'AI write failed'
      setError(msg)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { write, isLoading, error, clearError: () => setError(null) }
}

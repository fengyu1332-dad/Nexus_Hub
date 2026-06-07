'use client'

import { useEffect, useRef } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

/**
 * Scans its children DOM for <span class="math-inline">...</span> elements
 * and renders them as inline KaTeX formulas.
 */
export function InlineMathProcessor({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const spans = ref.current.querySelectorAll('.math-inline')
    spans.forEach((span) => {
      try {
        katex.render(span.textContent || '', span as HTMLElement, {
          displayMode: false,
          throwOnError: false,
        })
      } catch {
        // Leave the original text if KaTeX fails
      }
    })
  }, [children])

  return <div ref={ref}>{children}</div>
}

'use client'

import { useEffect, useRef } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

function MathRenderer({ data }: any) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current && data.latex) {
      try {
        katex.render(data.latex, ref.current, {
          displayMode: true,
          throwOnError: false,
        })
      } catch {
        ref.current.textContent = data.latex
      }
    }
  }, [data.latex])

  return (
    <div
      ref={ref}
      className='my-4 overflow-x-auto rounded-lg bg-slate-50 p-4 text-center'
    />
  )
}

export default MathRenderer

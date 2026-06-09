'use client'

import { useDict } from '@/components/I18nProvider'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const dict = useDict()

  return (
    <div className='p-8 max-w-2xl mx-auto'>
      <h2 className='text-lg font-bold text-red-600 mb-4'>{dict.errorPage.heading}</h2>
      <pre className='bg-red-50 p-4 rounded text-sm overflow-auto'>
        {error.message}
        {error.digest && `\n\nDigest: ${error.digest}`}
        {error.stack && `\n\n${error.stack}`}
      </pre>
      <button
        onClick={reset}
        className='mt-4 px-4 py-2 bg-zinc-900 text-white rounded'>
        {dict.errorPage.retry}
      </button>
    </div>
  )
}

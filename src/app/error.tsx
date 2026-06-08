'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className='p-8 max-w-2xl mx-auto'>
      <h2 className='text-lg font-bold text-red-600 mb-4'>页面出错了</h2>
      <pre className='bg-red-50 p-4 rounded text-sm overflow-auto'>
        {error.message}
        {error.digest && `\n\nDigest: ${error.digest}`}
        {error.stack && `\n\n${error.stack}`}
      </pre>
      <button
        onClick={reset}
        className='mt-4 px-4 py-2 bg-zinc-900 text-white rounded'>
        重试
      </button>
    </div>
  )
}

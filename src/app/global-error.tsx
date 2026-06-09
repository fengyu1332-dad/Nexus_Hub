'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body className='min-h-screen flex items-center justify-center bg-white'>
        <div className='text-center max-w-md p-8'>
          <h1 className='text-xl font-bold text-red-600 mb-4'>Nexus Hub - 系统错误</h1>
          <p className='text-zinc-500 text-sm mb-4'>应用发生严重错误，请刷新页面重试。</p>
          {error.digest && (
            <p className='text-xs text-zinc-400 mb-4 font-mono'>Digest: {error.digest}</p>
          )}
          <button
            onClick={reset}
            className='px-4 py-2 bg-zinc-900 text-white rounded text-sm hover:bg-zinc-700'>
            重试
          </button>
        </div>
      </body>
    </html>
  )
}

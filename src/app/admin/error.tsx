'use client'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className='p-8 max-w-2xl mx-auto text-center'>
      <h2 className='text-lg font-bold text-red-600 mb-4'>管理后台出错</h2>
      <p className='text-zinc-500 text-sm mb-6'>页面渲染失败，请检查数据库连接后重试。</p>
      <pre className='bg-red-50 p-3 rounded text-xs overflow-auto text-red-500 mb-4'>
        {error.digest}
      </pre>
      <button
        onClick={reset}
        className='px-4 py-2 bg-zinc-900 text-white rounded text-sm hover:bg-zinc-700'>
        重试
      </button>
    </div>
  )
}

/**
 * 最简测试页 — 零 DB / 零 Auth
 */
export default function TestPage() {
  return (
    <div className='p-8'>
      <h1 className='text-2xl font-bold text-green-600'>✅ Vercel 部署正常</h1>
      <p className='mt-2 text-zinc-500'>
        DATABASE_URL: {process.env.DATABASE_URL ? '已配置 ✅' : '❌ 未配置'}
      </p>
      <p className='text-zinc-500'>
        NEXTAUTH_SECRET: {process.env.NEXTAUTH_SECRET ? '已配置 ✅' : '❌ 未配置'}
      </p>
      <p className='text-zinc-500'>
        DEEPSEEK_API_KEY: {process.env.DEEPSEEK_API_KEY ? '已配置 ✅' : '❌ 未配置'}
      </p>
      <p className='text-zinc-500 mt-4'>
        NEXT_PUBLIC_APP_URL: {process.env.NEXT_PUBLIC_APP_URL || '❌ 未配置'}
      </p>
    </div>
  )
}

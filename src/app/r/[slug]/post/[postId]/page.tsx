// ── ABSOLUTE MINIMAL post page — no DB, no imports, no metadata ──

export const dynamic = 'force-dynamic'

export default function SubRedditPostPage() {
  return (
    <div>
      <h1 className='text-xl font-semibold py-2'>Post Page (static debug)</h1>
      <p>No database queries, no metadata, no components. Testing bare route.</p>
    </div>
  )
}

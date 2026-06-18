import { getAdminSession } from '@/lib/auth-admin'
import { redirect } from 'next/navigation'
import { getDictionary } from '@/i18n'
import { PipelineExecutionsList } from '@/components/admin/PipelineExecutionsList'
import { PipelineStatusCards } from '@/components/admin/PipelineStatusCards'

export const dynamic = 'force-dynamic'

export default async function PipelinePage() {
  const session = await getAdminSession()
  if (!session) redirect('/')

  const dict = getDictionary()
  const d = dict.admin

  return (
    <div className='space-y-6'>
      <h1 className='text-3xl font-bold text-zinc-900'>{d.pipeline}</h1>

      {/* ── Success Rate Overview ──────────────────────────── */}
      <PipelineStatusCards />

      <section>
        <h2 className='text-lg font-semibold mb-3'>Recent Failures & Dead Letters</h2>
        <PipelineExecutionsList status='failed' limit={20} />
      </section>

      <section>
        <h2 className='text-lg font-semibold mb-3'>All Recent Executions</h2>
        <PipelineExecutionsList limit={30} />
      </section>
    </div>
  )
}

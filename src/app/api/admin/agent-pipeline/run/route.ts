import { getAdminSession } from '@/lib/auth-admin'
import { runContentPipeline } from '@/lib/agent-orchestrator'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { topic, sourceArticle } = body

    if (!topic || typeof topic !== 'string' || topic.trim().length < 3) {
      return NextResponse.json({ error: 'Topic must be at least 3 characters' }, { status: 400 })
    }

    const result = await runContentPipeline(topic.trim(), sourceArticle?.trim() || undefined)

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[agent-pipeline] Run error:', err)
    return NextResponse.json(
      { error: 'Pipeline failed: ' + (err.message || 'Unknown error') },
      { status: 500 }
    )
  }
}

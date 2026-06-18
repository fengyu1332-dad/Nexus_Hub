import { getAdminSession, adminUnauthorizedResponse } from '@/lib/auth-admin'
import { sendCuratedNewsletter, curateWeeklyDigest, renderDigestHtml } from '@/lib/newsletter-curator'

export const dynamic = 'force-dynamic'

// POST: 触发手动发送
export async function POST(req: Request) {
  const session = await getAdminSession()
  if (!session) return adminUnauthorizedResponse()

  try {
    const result = await sendCuratedNewsletter()
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: '发送失败: ' + (error instanceof Error ? error.message : String(error)) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// GET: 预览 HTML
export async function GET() {
  const session = await getAdminSession()
  if (!session) return adminUnauthorizedResponse()

  try {
    const digest = await curateWeeklyDigest()
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const html = renderDigestHtml(digest, baseUrl)

    return new Response(JSON.stringify({
      weekStart: digest.weekStart,
      totalPosts: digest.totalPosts,
      sectionCount: digest.sections.length,
      html,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Preview failed: ' + (error instanceof Error ? error.message : String(error)) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

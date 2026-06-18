import { db } from '@/lib/db'
import { sendWelcomeEmail } from '@/lib/email'
import { z } from 'zod'
import crypto from 'crypto'

const SubscribeValidator = z.object({
  email: z.string().email().max(254),
})

function generateToken(): string {
  return crypto.randomUUID()
}

// ── POST: 订阅 ──────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email } = SubscribeValidator.parse(body)

    const token = generateToken()

    // Upsert: 已存在的邮箱重新激活
    const existing = await db.newsletterSubscriber.findMany({
      where: { email },
      select: { id: true },
    }).catch(() => []) as { id: string }[]

    let subscriber: any
    if (existing && existing.length > 0) {
      // Re-activate with new token
      subscriber = await db.newsletterSubscriber.update({
        where: { id: existing[0].id },
        data: { active: true, unsubscribeToken: token, unsubscribedAt: null },
      })
    } else {
      subscriber = await db.newsletterSubscriber.create({
        data: {
          email,
          active: true,
          confirmed: true, // MVP: direct confirm
          unsubscribeToken: token,
        },
      })
    }

    // 异步发送欢迎邮件（不阻塞响应）
    sendWelcomeEmail(email, token).catch((e) =>
      console.error('[newsletter] Welcome email failed:', e)
    )

    return new Response(
      JSON.stringify({
        success: true,
        message: '订阅成功！每周日早上你将收到 Nexus Hub 学术周报',
        email: subscriber.email,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ success: false, message: '请输入有效的邮箱地址' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
    console.error('[newsletter] Subscribe error:', error)
    return new Response(
      JSON.stringify({ success: false, message: '订阅失败，请稍后重试' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

// ── GET: 一键退订 (链接来自邮件正文) ──────────────────────

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action')
    const token = url.searchParams.get('token')

    if (action !== 'unsubscribe' || !token) {
      return new Response(
        JSON.stringify({ success: false, message: '缺少退订参数' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const subs = await db.newsletterSubscriber.findMany({
      where: { unsubscribeToken: token },
      select: { id: true, email: true },
    }).catch(() => []) as { id: string; email: string }[]

    if (!subs || subs.length === 0) {
      return new Response(
        '<html><body style="font-family:sans-serif;padding:32px"><h2>退订链接无效</h2><p>此链接已过期或无效。如需帮助请联系我们。</p></body></html>',
        { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      )
    }

    await db.newsletterSubscriber.update({
      where: { id: subs[0].id },
      data: { active: false, unsubscribedAt: new Date().toISOString() },
    })

    // Return friendly HTML page
    return new Response(
      `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;max-width:500px;margin:48px auto;padding:24px;text-align:center">
<h1 style="color:#e11d48">Nexus Hub</h1>
<p style="font-size:18px;color:#374151">你已成功退订</p>
<p style="color:#6b7280">${subs[0].email} 将不再收到学术周报。</p>
<p style="color:#9ca3af;font-size:14px">有缘再见</p>
</body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  } catch (error) {
    console.error('[newsletter] Unsubscribe error:', error)
    return new Response(
      '<html><body style="font-family:sans-serif;padding:32px"><h2>出错了</h2><p>退订失败，请稍后重试。</p></body></html>',
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }
}

// ── DELETE: 传统退订 (by email) ─────────────────────────

export async function DELETE(req: Request) {
  try {
    const body = await req.json()
    const { email } = SubscribeValidator.parse(body)

    const existing = await db.newsletterSubscriber.findMany({
      where: { email },
      select: { id: true },
    }).catch(() => []) as { id: string }[]

    if (existing && existing.length > 0) {
      await db.newsletterSubscriber.update({
        where: { id: existing[0].id },
        data: { active: false, unsubscribedAt: new Date().toISOString() },
      })
    }

    return new Response(
      JSON.stringify({ success: true, message: '已退订，有缘再见' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ success: false, message: '请输入有效的邮箱地址' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
    return new Response(
      JSON.stringify({ success: false, message: '退订失败' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

import { db } from '@/lib/db'
import { sendWelcomeEmail } from '@/lib/email'
import { z } from 'zod'

const SubscribeValidator = z.object({
  email: z.string().email().max(254),
})

// ── POST: 订阅 ──────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email } = SubscribeValidator.parse(body)

    // Upsert: 已存在的邮箱重新激活
    const subscriber = await db.newsletterSubscriber.upsert({
      where: { email },
      update: { active: true },
      create: {
        email,
        active: true,
        confirmed: true, // MVP 简化：直接确认
      },
    })

    // 异步发送欢迎邮件（不阻塞响应）
    sendWelcomeEmail(email).catch((e) =>
      console.error('[newsletter] Welcome email failed:', e)
    )

    return new Response(
      JSON.stringify({
        success: true,
        message: '订阅成功！每周日早上你将收到 Nexus Hub 学术周报 🌸',
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

// ── DELETE: 退订 ─────────────────────────────────────────

export async function DELETE(req: Request) {
  try {
    const body = await req.json()
    const { email } = SubscribeValidator.parse(body)

    await db.newsletterSubscriber.updateMany({
      where: { email },
      data: { active: false },
    })

    return new Response(
      JSON.stringify({ success: true, message: '已退订，有缘再见 👋' }),
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

import { Resend } from 'resend'

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  return new Resend(apiKey)
}

const FROM = process.env.NEWSLETTER_FROM || 'Nexus Hub <newsletter@nexus-hub.vercel.app>'

export async function sendWelcomeEmail(to: string): Promise<boolean> {
  const resend = getResend()
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not configured, skipping welcome email')
    return false
  }

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: '欢迎订阅 Nexus Hub 学术周报',
      html: welcomeTemplate(),
    })
    return true
  } catch (e) {
    console.error('[email] Failed to send welcome email:', e)
    return false
  }
}

export async function sendWeeklyNewsletter(
  to: string,
  posts: {
    title: string
    summary: string
    subreddit: string
    author: string
    postId: string
  }[]
): Promise<boolean> {
  const resend = getResend()
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not configured, skipping newsletter')
    return false
  }

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Nexus Hub 学术周报 — ${new Date().toLocaleDateString('zh-CN')}`,
      html: newsletterTemplate(posts),
    })
    return true
  } catch (e) {
    console.error('[email] Failed to send newsletter:', e)
    return false
  }
}

function welcomeTemplate(): string {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h1 style="color: #e11d48;">Nexus Hub</h1>
  <p>感谢订阅 <strong>The Architect 每周学术快报</strong>！</p>
  <p>每周日早上，AI 会自动汇总本周的高质量学术内容，直达你的邮箱。</p>
  <p style="color: #6b7280; font-size: 14px;">每周一封，绝不骚扰 · 可随时退订</p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  <p style="color: #9ca3af; font-size: 12px;">
    由 <a href="https://nexus-hub.vercel.app" style="color: #e11d48;">Nexus Hub</a> AI 自动生成
  </p>
</body>
</html>`
}

function newsletterTemplate(
  posts: { title: string; summary: string; subreddit: string; author: string; postId: string }[]
): string {
  const postItems = posts
    .map(
      (p) => `
    <div style="margin-bottom: 20px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px;">
      <h3 style="margin: 0 0 8px 0;">
        <a href="https://nexus-hub.vercel.app/r/${p.subreddit}/post/${p.postId}"
           style="color: #e11d48; text-decoration: none;">
          ${escapeHtml(p.title)}
        </a>
      </h3>
      <p style="color: #4b5563; font-size: 14px; margin: 0 0 8px 0;">${escapeHtml(p.summary)}</p>
      <span style="color: #9ca3af; font-size: 12px;">${escapeHtml(p.subreddit)} · ${escapeHtml(p.author)}</span>
    </div>`
    )
    .join('')

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h1 style="color: #e11d48;">Nexus Hub</h1>
  <p style="color: #6b7280; font-size: 16px;">
    以下是本周 AI 自动生成的学术内容汇总（共 ${posts.length} 篇）：
  </p>
  ${postItems}
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  <p style="color: #9ca3af; font-size: 12px;">
    如需退订，请访问 <a href="https://nexus-hub.vercel.app" style="color: #e11d48;">Nexus Hub</a>
  </p>
</body>
</html>`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

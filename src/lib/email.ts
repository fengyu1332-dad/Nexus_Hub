import { Resend } from 'resend'

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  return new Resend(apiKey)
}

const FROM = process.env.NEWSLETTER_FROM || 'Nexus Hub <newsletter@nexus-hub.vercel.app>'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

function unsubscribeUrl(token: string): string {
  return `${BASE_URL}/api/newsletter/subscribe?action=unsubscribe&token=${encodeURIComponent(token)}`
}

export async function sendWelcomeEmail(to: string, unsubscribeToken?: string): Promise<boolean> {
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
      html: welcomeTemplate(unsubscribeToken),
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
  }[],
  unsubscribeToken?: string
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
      html: newsletterTemplate(posts, unsubscribeToken),
    })
    return true
  } catch (e) {
    console.error('[email] Failed to send newsletter:', e)
    return false
  }
}

function welcomeTemplate(unsubscribeToken?: string): string {
  const unsubLink = unsubscribeToken ? unsubscribeUrl(unsubscribeToken) : `${BASE_URL}`
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h1 style="color: #e11d48;">Nexus Hub</h1>
  <p>感谢订阅 <strong>The Architect 每周学术快报</strong>！</p>
  <p>每周日早上，AI 会自动汇总本周的高质量学术内容，直达你的邮箱。</p>
  <p style="color: #6b7280; font-size: 14px;">每周一封，绝不骚扰 · <a href="${escapeHtml(unsubLink)}" style="color: #e11d48;">随时退订</a></p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  <p style="color: #9ca3af; font-size: 12px;">
    由 <a href="${BASE_URL}" style="color: #e11d48;">Nexus Hub</a> AI 自动生成
  </p>
</body>
</html>`
}

function newsletterTemplate(
  posts: { title: string; summary: string; subreddit: string; author: string; postId: string }[],
  unsubscribeToken?: string
): string {
  const postItems = posts
    .map(
      (p) => `
    <div style="margin-bottom: 20px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px;">
      <h3 style="margin: 0 0 8px 0;">
        <a href="${BASE_URL}/r/${p.subreddit}/post/${p.postId}"
           style="color: #e11d48; text-decoration: none;">
          ${escapeHtml(p.title)}
        </a>
      </h3>
      <p style="color: #4b5563; font-size: 14px; margin: 0 0 8px 0;">${escapeHtml(p.summary)}</p>
      <span style="color: #9ca3af; font-size: 12px;">${escapeHtml(p.subreddit)} · ${escapeHtml(p.author)}</span>
    </div>`
    )
    .join('')

  const unsubLink = unsubscribeToken ? unsubscribeUrl(unsubscribeToken) : `${BASE_URL}`

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
    由 <a href="${BASE_URL}" style="color: #e11d48;">Nexus Hub</a> The Architect 自动生成 · <a href="${escapeHtml(unsubLink)}" style="color: #9ca3af;">一键退订</a>
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

export async function sendVerificationEmail(to: string, token: string): Promise<boolean> {
  const resend = getResend()
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not configured, skipping verification email')
    return false
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: 'Nexus Hub - 验证你的邮箱',
      html: verifyTemplate(verifyUrl),
    })
    return true
  } catch (e) {
    console.error('[email] Failed to send verification email:', e)
    return false
  }
}

function verifyTemplate(verifyUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h1 style="color: #e11d48;">Nexus Hub</h1>
  <p>感谢注册 Nexus Hub！请点击下方按钮验证你的邮箱：</p>
  <div style="text-align: center; margin: 32px 0;">
    <a href="${escapeHtml(verifyUrl)}"
       style="background: #e11d48; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 16px;">
      验证邮箱
    </a>
  </div>
  <p style="color: #6b7280; font-size: 14px;">此链接 15 分钟内有效。如果你没有注册 Nexus Hub，请忽略此邮件。</p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  <p style="color: #9ca3af; font-size: 12px;">
    由 <a href="https://nexus-hub.vercel.app" style="color: #e11d48;">Nexus Hub</a> 自动发送
  </p>
</body>
</html>`
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<boolean> {
  const resend = getResend()
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not configured, skipping password reset email')
    return false
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`

  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: 'Nexus Hub - 密码重置',
      html: passwordResetTemplate(resetUrl),
    })
    return true
  } catch (e) {
    console.error('[email] Failed to send password reset email:', e)
    return false
  }
}

function passwordResetTemplate(resetUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h1 style="color: #e11d48;">Nexus Hub</h1>
  <p>你收到这封邮件是因为有人（希望是你）请求重置密码。</p>
  <p>点击下方按钮重置密码（链接 1 小时内有效）：</p>
  <div style="text-align: center; margin: 32px 0;">
    <a href="${escapeHtml(resetUrl)}"
       style="background: #e11d48; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 16px;">
      重置密码
    </a>
  </div>
  <p style="color: #6b7280; font-size: 14px;">如果你没有请求重置密码，请忽略此邮件。</p>
  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
  <p style="color: #9ca3af; font-size: 12px;">
    由 <a href="https://nexus-hub.vercel.app" style="color: #e11d48;">Nexus Hub</a> 自动发送
  </p>
</body>
</html>`
}

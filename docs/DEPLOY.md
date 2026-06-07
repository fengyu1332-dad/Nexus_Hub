# Nexus Hub — 生产环境部署清单

## 一、Vercel 部署

### 1.1 推送到 GitHub

```bash
git add -A
git commit -m "feat: production ready"
git push origin master
```

### 1.2 导入 Vercel

1. 打开 https://vercel.com → **Add New** → **Project**
2. 选择 `fengyu1332-dad/Nexus_Hub`
3. 框架自动识别为 Next.js，无需改任何构建设置
4. 点击 **Deploy**

### 1.3 环境变量（Settings → Environment Variables）

| Key | Value | 说明 |
|-----|-------|------|
| `DATABASE_URL` | `postgresql://postgres:1kKybC1ISkMz1Un4@db.gqglwmchhjxzoogixbar.supabase.co:6543/postgres` | ⚠️ 端口是 **6543**（连接池），不是 5432 |
| `NEXTAUTH_SECRET` | `nx-hub-secret-2026-prod` | 任意随机字符串 |
| `AI_WEBHOOK_SECRET` | `nexus-hub-test-secret-2026` | n8n 调用 API 的密钥 |
| `DEEPSEEK_API_KEY` | `sk-286e67bd93304cf1b6407f7f92d55254` | DeepSeek API |
| `DEEPSEEK_API_BASE` | `https://api.deepseek.com/chat/completions` | API 地址 |
| `DEEPSEEK_MODEL` | `deepseek-chat` | 模型名 |
| `NEXT_PUBLIC_APP_URL` | `https://你的项目名.vercel.app` | 部署后 Vercel 给的域名 |

### 1.4 重新部署

填完环境变量后：**Deployments** → `⋯` → **Redeploy**

---

## 二、PostHog 分析

1. 注册 https://app.posthog.com → 创建项目
2. 复制 Project API Key（格式 `phc_xxxxx`）
3. 在 Vercel 环境变量中添加：

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_POSTHOG_KEY` | `phc_xxxxx` |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://app.posthog.com` |

---

## 三、Google Search Console

1. 打开 https://search.google.com/search-console
2. 添加资源 → 输入 `https://你的域名.vercel.app`
3. Vercel 自带 HTTPS，验证自动通过
4. 左侧 **Sitemaps** → 添加 `https://你的域名.vercel.app/sitemap.xml`

---

## 四、Resend（Newsletter 邮件）

1. 注册 https://resend.com → API Keys
2. 在 Vercel 环境变量中添加：

| Key | Value |
|-----|-------|
| `RESEND_API_KEY` | `re_xxxxx` |
| `NEWSLETTER_FROM` | `Nexus Hub <newsletter@你的域名.vercel.app>` |

---

## 五、n8n 工作流环境变量

在 n8n UI（http://localhost:5678）→ Settings → Environment Variables：

| Key | Value |
|-----|-------|
| `DEEPSEEK_API_KEY` | `sk-286e67bd93304cf1b6407f7f92d55254` |
| `AI_WEBHOOK_SECRET` | `nexus-hub-test-secret-2026` |
| `RESEND_API_KEY` | `re_xxxxx` |

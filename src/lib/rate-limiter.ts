/**
 * =============================================================================
 * Nexus Hub — 神盾协议: 基于 IP 的内存速率限制器
 * =============================================================================
 *
 * 规则:
 *   - 同一 IP: 每分钟最多 5 次请求
 *   - 同一 IP: 每天最多 50 次请求
 *   - 触发限流 → HTTP 429 + 友好的中文提示
 *
 * 适用场景: 单实例部署 (Vercel / Docker)
 * 升级路径: 多实例部署 → 替换为 @upstash/ratelimit + @vercel/kv
 *
 * 内存占用估算:
 *   1000 个活跃 IP × 2 条记录 × 200 bytes ≈ 400 KB
 */

// ── 类型 ──────────────────────────────────────────────────

interface RateLimitEntry {
  count: number
  resetAt: number // timestamp (ms) when this window resets
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number // when the limiting window resets
  reason?: string
}

// ── 滑动窗口存储 ──────────────────────────────────────────

// IP → 分钟窗口
const minuteWindows = new Map<string, RateLimitEntry>()
// IP → 天窗口
const dayWindows = new Map<string, RateLimitEntry>()

// 每分钟清理过期条目
let lastCleanup = Date.now()
function cleanupExpired() {
  const now = Date.now()
  if (now - lastCleanup < 60_000) return // 最多每分钟清理一次
  lastCleanup = now

  minuteWindows.forEach((entry, key) => {
    if (now > entry.resetAt) minuteWindows.delete(key)
  })
  dayWindows.forEach((entry, key) => {
    if (now > entry.resetAt) dayWindows.delete(key)
  })
}

// ── 核心限流逻辑 ──────────────────────────────────────────

const MINUTE_LIMIT = 5
const DAY_LIMIT = 50
const MINUTE_WINDOW = 60_000 // 1 分钟 (ms)
const DAY_WINDOW = 86_400_000 // 24 小时 (ms)

export function checkRateLimit(ip: string): RateLimitResult {
  cleanupExpired()
  const now = Date.now()

  // ── 1. 检查每天限制 ──────────────────────────────────
  let dayEntry = dayWindows.get(ip)
  if (!dayEntry || now > dayEntry.resetAt) {
    dayEntry = { count: 0, resetAt: now + DAY_WINDOW }
    dayWindows.set(ip, dayEntry)
  }

  if (dayEntry.count >= DAY_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: dayEntry.resetAt,
      reason: '每天对话次数已达上限',
    }
  }

  // ── 2. 检查每分钟限制 ──────────────────────────────────
  let minuteEntry = minuteWindows.get(ip)
  if (!minuteEntry || now > minuteEntry.resetAt) {
    minuteEntry = { count: 0, resetAt: now + MINUTE_WINDOW }
    minuteWindows.set(ip, minuteEntry)
  }

  if (minuteEntry.count >= MINUTE_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: minuteEntry.resetAt,
      reason: '发送频率过快',
    }
  }

  // ── 3. 放行：计数 +1 ──────────────────────────────────
  minuteEntry.count++
  dayEntry.count++

  const minuteRemaining = MINUTE_LIMIT - minuteEntry.count
  const dayRemaining = DAY_LIMIT - dayEntry.count

  return {
    allowed: true,
    remaining: Math.min(minuteRemaining, dayRemaining),
    resetAt: minuteEntry.resetAt,
  }
}

// ── 获取请求 IP ──────────────────────────────────────────

/**
 * 从 Next.js Request 中提取客户端 IP
 * 优先级: X-Forwarded-For → X-Real-IP → 连接地址
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    // X-Forwarded-For: client, proxy1, proxy2 → 取第一个
    return forwarded.split(',')[0].trim()
  }

  const realIP = request.headers.get('x-real-ip')
  if (realIP) return realIP

  // 回退到连接地址（本地开发时通常是 ::1 或 127.0.0.1）
  return '127.0.0.1'
}

// ── 限流响应 ──────────────────────────────────────────────

const FRIENDLY_MESSAGES: Record<string, string> = {
  '每天对话次数已达上限':
    'Flora 学姐今天接待了太多同学，需要休息一下啦～明天再来找我吧！🌸',
  '发送频率过快':
    '你发得太快啦！Flora 学姐需要喘口气，请等一分钟再问哦～⏳',
  default:
    'Flora 学姐正在忙，请稍后再试～🌸',
}

export function rateLimitResponse(result: RateLimitResult): Response {
  const waitSeconds = Math.ceil((result.resetAt - Date.now()) / 1000)
  const message =
    FRIENDLY_MESSAGES[result.reason || ''] || FRIENDLY_MESSAGES.default

  return new Response(
    JSON.stringify({
      error: 'rate_limited',
      message,
      retryAfter: waitSeconds,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(waitSeconds),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
      },
    }
  )
}

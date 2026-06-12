import { db } from '@/lib/db'
import { FLORA_SYSTEM_PROMPT, buildFloraUserMessage, buildFloraContext } from '@/lib/flora'

export const dynamic = 'force-dynamic'

export async function GET() {
  const results: string[] = []
  const query = '留学申请'

  // Step 1: keywordSearch
  try {
    const t0 = Date.now()
    const posts = (await db.post.findMany({ take: 50, orderBy: { createdAt: 'desc' } })) as any[]
    results.push(`Step1 findMany: ${posts.length} posts (${Date.now() - t0}ms)`)

    // keyword matching
    const keywords = query.split(/\s+/).filter((k: string) => k.length > 1)
    results.push(`Keywords: ${JSON.stringify(keywords)}`)

    const scored = posts
      .map((post: any) => {
        const title = (post.title || '').toLowerCase()
        const content = typeof post.content === 'string'
          ? post.content.toLowerCase()
          : JSON.stringify(post.content).toLowerCase()
        let score = 0
        for (const kw of keywords) {
          if (title.includes(kw)) score += 3
          score += content.split(kw).length - 1
        }
        return { ...post, _score: score }
      })
      .filter((p: any) => p._score > 0)
      .sort((a: any, b: any) => b._score - a._score)
      .slice(0, 3)

    results.push(`Step2 scored: ${scored.length} matches`)

    // Step 3: Build context
    const retrieved = scored.map((p: any) => ({
      postId: p.id,
      title: p.title,
      content: typeof p.content === 'string' ? p.content : JSON.stringify(p.content),
      similarity: Math.min(1, p._score / 10),
    }))

    const context = buildFloraContext(retrieved)
    results.push(`Step3 context: ${context.length} chars`)

    // Step 4: Build user message
    const userMsg = buildFloraUserMessage(query, context)
    results.push(`Step4 userMsg: ${userMsg.length} chars`)

    // Step 5: DeepSeek
    const apiKey = process.env.DEEPSEEK_API_KEY
    const dsRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.7,
        max_tokens: 256,
        stream: false,
        messages: [
          { role: 'system', content: FLORA_SYSTEM_PROMPT.substring(0, 200) },
          { role: 'user', content: userMsg.substring(0, 1000) },
        ],
      }),
    })
    const dsJson = await dsRes.json()
    const reply = dsJson.choices?.[0]?.message?.content || '(empty)'
    results.push(`Step5 DeepSeek: ${reply.substring(0, 100)}`)

  } catch (e: any) {
    results.push(`ERROR: ${e.message}`)
  }

  return new Response(results.join('\n'), { status: 200 })
}

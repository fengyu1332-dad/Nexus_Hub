import { getWxSignature } from '@/lib/wechat'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { url } = await req.json()
    if (!url) {
      return new Response(JSON.stringify({ error: 'url required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!process.env.WECHAT_APP_ID || !process.env.WECHAT_APP_SECRET) {
      return new Response(JSON.stringify({ available: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const sig = await getWxSignature(url)
    return new Response(JSON.stringify(sig), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.warn('[wechat-signature]', error instanceof Error ? error.message : String(error))
    return new Response(JSON.stringify({ available: false, error: 'Signature unavailable' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

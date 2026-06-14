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

    const sig = await getWxSignature(url)
    return new Response(JSON.stringify(sig), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Signature failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

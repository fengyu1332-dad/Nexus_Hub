import { getAuthSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { REPUTATION, computeLevel } from '@/lib/reputation'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const session = await getAuthSession()
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { action, targetUserId } = await req.json()

    if (!action || !targetUserId) {
      return new Response(JSON.stringify({ error: 'action and targetUserId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const points = (REPUTATION as any)[action]
    if (!points) {
      return new Response(JSON.stringify({ error: 'Unknown action' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Fetch current reputation
    const user = await db.user.findFirst({
      where: { id: targetUserId },
      select: { reputation: true, level: true, isAI: true },
    })

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Don't award reputation to AI users
    if ((user as any).isAI) {
      return new Response(JSON.stringify({ reputation: user.reputation, level: user.level }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const newReputation = ((user as any).reputation || 0) + points
    const newLevel = computeLevel(newReputation)

    await db.user.update({
      where: { id: targetUserId },
      data: { reputation: newReputation, level: newLevel },
    })

    return new Response(JSON.stringify({
      reputation: newReputation,
      level: newLevel,
      leveledUp: newLevel > ((user as any).level || 1),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to update reputation' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

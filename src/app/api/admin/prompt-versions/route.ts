import { db } from '@/lib/db'
import { getAdminSession } from '@/lib/auth-admin'
import { NextResponse } from 'next/server'

// GET — list all prompt versions, optionally filtered by agentRole
export async function GET(req: Request) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(req.url)
    const agentRole = url.searchParams.get('agentRole')

    const versions = await db.promptVersion.findMany({
      where: agentRole ? { agentRole } : undefined,
      orderBy: [
        { agentRole: 'asc' },
        { version: 'desc' },
      ] as any,
      take: 100,
    })

    return NextResponse.json({ versions })
  } catch (err: any) {
    console.error('[prompt-versions] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST — create a new prompt version
export async function POST(req: Request) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { agentRole, promptName, content, changeNotes, setActive } = body

    if (!agentRole || !promptName || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Find the latest version number for this agentRole + promptName
    const existing = await db.promptVersion.findMany({
      where: { agentRole, promptName },
      orderBy: { version: 'desc' },
      take: 1,
    })
    const latestVersion = (existing as any[])[0]?.version || 0
    const newVersion = latestVersion + 1

    const created = await db.promptVersion.create({
      data: {
        agentRole,
        promptName,
        version: newVersion,
        content,
        changeNotes: changeNotes || null,
        isActive: setActive === true,
      },
    })

    // If setting as active, deactivate all other versions for this agentRole
    if (setActive) {
      const allVersions = await db.promptVersion.findMany({
        where: { agentRole, isActive: true },
      }) as any[]
      for (const v of allVersions) {
        if (v.id !== (created as any).id) {
          await db.promptVersion.update({
            where: { id: v.id },
            data: { isActive: false },
          })
        }
      }
    }

    return NextResponse.json({ version: created })
  } catch (err: any) {
    console.error('[prompt-versions] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT — set a specific version as active
export async function PUT(req: Request) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, isActive } = await req.json()
    if (!id) {
      return NextResponse.json({ error: 'Missing version id' }, { status: 400 })
    }

    const version = await db.promptVersion.findFirst({ where: { id } })
    if (!version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    if (isActive) {
      // Deactivate all other active versions for this agentRole
      const activeVersions = await db.promptVersion.findMany({
        where: { agentRole: (version as any).agentRole, isActive: true },
      }) as any[]
      for (const v of activeVersions) {
        await db.promptVersion.update({
          where: { id: v.id },
          data: { isActive: false },
        })
      }
    }

    const updated = await db.promptVersion.update({
      where: { id },
      data: { isActive },
    })

    return NextResponse.json({ version: updated })
  } catch (err: any) {
    console.error('[prompt-versions] PUT error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

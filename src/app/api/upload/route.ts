import { getAuthSession } from '@/lib/auth'
import { supabase } from '@/lib/supabase-client'
import { NextResponse } from 'next/server'

const MAX_SIZE = 4 * 1024 * 1024 // 4MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp']

export async function POST(req: Request) {
  try {
    const session = await getAuthSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `File type ${file.type} not allowed` }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 4MB)' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() || 'png'
    const filename = `${session.user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`

    const { error } = await supabase.storage
      .from('post-images')
      .upload(filename, file, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      console.error('[upload] Storage error:', error)
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }

    const { data: urlData } = supabase.storage
      .from('post-images')
      .getPublicUrl(filename)

    return NextResponse.json({
      success: 1,
      file: { url: urlData.publicUrl },
    })
  } catch (err) {
    console.error('[upload] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

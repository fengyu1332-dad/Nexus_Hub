import { db } from '@/lib/db'

export async function GET(
  req: Request,
  { params }: { params: { username: string } }
) {
  try {
    const { username } = params

    // 1. 查找用户
    const user = await db.user.findFirst({
      where: { username },
      select: {
        id: true,
        username: true,
        image: true,
        name: true,
        isAI: true,
        aiRole: true,
      },
    })

    if (!user) {
      return new Response('User not found', { status: 404 })
    }

    // 2. 获取该用户的帖子
    const posts = await db.post.findMany({
      where: { authorId: user.id },
      select: {
        id: true,
        title: true,
        createdAt: true,
        subredditId: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    // 3. 批量解析 subreddit 名称
    const subIds = [...new Set((posts || []).map((p: any) => p.subredditId).filter(Boolean))]
    const subMap = new Map()
    for (const sid of subIds) {
      const sub = await db.subreddit.findFirst({
        where: { id: sid },
        select: { name: true },
      })
      if (sub) subMap.set(sid, (sub as any).name)
    }

    const postsWithSub = (posts || []).map((p: any) => ({
      ...p,
      subredditName: subMap.get(p.subredditId) || 'Nexus',
    }))

    // 4. 获取该用户的评论
    const comments = await db.comment.findMany({
      where: { authorId: user.id },
      select: {
        id: true,
        text: true,
        createdAt: true,
        postId: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    // 5. 批量解析评论所属帖子标题
    const postIds = [...new Set((comments || []).map((c: any) => c.postId).filter(Boolean))]
    const postMap = new Map()
    for (const pid of postIds) {
      const p = await db.post.findFirst({
        where: { id: pid },
        select: { title: true, subredditId: true },
      })
      if (p) {
        const subName = subMap.get((p as any).subredditId) || 'Nexus'
        postMap.set(pid, { title: (p as any).title, subredditName: subName })
      }
    }

    const commentsWithPost = (comments || []).map((c: any) => ({
      ...c,
      postTitle: postMap.get(c.postId)?.title || 'Unknown Post',
      postSubreddit: postMap.get(c.postId)?.subredditName || 'Nexus',
    }))

    return new Response(
      JSON.stringify({
        user,
        posts: postsWithSub,
        comments: commentsWithPost,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('[user profile] Error:', error)
    return new Response('Could not load user profile', { status: 500 })
  }
}

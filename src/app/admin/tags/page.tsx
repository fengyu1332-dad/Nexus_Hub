import { getAdminSession } from '@/lib/auth-admin'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { TagManager } from '@/components/admin/TagManager'
import { getDictionary } from '@/i18n'

export default async function AdminTagsPage() {
  const session = await getAdminSession()
  if (!session) redirect('/')

  const dict = getDictionary()
  const d = dict.tags

  let tags: any[] = []
  try {
    tags = await db.tag.findMany({
      orderBy: { postCount: 'desc' },
      select: { id: true, name: true, slug: true, category: true, postCount: true },
      take: 200,
    }) as any[]
  } catch {
    // tags table may not exist yet
  }

  return (
    <div className='space-y-8'>
      <h1 className='text-3xl font-bold text-zinc-900'>{d.tags}</h1>
      <TagManager
        initialTags={tags}
        labels={{
          tags: d.tags,
          tagName: d.tagName,
          tagSlug: d.tagSlug,
          tagCategory: d.tagCategory,
          postCount: d.postCount,
          addTag: d.addTag,
          removeTag: d.removeTag,
          mergeTags: d.mergeTags,
          search: dict.search.searchTitle || 'Search',
        }}
      />
    </div>
  )
}

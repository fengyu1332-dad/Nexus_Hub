'use client'

import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import Link from 'next/link'
import { Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDict } from '@/components/I18nProvider'

interface PostTagsProps {
  postId: string
  /** Preloaded tags (from server component) */
  initialTags?: { id: string; name: string; slug: string; category?: string }[]
  /** Clicking a tag will navigate to search with tag filter */
  clickable?: boolean
}

export function PostTags({ postId, initialTags, clickable = true }: PostTagsProps) {
  const dict = useDict()

  const { data } = useQuery({
    queryKey: ['post-tags', postId],
    queryFn: async () => {
      const res = await axios.get(`/api/posts/${postId}/tags`)
      return res.data.tags || []
    },
    initialData: initialTags,
    staleTime: 60_000,
  })

  const tags = data || []

  if (!tags.length) return null

  return (
    <div className='flex items-center gap-1.5 flex-wrap mt-2'>
      <Tag className='h-3 w-3 text-zinc-400 shrink-0' />
      {tags.map((tag: any) => {
        const tagEl = (
          <span
            key={tag.id}
            className={cn(
              'inline-flex items-center px-2 py-0.5 text-xs rounded-full font-medium',
              'bg-violet-50 text-violet-700 border border-violet-200',
              clickable && 'hover:bg-violet-100 cursor-pointer transition-colors'
            )}>
            {tag.name}
          </span>
        )
        if (clickable) {
          return (
            <Link key={tag.id} href={`/search?q=${encodeURIComponent(tag.name)}&type=posts&tags=${encodeURIComponent(tag.slug)}`}>
              {tagEl}
            </Link>
          )
        }
        return <span key={tag.id}>{tagEl}</span>
      })}
    </div>
  )
}

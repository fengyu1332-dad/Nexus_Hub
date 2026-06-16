'use client'

import { INFINITE_SCROLL_PAGINATION_RESULTS } from '@/config'
import { ExtendedPost } from '@/types/db'
import { useIntersection } from '@mantine/hooks'
import { useInfiniteQuery } from '@tanstack/react-query'
import axios from 'axios'
import { Loader2, RefreshCw } from 'lucide-react'
import { FC, useCallback, useEffect, useRef, useState } from 'react'
import Post from './Post'
import { useSession } from 'next-auth/react'

interface PostFeedProps {
  initialPosts: ExtendedPost[]
  subredditName?: string
  subredditDisplayName?: string | null
  sort?: string
  savedPostIds?: string[]
}

const PULL_THRESHOLD = 60

const PostFeed: FC<PostFeedProps> = ({ initialPosts, subredditName, sort, savedPostIds }) => {
  const lastPostRef = useRef<HTMLElement>(null)
  const { ref, entry } = useIntersection({
    root: lastPostRef.current,
    threshold: 1,
  })
  const { data: session } = useSession()

  const { data, fetchNextPage, isFetchingNextPage, refetch } = useInfiniteQuery(
    ['infinite-query', subredditName, sort],
    async ({ pageParam = 1 }) => {
      const query =
        `/api/posts?limit=${INFINITE_SCROLL_PAGINATION_RESULTS}&page=${pageParam}` +
        (!!subredditName ? `&subredditName=${subredditName}` : '') +
        (!!sort ? `&sort=${sort}` : '')

      const { data } = await axios.get(query)
      return data as ExtendedPost[]
    },

    {
      getNextPageParam: (_, pages) => {
        return pages.length + 1
      },
      initialData: { pages: [initialPosts], pageParams: [1] },
    }
  )

  useEffect(() => {
    if (entry?.isIntersecting) {
      fetchNextPage()
    }
  }, [entry, fetchNextPage])

  // Pull-to-refresh
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const touchStartY = useRef(0)
  const pullDistanceRef = useRef(0)
  const feedRef = useRef<HTMLUListElement>(null)

  const onTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY === 0) {
      touchStartY.current = e.touches[0].clientY
    }
  }, [])

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (window.scrollY === 0 && touchStartY.current > 0) {
      const delta = e.touches[0].clientY - touchStartY.current
      if (delta > 0) {
        const d = Math.min(delta * 0.5, PULL_THRESHOLD + 20)
        pullDistanceRef.current = d
        setPullDistance(d)
      }
    }
  }, [])

  const onTouchEnd = useCallback(async () => {
    if (pullDistanceRef.current >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true)
      await refetch()
      setIsRefreshing(false)
    }
    touchStartY.current = 0
    pullDistanceRef.current = 0
    setPullDistance(0)
  }, [isRefreshing, refetch])

  useEffect(() => {
    const el = feedRef.current
    if (!el) return
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [onTouchStart, onTouchMove, onTouchEnd])

  const posts = data?.pages.flatMap((page) => page) ?? initialPosts

  return (
    <ul ref={feedRef} className='flex flex-col col-span-2 space-y-6'>
      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <li className='flex justify-center py-2'>
          <RefreshCw
            className={`w-5 h-5 text-orange-500 transition-transform ${
              isRefreshing ? 'animate-spin' : ''
            } ${pullDistance >= PULL_THRESHOLD ? 'rotate-180' : ''}`}
            style={{
              transform: `scale(${Math.min(pullDistance / PULL_THRESHOLD, 1.2)})`,
              opacity: Math.min(pullDistance / PULL_THRESHOLD, 1),
            }}
          />
        </li>
      )}
      {posts.map((post, index) => {
        const votesAmt = post.votes.reduce((acc, vote) => {
          if (vote.type === 'UP') return acc + 1
          if (vote.type === 'DOWN') return acc - 1
          return acc
        }, 0)

        const currentVote = post.votes.find(
          (vote) => vote.userId === session?.user.id
        )

        if (index === posts.length - 1) {
          return (
            <li key={post.id} ref={ref}>
              <Post
                post={post}
                commentAmt={post.comments.length}
                subredditName={post.subreddit.name}
                subredditDisplayName={post.subreddit.displayName}
                votesAmt={votesAmt}
                currentVote={currentVote}
                savedPostIds={savedPostIds}
              />
            </li>
          )
        } else {
          return (
            <Post
              key={post.id}
              post={post}
              commentAmt={post.comments.length}
              subredditName={post.subreddit.name}
              subredditDisplayName={post.subreddit.displayName}
              votesAmt={votesAmt}
              currentVote={currentVote}
              savedPostIds={savedPostIds}
            />
          )
        }
      })}

      {isFetchingNextPage && (
        <li className='flex justify-center'>
          <Loader2 className='w-6 h-6 text-zinc-500 animate-spin' />
        </li>
      )}
    </ul>
  )
}

export default PostFeed

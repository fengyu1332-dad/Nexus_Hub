'use client'

import { getDisplayName } from '@/lib/subreddit'
import { formatTimeToNow } from '@/lib/utils'
import { Post, User, Vote } from '@prisma/client'
import { MessageSquare } from 'lucide-react'
import Link from 'next/link'
import { FC, useRef } from 'react'
import EditorOutput from './EditorOutput'
import PostVoteClient from './post-vote/PostVoteClient'
import BookmarkButton from './BookmarkButton'
import { AIBadge } from './AIBadge'
import { useI18n } from '@/components/I18nProvider'

type PartialVote = Pick<Vote, 'type'>

interface PostProps {
  post: Post & {
    author: User
    votes: Vote[]
  }
  votesAmt: number
  subredditName: string
  subredditDisplayName?: string | null
  currentVote?: PartialVote
  commentAmt: number
  savedPostIds?: string[]
}

const Post: FC<PostProps> = ({
  post,
  votesAmt: _votesAmt,
  currentVote: _currentVote,
  subredditName,
  subredditDisplayName,
  commentAmt,
  savedPostIds,
}) => {
  const pRef = useRef<HTMLParagraphElement>(null)
  const { dict, locale } = useI18n()

  return (
    <div className='rounded-md bg-white shadow'>
      <div className='px-6 py-4 flex justify-between'>
        <PostVoteClient
          postId={post.id}
          initialVotesAmt={_votesAmt}
          initialVote={_currentVote?.type}
        />

        <div className='w-0 flex-1'>
          <div className='max-h-40 mt-1 text-xs text-gray-500'>
            {subredditName ? (
              <>
                <a
                  className='underline text-zinc-900 text-sm underline-offset-2'
                  href={`/r/${subredditName}`}>
                  r/{getDisplayName(subredditName, subredditDisplayName)}
                </a>
                <span className='px-1'>•</span>
              </>
            ) : null}
            <span>{dict.user.postedBy} </span>
            <Link
              href={`/u/${post.author.username}`}
              className='underline text-zinc-900 text-sm underline-offset-2 hover:text-orange-500'>
              u/{post.author.username}
            </Link>
            {post.author.isAI && <AIBadge aiRole={post.author.aiRole} />}
            {' '}
            <span
              className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                _votesAmt >= 3
                  ? 'bg-emerald-100 text-emerald-700'
                  : _votesAmt >= 0
                  ? 'bg-zinc-100 text-zinc-500'
                  : 'bg-red-100 text-red-600'
              }`}
              title={`${_votesAmt} votes`}>
              {_votesAmt >= 3 ? '↑' : _votesAmt < 0 ? '↓' : '·'}{_votesAmt}
            </span>
            {formatTimeToNow(new Date(post.createdAt), locale)}
          </div>
          <a href={`/r/${subredditName}/post/${post.id}`}>
            <h1 className='text-lg font-semibold py-2 leading-6 text-gray-900'>
              {post.title}
            </h1>
          </a>

          <div
            className='relative text-sm max-h-40 w-full overflow-clip'
            ref={pRef}>
            <EditorOutput content={post.content} />
            {pRef.current?.clientHeight === 160 ? (
              // blur bottom if content is too long
              <div className='absolute bottom-0 left-0 h-24 w-full bg-gradient-to-t from-white to-transparent'></div>
            ) : null}
          </div>
        </div>
      </div>

      <div className='bg-gray-50 z-20 text-sm px-4 py-4 sm:px-6 flex items-center justify-between'>
        <Link
          href={`/r/${subredditName}/post/${post.id}`}
          className='w-fit flex items-center gap-2'>
          <MessageSquare className='h-4 w-4' /> {commentAmt} {dict.user.comments}
        </Link>
        <BookmarkButton
          postId={post.id}
          initialSaved={savedPostIds?.includes(post.id) ?? false}
        />
      </div>
    </div>
  )
}
export default Post

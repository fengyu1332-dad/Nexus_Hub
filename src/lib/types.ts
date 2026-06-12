/** Core entity shapes matching the Prisma schema — used instead of `as any` */

export interface DbUser {
  id: string
  name?: string | null
  email?: string | null
  emailVerified?: string | null
  username?: string | null
  image?: string | null
  isAI: boolean
  aiRole?: string | null
  isAdmin: boolean
}

export interface DbPost {
  id: string
  title: string
  content?: unknown
  embedding?: unknown
  createdAt: string
  updatedAt: string
  voteCount: number
  hotScore?: number | null
  authorId: string
  subredditId: string
  author?: DbUser
  subreddit?: DbSubreddit
  votes?: DbVote[]
  comments?: DbComment[]
}

export interface DbSubreddit {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  creatorId?: string | null
}

export interface DbComment {
  id: string
  text: string
  createdAt: string
  authorId: string
  postId: string
  replyToId?: string | null
}

export interface DbVote {
  userId: string
  postId: string
  type: 'UP' | 'DOWN'
}

export interface DbNotification {
  id: string
  userId: string
  type: string
  fromUserId: string
  postId?: string | null
  commentId?: string | null
  read: boolean
  createdAt: string
  fromUser?: Pick<DbUser, 'username' | 'image'>
}

export interface DbSubscription {
  userId: string
  subredditId: string
}

export interface DbBookmark {
  userId: string
  postId: string
  createdAt: string
}

export interface DbIntelSource {
  id: string
  label: string
  url: string
  type: 'rss' | 'webpage'
  category?: string | null
  priority: 'high' | 'medium' | 'low'
  crawlInterval: number
  isActive: boolean
  contentSelector?: string | null
  consecutiveFailures: number
  maxFailures: number
  lastCrawlAt?: string | null
  lastError?: string | null
  crawlCount: number
  articleCount: number
}

export interface DbCrawlLog {
  id: string
  sourceId: string
  status: 'success' | 'failed' | 'deduplicated'
  url?: string | null
  title?: string | null
  contentHash?: string | null
  contentLength?: number | null
  errorMessage?: string | null
  postId?: string | null
  duration?: number | null
  createdAt: string
}

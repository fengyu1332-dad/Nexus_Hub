'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, RefreshCw, Send, Mail, Users, FileText, Settings, Eye, History, Tag } from 'lucide-react'
import axios from 'axios'
import { getDisplayName } from '@/lib/subreddit'

interface PreviewPost {
  id: string
  title: string
  excerpt: string
  createdAt: string
  author: { username?: string; isAI?: boolean; aiRole?: string | null }
  subredditName?: string
  subredditDisplayName?: string | null
  tags?: string[]
}

interface PreviewData {
  weekStart: string
  totalPosts: number
  aiPosts: number
  subscriberCount: number
  activeCount: number
  posts: PreviewPost[]
}

interface CuratedPreview {
  weekStart: string
  totalPosts: number
  sectionCount: number
  html: string
}

export function NewsletterManager() {
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [curatedPreview, setCuratedPreview] = useState<CuratedPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sendResult, setSendResult] = useState<string | null>(null)
  const [tab, setTab] = useState<'preview' | 'curated' | 'settings'>('preview')
  const [showHtmlPreview, setShowHtmlPreview] = useState(false)

  const loadPreview = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await axios.get('/api/admin/newsletter/preview')
      setPreview(data)
    } catch (err: any) {
      setError(err?.response?.data?.error || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCuratedPreview = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await axios.get('/api/admin/newsletter/send')
      setCuratedPreview(data)
    } catch (err: any) {
      setError(err?.response?.data?.error || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPreview()
  }, [loadPreview])

  const handleSendNewsletter = async () => {
    if (!confirm('确定要向所有活跃订阅者发送本周 Newsletter 吗？')) return
    setSending(true)
    setSendResult(null)
    try {
      const { data } = await axios.post('/api/admin/newsletter/send')
      setSendResult(`发送完成 — 成功 ${data.sent} 封，失败 ${data.failed} 封，${data.postsIncluded} 篇文章`)
    } catch (err: any) {
      setSendResult('发送失败: ' + (err?.response?.data?.error || err?.message || '未知错误'))
    } finally {
      setSending(false)
    }
  }

  const formatWeek = (iso: string) => {
    const d = new Date(iso)
    const end = new Date(d)
    end.setDate(d.getDate() + 6)
    return `${d.toLocaleDateString('zh-CN')} — ${end.toLocaleDateString('zh-CN')}`
  }

  return (
    <div className='space-y-6'>
      {/* Tab bar */}
      <div className='flex items-center gap-1 bg-zinc-100 rounded-lg p-1 w-fit flex-wrap'>
        <button
          onClick={() => setTab('preview')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === 'preview' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
          }`}>
          <FileText className='h-4 w-4 inline mr-1.5' />
          本周帖子
        </button>
        <button
          onClick={() => { setTab('curated'); loadCuratedPreview() }}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === 'curated' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
          }`}>
          <Tag className='h-4 w-4 inline mr-1.5' />
          策展预览
        </button>
        <button
          onClick={() => setTab('settings')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === 'settings' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
          }`}>
          <Settings className='h-4 w-4 inline mr-1.5' />
          发送
        </button>
      </div>

      {/* Preview Tab */}
      {tab === 'preview' && (
        <div className='space-y-4'>
          {/* Stats cards */}
          {preview && (
            <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
              <div className='bg-white rounded-lg border p-4'>
                <Users className='h-4 w-4 text-zinc-400 mb-1' />
                <p className='text-2xl font-bold text-zinc-800'>{preview.activeCount}</p>
                <p className='text-xs text-zinc-500 mt-0.5'>活跃订阅者</p>
              </div>
              <div className='bg-white rounded-lg border p-4'>
                <Mail className='h-4 w-4 text-zinc-400 mb-1' />
                <p className='text-2xl font-bold text-zinc-800'>{preview.subscriberCount}</p>
                <p className='text-xs text-zinc-500 mt-0.5'>总订阅者</p>
              </div>
              <div className='bg-white rounded-lg border p-4'>
                <FileText className='h-4 w-4 text-zinc-400 mb-1' />
                <p className='text-2xl font-bold text-zinc-800'>{preview.totalPosts}</p>
                <p className='text-xs text-zinc-500 mt-0.5'>本周帖子</p>
              </div>
              <div className='bg-violet-50 rounded-lg border border-violet-200 p-4'>
                <FileText className='h-4 w-4 text-violet-400 mb-1' />
                <p className='text-2xl font-bold text-violet-700'>{preview.aiPosts}</p>
                <p className='text-xs text-violet-500 mt-0.5'>AI 帖子</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className='flex items-center justify-between flex-wrap gap-3'>
            <div className='flex items-center gap-3'>
              <button
                onClick={loadPreview}
                disabled={loading}
                className='inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-50 transition-colors'>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </button>
              {preview && (
                <span className='text-xs text-zinc-500'>
                  本周: {formatWeek(preview.weekStart)} · {preview.totalPosts} 篇帖子
                </span>
              )}
            </div>
          </div>

          {loading && !preview && (
            <div className='flex items-center justify-center py-8'>
              <Loader2 className='h-5 w-5 animate-spin text-zinc-400' />
            </div>
          )}

          {error && (
            <div className='p-4 bg-red-50 rounded border border-red-200 text-sm text-red-600'>{error}</div>
          )}

          {/* Posts preview */}
          {preview && preview.posts.length > 0 && (
            <div className='space-y-2'>
              <h3 className='text-sm font-semibold text-zinc-700'>本周内容</h3>
              <div className='border border-zinc-200 rounded-lg divide-y divide-zinc-100'>
                {preview.posts.map((post) => (
                  <div key={post.id} className='px-4 py-3 hover:bg-zinc-50/50'>
                    <div className='flex items-start justify-between gap-2'>
                      <a
                        href={`/r/${post.subredditName || 'Nexus'}/post/${post.id}`}
                        target='_blank'
                        rel='noopener'
                        className='text-sm font-medium text-zinc-800 hover:text-orange-500 line-clamp-1'>
                        {post.title}
                      </a>
                      {post.author?.isAI && (
                        <span className='flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-600 font-medium'>
                          {post.author.aiRole || 'AI'}
                        </span>
                      )}
                    </div>
                    {post.excerpt && (
                      <p className='text-xs text-zinc-500 mt-1 line-clamp-2'>{post.excerpt}</p>
                    )}
                    <p className='text-xs text-zinc-400 mt-1'>
                      {getDisplayName(post.subredditName || '—', post.subredditDisplayName)} ·{' '}
                      u/{post.author?.username || 'Unknown'} ·{' '}
                      {new Date(post.createdAt).toLocaleDateString('zh-CN')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview && preview.posts.length === 0 && (
            <div className='bg-white rounded-lg border p-8 text-center'>
              <p className='text-zinc-500'>本周暂无新帖子</p>
            </div>
          )}
        </div>
      )}

      {/* Curated Preview Tab */}
      {tab === 'curated' && (
        <div className='space-y-4'>
          {loading && !curatedPreview && (
            <div className='flex items-center justify-center py-8'>
              <Loader2 className='h-5 w-5 animate-spin text-zinc-400' />
            </div>
          )}

          {curatedPreview && (
            <>
              {/* Stats */}
              <div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
                <div className='bg-white rounded-lg border p-4'>
                  <FileText className='h-4 w-4 text-zinc-400 mb-1' />
                  <p className='text-2xl font-bold text-zinc-800'>{curatedPreview.totalPosts}</p>
                  <p className='text-xs text-zinc-500 mt-0.5'>策展文章</p>
                </div>
                <div className='bg-white rounded-lg border p-4'>
                  <Tag className='h-4 w-4 text-zinc-400 mb-1' />
                  <p className='text-2xl font-bold text-zinc-800'>{curatedPreview.sectionCount}</p>
                  <p className='text-xs text-zinc-500 mt-0.5'>分类板块</p>
                </div>
                <div className='bg-white rounded-lg border p-4'>
                  <Mail className='h-4 w-4 text-zinc-400 mb-1' />
                  <p className='text-2xl font-bold text-zinc-800'>{preview?.activeCount || 0}</p>
                  <p className='text-xs text-zinc-500 mt-0.5'>活跃订阅者</p>
                </div>
              </div>

              {/* HTML Preview Toggle */}
              <div className='bg-white rounded-lg border p-4'>
                <div className='flex items-center justify-between mb-3'>
                  <h3 className='text-sm font-semibold text-zinc-700 flex items-center gap-2'>
                    <Eye className='h-4 w-4' /> 邮件 HTML 预览
                  </h3>
                  <button
                    onClick={() => setShowHtmlPreview(!showHtmlPreview)}
                    className='text-xs text-rose-500 hover:text-rose-600 font-medium'>
                    {showHtmlPreview ? '收起' : '展开'}
                  </button>
                </div>
                {showHtmlPreview && (
                  <div className='border border-zinc-200 rounded-lg overflow-hidden'>
                    <iframe
                      srcDoc={curatedPreview.html}
                      className='w-full h-[500px] border-0'
                      title='Newsletter Preview'
                    />
                  </div>
                )}
              </div>

              <div className='flex items-center gap-3'>
                <button
                  onClick={loadCuratedPreview}
                  disabled={loading}
                  className='inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-50'>
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  刷新
                </button>
                <button
                  onClick={handleSendNewsletter}
                  disabled={sending}
                  className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50'>
                  {sending ? <Loader2 className='h-4 w-4 animate-spin' /> : <Send className='h-4 w-4' />}
                  {sending ? '发送中...' : '发送给所有订阅者'}
                </button>
              </div>

              {sendResult && (
                <div className='p-3 bg-white rounded-lg border text-sm text-zinc-700'>{sendResult}</div>
              )}
            </>
          )}

          {!loading && !curatedPreview && error && (
            <div className='p-4 bg-red-50 rounded border border-red-200 text-sm text-red-600'>{error}</div>
          )}
        </div>
      )}

      {/* Settings (Send) Tab */}
      {tab === 'settings' && (
        <div className='space-y-4'>
          <div className='bg-white rounded-lg border p-6'>
            <h3 className='text-sm font-semibold text-zinc-700 mb-4'>发送控制</h3>

            <div className='space-y-4'>
              <div className='p-4 bg-amber-50 rounded-lg border border-amber-200'>
                <p className='text-sm text-amber-800 font-medium mb-1'>自动发送</p>
                <p className='text-xs text-amber-600'>
                  Newsletter 由 n8n 工作流 <code className='bg-amber-100 px-1 rounded'>nexus-architect-newsletter</code> 驱动。
                  请在 n8n 管理面板中激活该工作流以启用每周自动发送。
                </p>
              </div>

              <div className='p-4 bg-zinc-50 rounded-lg border border-zinc-200'>
                <p className='text-sm text-zinc-700 font-medium mb-2'>手动发送</p>
                <p className='text-xs text-zinc-500 mb-3'>
                  向所有活跃订阅者发送本周策展 Newsletter（按标签分组，每标签 top 2）。
                </p>
                <button
                  onClick={handleSendNewsletter}
                  disabled={sending}
                  className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors'>
                  {sending ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : (
                    <Send className='h-4 w-4' />
                  )}
                  {sending ? '发送中...' : '手动发送本周 Newsletter'}
                </button>
                {sendResult && (
                  <p className='text-xs text-zinc-600 mt-3 p-2 bg-white rounded border'>
                    {sendResult}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className='bg-white rounded-lg border p-6'>
            <h3 className='text-sm font-semibold text-zinc-700 mb-3'>配置说明</h3>
            <ul className='text-xs text-zinc-500 space-y-2 list-disc list-inside'>
              <li>n8n 工作流: <code className='bg-zinc-100 px-1 rounded'>nexus-architect-newsletter</code> 控制每周自动发送</li>
              <li>环境变量: <code className='bg-zinc-100 px-1 rounded'>RESEND_API_KEY</code> 用于邮件发送</li>
              <li>环境变量: <code className='bg-zinc-100 px-1 rounded'>NEWSLETTER_FROM</code> 为发件人地址</li>
              <li>每封邮件包含一键退订链接（token-based），点击即可退订</li>
              <li>策展规则: 本周 AI 帖子按标签分组，每标签取 top 2（按投票数）</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

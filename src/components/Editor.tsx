'use client'

import EditorJS from '@editorjs/editorjs'
import { zodResolver } from '@hookform/resolvers/zod'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import TextareaAutosize from 'react-textarea-autosize'
import { z } from 'zod'

import { toast } from '@/hooks/use-toast'
import { uploadFiles } from '@/lib/uploadthing'
import { PostCreationRequest, PostValidator } from '@/lib/validators/post'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { useDict } from '@/components/I18nProvider'
import { trackEvent, AnalyticsEvent } from '@/lib/analytics'
import { useAIWrite } from '@/lib/writing-assistant'
import { Sparkles, Loader2 } from 'lucide-react'

import '@/styles/editor.css'

type FormData = z.infer<typeof PostValidator>

interface EditorProps {
  subredditId: string
}

export const Editor: React.FC<EditorProps> = ({ subredditId }) => {
  const dict = useDict()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(PostValidator),
    defaultValues: {
      subredditId,
      title: '',
      content: null,
    },
  })
  const ref = useRef<EditorJS>()
  const _titleRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()
  const [isMounted, setIsMounted] = useState<boolean>(false)
  const pathname = usePathname()

  // ── AI Writing Toolbar ──────────────────────────────────
  const { write: aiWriteAction, isLoading: isAIWriting } = useAIWrite()
  const [aiToolbar, setAiToolbar] = useState<{
    visible: boolean
    x: number
    y: number
    text: string
  }>({ visible: false, x: 0, y: 0, text: '' })
  const aiToolbarRef = useRef<HTMLDivElement>(null)

  const handleEditorMouseUp = useCallback(() => {
    setTimeout(() => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setAiToolbar((prev) => ({ ...prev, visible: false }))
        return
      }
      const text = sel.toString().trim()
      if (text.length < 5) {
        setAiToolbar((prev) => ({ ...prev, visible: false }))
        return
      }
      // Check if selection is inside the editor
      const editorEl = document.getElementById('editor')
      if (!editorEl || !editorEl.contains(sel.anchorNode)) {
        setAiToolbar((prev) => ({ ...prev, visible: false }))
        return
      }
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      setAiToolbar({
        visible: true,
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
        text,
      })
    }, 100)
  }, [])

  const handleAIAction = useCallback(
    async (action: 'polish' | 'expand' | 'summarize') => {
      const text = aiToolbar.text
      if (!text || isAIWriting) return

      setAiToolbar((prev) => ({ ...prev, visible: false }))

      try {
        const result = await aiWriteAction({ text, action, style: 'academic' })
        // Replace selected text directly in DOM — EditorJS contenteditable will sync
        const sel = window.getSelection()
        if (sel && !sel.isCollapsed) {
          try {
            const range = sel.getRangeAt(0)
            range.deleteContents()
            range.insertNode(document.createTextNode(result))
            // Trigger input event so EditorJS syncs the change
            range.commonAncestorContainer.parentElement?.dispatchEvent(
              new Event('input', { bubbles: true })
            )
          } catch {
            // Ultimate fallback
            document.execCommand('insertText', false, result)
          }
        }
      } catch {
        toast({
          title: dict.toast.somethingWentWrong,
          description: dict.toast.pleaseTryAgain,
          variant: 'destructive',
        })
      }
    },
    [aiToolbar.text, isAIWriting, aiWriteAction, dict]
  )

  // Close AI toolbar when clicking outside
  useEffect(() => {
    if (!aiToolbar.visible) return
    const handler = (e: MouseEvent) => {
      if (aiToolbarRef.current && !aiToolbarRef.current.contains(e.target as Node)) {
        setAiToolbar((prev) => ({ ...prev, visible: false }))
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [aiToolbar.visible])

  const { mutate: createPost } = useMutation({
    mutationFn: async ({
      title,
      content,
      subredditId,
    }: PostCreationRequest) => {
      const payload: PostCreationRequest = { title, content, subredditId }
      const { data } = await axios.post('/api/subreddit/post/create', payload)
      return data
    },
    onError: () => {
      return toast({
        title: dict.toast.somethingWentWrong,
        description: dict.toast.postNotPublished,
        variant: 'destructive',
      })
    },
    onSuccess: (_, variables) => {
      trackEvent(AnalyticsEvent.POST_CREATED, {
        subredditId: variables.subredditId,
        title: variables.title,
      })
      // turn pathname /r/mycommunity/submit into /r/mycommunity
      const newPathname = pathname.split('/').slice(0, -1).join('/')
      router.push(newPathname)

      router.refresh()

      return toast({
        description: dict.toast.postPublished,
      })
    },
  })

  const initializeEditor = useCallback(async () => {
    const EditorJS = (await import('@editorjs/editorjs')).default
    const Header = (await import('@editorjs/header')).default
    const Embed = (await import('@editorjs/embed')).default
    const Table = (await import('@editorjs/table')).default
    const List = (await import('@editorjs/list')).default
    const Code = (await import('@editorjs/code')).default
    const LinkTool = (await import('@editorjs/link')).default
    const InlineCode = (await import('@editorjs/inline-code')).default
    const ImageTool = (await import('@editorjs/image')).default

    if (!ref.current) {
      const editor = new EditorJS({
        holder: 'editor',
        onReady() {
          ref.current = editor
        },
        placeholder: dict.editor.placeholder,
        inlineToolbar: true,
        data: { blocks: [] },
        tools: {
          header: Header,
          linkTool: {
            class: LinkTool,
            config: {
              endpoint: '/api/link',
            },
          },
          image: {
            class: ImageTool,
            config: {
              uploader: {
                async uploadByFile(file: File) {
                  // upload to uploadthing
                  const [res] = await uploadFiles([file], 'imageUploader')

                  return {
                    success: 1,
                    file: {
                      url: res.fileUrl,
                    },
                  }
                },
              },
            },
          },
          list: List,
          code: Code,
          inlineCode: InlineCode,
          table: Table,
          embed: Embed,
        },
      })
    }
  }, [])

  useEffect(() => {
    if (Object.keys(errors).length) {
      for (const [_key, value] of Object.entries(errors)) {
        value
        toast({
          title: dict.toast.somethingWentWrong,
          description: (value as { message: string }).message,
          variant: 'destructive',
        })
      }
    }
  }, [errors])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsMounted(true)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      await initializeEditor()

      setTimeout(() => {
        _titleRef?.current?.focus()
      }, 0)
    }

    if (isMounted) {
      init()

      return () => {
        ref.current?.destroy()
        ref.current = undefined
      }
    }
  }, [isMounted, initializeEditor])

  async function onSubmit(data: FormData) {
    const blocks = await ref.current?.save()

    const payload: PostCreationRequest = {
      title: data.title,
      content: blocks,
      subredditId,
    }

    createPost(payload)
  }

  if (!isMounted) {
    return null
  }

  const { ref: titleRef, ...rest } = register('title')

  return (
    <div className='w-full p-4 bg-zinc-50 rounded-lg border border-zinc-200'>
      <form
        id='subreddit-post-form'
        className='w-fit'
        onSubmit={handleSubmit(onSubmit)}>
        <div className='prose prose-stone dark:prose-invert'>
          <TextareaAutosize
            ref={(e) => {
              titleRef(e)
              // @ts-ignore
              _titleRef.current = e
            }}
            {...rest}
            placeholder={dict.editor.titlePlaceholder}
            className='w-full resize-none appearance-none overflow-hidden bg-transparent text-5xl font-bold focus:outline-none'
          />
          <div id='editor' className='min-h-[500px]' onMouseUp={handleEditorMouseUp} />
          <p className='text-sm text-gray-500'>
            {dict.editor.tabHelp}{' '}
            <kbd className='rounded-md border bg-muted px-1 text-xs uppercase'>
              Tab
            </kbd>{' '}
            to open the command menu.
          </p>
        </div>
      </form>

      {/* ── AI Writing Floating Toolbar ──────────────────── */}
      {aiToolbar.visible && (
        <div
          ref={aiToolbarRef}
          className='fixed z-50 flex items-center gap-1 bg-white border border-zinc-200 rounded-xl shadow-lg px-1.5 py-1 transform -translate-x-1/2 -translate-y-full'
          style={{ left: aiToolbar.x, top: aiToolbar.y }}>
          {isAIWriting ? (
            <span className='flex items-center gap-1 px-2.5 py-1.5 text-xs text-zinc-500'>
              <Loader2 className='h-3 w-3 animate-spin' />
              {dict.editor.aiProcessing}
            </span>
          ) : (
            <>
              <button
                onClick={() => handleAIAction('polish')}
                className='flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors'>
                <Sparkles className='h-3 w-3' />
                {dict.editor.aiPolish}
              </button>
              <button
                onClick={() => handleAIAction('expand')}
                className='flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors'>
                {dict.editor.aiExpand}
              </button>
              <button
                onClick={() => handleAIAction('summarize')}
                className='flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors'>
                {dict.editor.aiSummarize}
              </button>
              <div className='w-px h-4 bg-zinc-200 mx-0.5' />
              <button
                onClick={() => setAiToolbar((prev) => ({ ...prev, visible: false }))}
                className='px-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 transition-colors'>
                {dict.editor.aiDismiss}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

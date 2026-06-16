'use client'

import { useEffect, useRef, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAProvider() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const registered = useRef(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // Register service worker
    if (!registered.current && 'serviceWorker' in navigator) {
      registered.current = true
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(() => {
          // SW registration is non-critical
        })
    }

    // Capture install prompt
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') {
      setIsInstalled(true)
    }
    setInstallPrompt(null)
  }

  // Only render install banner if prompt is available and not installed
  if (!installPrompt || isInstalled) return null

  return (
    <div className='fixed bottom-20 md:bottom-5 left-4 right-4 md:left-auto md:right-20 z-[60] bg-white border border-zinc-200 rounded-2xl shadow-xl px-5 py-4 md:w-80 animate-in slide-in-from-bottom-4'>
      <div className='flex items-center gap-3'>
        <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center flex-shrink-0'>
          <svg className='w-5 h-5 text-white' viewBox='0 0 512 512' fill='currentColor'>
            <path d='M140 140L256 290L256 140L292 140L292 372L256 372L140 222L140 372L104 372L104 140L140 140Z'/>
            <path d='M320 140L356 140L356 230L408 230L408 140L444 140L444 372L408 372L408 282L356 282L356 372L320 372L320 140Z' opacity='0.9'/>
          </svg>
        </div>
        <div className='flex-1 min-w-0'>
          <p className='text-sm font-semibold text-zinc-800'>添加到主屏幕</p>
          <p className='text-xs text-zinc-500 mt-0.5'>安装 Nexus Hub 获得更好体验</p>
        </div>
      </div>
      <div className='flex gap-2 mt-3'>
        <button
          onClick={handleInstall}
          className='flex-1 px-4 py-2 bg-gradient-to-r from-orange-400 to-orange-600 text-white text-sm font-medium rounded-xl hover:shadow-md transition-all'>
          安装
        </button>
        <button
          onClick={() => setInstallPrompt(null)}
          className='px-4 py-2 text-sm text-zinc-500 hover:text-zinc-700 rounded-xl hover:bg-zinc-100 transition-all'>
          以后再说
        </button>
      </div>
    </div>
  )
}

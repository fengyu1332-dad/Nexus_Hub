'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, Compass, Bell, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'

interface MobileBottomNavProps {
  labels: {
    home: string
    search: string
    explore: string
    notifications: string
    profile: string
  }
}

export function MobileBottomNav({ labels }: MobileBottomNavProps) {
  const pathname = usePathname()
  const [visible, setVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  const tabs = [
    { href: '/', icon: Home, label: labels.home },
    { href: '/search', icon: Search, label: labels.search },
    { href: '/r/sat-act', icon: Compass, label: labels.explore },
    { href: '/notifications', icon: Bell, label: labels.notifications },
    { href: '/settings', icon: User, label: labels.profile },
  ]

  // Hide on scroll down, show on scroll up
  useEffect(() => {
    const handler = () => {
      const currentY = window.scrollY
      if (currentY > lastScrollY && currentY > 100) {
        setVisible(false)
      } else {
        setVisible(true)
      }
      setLastScrollY(currentY)
    }
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [lastScrollY])

  return (
    <nav
      className={cn(
        'md:hidden fixed bottom-0 inset-x-0 z-[55] bg-white/95 backdrop-blur border-t border-zinc-200 pb-safe transition-transform duration-300',
        visible ? 'translate-y-0' : 'translate-y-full'
      )}>
      <div className='flex items-center justify-around h-14 px-1'>
        {tabs.map(({ href, icon: Icon, label }) => {
          const isActive =
            href === '/'
              ? pathname === '/'
              : pathname.startsWith(href)

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors min-w-0',
                isActive
                  ? 'text-orange-600'
                  : 'text-zinc-400 hover:text-zinc-600'
              )}>
              <Icon className={cn('h-5 w-5', isActive && 'text-orange-500')} />
              <span className='text-[10px] font-medium truncate max-w-[64px] text-center'>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useDict } from '@/components/I18nProvider'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Users, FileText, Bot, Activity, ArrowLeft } from 'lucide-react'

export function AdminSidebar() {
  const dict = useDict()
  const pathname = usePathname()

  const links = [
    { href: '/admin', label: dict.admin.dashboard, icon: LayoutDashboard },
    { href: '/admin/users', label: dict.admin.users, icon: Users },
    { href: '/admin/posts', label: dict.admin.posts, icon: FileText },
    { href: '/admin/ai-agents', label: dict.admin.aiAgents, icon: Bot },
    { href: '/admin/status', label: dict.admin.systemStatus, icon: Activity },
  ]

  return (
    <aside className='w-56 bg-zinc-50 border-r border-zinc-200 min-h-[calc(100vh-3.5rem)] p-4 flex flex-col'>
      <div className='font-bold text-lg text-zinc-800 mb-6 px-2'>Admin</div>
      <nav className='space-y-0.5 flex-1'>
        {links.map((link) => {
          const Icon = link.icon
          const isActive = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-zinc-200 text-zinc-900 font-medium'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              )}>
              <Icon className='h-4 w-4' />
              {link.label}
            </Link>
          )
        })}
      </nav>
      <Link
        href='/'
        className='flex items-center gap-2 px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors mt-auto'>
        <ArrowLeft className='h-4 w-4' />
        {dict.admin.backToSite}
      </Link>
    </aside>
  )
}

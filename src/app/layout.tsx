import Navbar from '@/components/Navbar'
import { AnalyticsProvider } from '@/components/AnalyticsProvider'
import { FloraChat } from '@/components/FloraChat'
import { cn } from '@/lib/utils'
import { Inter } from 'next/font/google'
import Providers from '@/components/Providers'
import { Toaster } from '@/components/ui/Toaster'

import '@/styles/globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Nexus Hub — AI 驱动的留学学术社区',
  description:
    'Nexus Hub 是一个由 AI 智能体集群全自动驱动的高质量升学与学术内容矩阵。',
}

export default function RootLayout({
  children,
  authModal,
}: {
  children: React.ReactNode
  authModal: React.ReactNode
}) {
  return (
    <html
      lang='zh-CN'
      className={cn(
        'bg-white text-slate-900 antialiased light',
        inter.className
      )}>
      <body className='min-h-screen pt-12 bg-slate-50 antialiased'>
        <AnalyticsProvider />
        <Providers>
          {/* @ts-expect-error Server Component */}
          <Navbar />
          {authModal}

          <div className='container max-w-7xl mx-auto h-full pt-12'>
            {children}
          </div>
        </Providers>
        <Toaster />
        <FloraChat />
      </body>
    </html>
  )
}

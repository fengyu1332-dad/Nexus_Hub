import { ErrorBoundary } from '@/components/ErrorBoundary'
import Navbar from '@/components/Navbar'
import { AnalyticsProvider } from '@/components/AnalyticsProvider'

import { cn } from '@/lib/utils'
import { Inter } from 'next/font/google'
import Providers from '@/components/Providers'
import { Toaster } from '@/components/ui/Toaster'
import { getLocale } from '@/i18n'
import { zhCN } from '@/i18n/zh-CN'
import { en } from '@/i18n/en'
import type { Metadata } from 'next'

import '@/styles/globals.css'

const inter = Inter({ subsets: ['latin'] })

export async function generateMetadata(): Promise<Metadata> {
  const locale = getLocale()
  const dict = locale === 'en' ? en : zhCN
  return {
    title: `${dict.metadata.siteName} — ${dict.metadata.tagline}`,
    description: dict.metadata.description,
  }
}

export default function RootLayout({
  children,
  authModal,
}: {
  children: React.ReactNode
  authModal: React.ReactNode
}) {
  const locale = getLocale()
  const dict = locale === 'en' ? en : zhCN

  return (
    <html
      lang={locale}
      className={cn(
        'bg-white text-slate-900 antialiased light',
        inter.className
      )}>
      <body className='min-h-screen pt-12 bg-slate-50 antialiased'>
        <AnalyticsProvider />
        <Providers dictZhCN={zhCN} dictEn={en} initialLocale={locale}>
          {/* @ts-expect-error Server Component */}
          <Navbar />
          {authModal}

          <div className='container max-w-7xl mx-auto h-full pt-12'>
            <ErrorBoundary fallbackMessage={dict.errorPage.fallbackMessage}>{children}</ErrorBoundary>
          </div>
        </Providers>
        <Toaster />
      </body>
    </html>
  )
}

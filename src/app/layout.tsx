import { ErrorBoundary } from '@/components/ErrorBoundary'
import { FloraChat } from '@/components/FloraChat'
import Navbar from '@/components/Navbar'
import WeChatShare from '@/components/WeChatShare'
// P5 debugging — temporarily disabled
// import { MobileBottomNav } from '@/components/MobileBottomNav'
// import WxLaunchWeapp from '@/components/WxLaunchWeapp'
// import { PWAProvider } from '@/components/PWAProvider'
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

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const locale = getLocale()
  const dict = locale === 'en' ? en : zhCN
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nexus-hub.vercel.app'
  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: `${dict.metadata.siteName} — ${dict.metadata.tagline}`,
      template: `%s | ${dict.metadata.titleSuffix}`,
    },
    description: dict.metadata.description,
    openGraph: {
      type: 'website',
      siteName: dict.metadata.siteName,
      title: `${dict.metadata.siteName} — ${dict.metadata.tagline}`,
      description: dict.metadata.description,
      url: baseUrl,
      locale: locale === 'en' ? 'en_US' : 'zh_CN',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${dict.metadata.siteName} — ${dict.metadata.tagline}`,
      description: dict.metadata.description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    manifest: '/manifest.json',
    icons: {
      icon: '/icon.svg',
      apple: '/apple-touch-icon.png',
    },
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
        <Providers dictZhCN={zhCN} dictEn={en} initialLocale={locale}>
          <Navbar />
          {authModal}
          <div className='container max-w-7xl mx-auto h-full pt-4 sm:pt-12 px-3 sm:px-6 pb-20 md:pb-0'>
            <ErrorBoundary fallbackMessage={dict.errorPage.fallbackMessage}>{children}</ErrorBoundary>
          </div>
        </Providers>
        <Toaster />
        <WeChatShare
          title={dict.metadata.siteName}
          description={dict.metadata.description}
        />
        {/* P5: WxLaunchWeapp — temporarily disabled for debugging */}
        {/* P5: MobileBottomNav — temporarily disabled for debugging */}
        {/* P5: PWAProvider — temporarily disabled for debugging */}
        <FloraChat dict={dict} />
      </body>
    </html>
  )
}

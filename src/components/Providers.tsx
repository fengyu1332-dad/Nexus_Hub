'use client'

import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { SessionProvider } from 'next-auth/react'
import { I18nProvider } from '@/components/I18nProvider'
import type { Dictionary, Locale } from '@/i18n/types'

interface LayoutProps {
  children: React.ReactNode
  dictZhCN: Dictionary
  dictEn: Dictionary
  initialLocale: Locale
}

const queryClient = new QueryClient()

const Providers = ({ children, dictZhCN, dictEn, initialLocale }: LayoutProps) => {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <I18nProvider dictZhCN={dictZhCN} dictEn={dictEn} initialLocale={initialLocale}>
          {children}
        </I18nProvider>
      </SessionProvider>
    </QueryClientProvider>
  )
}

export default Providers

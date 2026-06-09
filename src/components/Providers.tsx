'use client'

import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { SessionProvider } from 'next-auth/react'
import { I18nProvider } from '@/components/I18nProvider'
import type { Dictionary, Locale } from '@/i18n/types'
import { useState } from 'react'

interface LayoutProps {
  children: React.ReactNode
  dictZhCN: Dictionary
  dictEn: Dictionary
  initialLocale: Locale
}

const Providers = ({ children, dictZhCN, dictEn, initialLocale }: LayoutProps) => {
  const [queryClient] = useState(() => new QueryClient())

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

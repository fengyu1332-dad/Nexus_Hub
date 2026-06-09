'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { Dictionary, Locale } from '@/i18n/types'

interface I18nContextValue {
  dict: Dictionary
  locale: Locale
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}

export function useDict(): Dictionary {
  return useI18n().dict
}

interface I18nProviderProps {
  children: ReactNode
  dictZhCN: Dictionary
  dictEn: Dictionary
  initialLocale: Locale
}

export function I18nProvider({ children, dictZhCN, dictEn, initialLocale }: I18nProviderProps) {
  const [locale, setLocale] = useState<Locale>(initialLocale)
  const router = useRouter()

  const handleSetLocale = useCallback(
    (newLocale: Locale) => {
      setLocale(newLocale)
      document.cookie = `NEXUS_HUB_LOCALE=${newLocale};path=/;max-age=31536000;SameSite=Lax`
      router.refresh()
    },
    [router]
  )

  const dict = locale === 'zh-CN' ? dictZhCN : dictEn

  return (
    <I18nContext.Provider value={{ dict, locale, setLocale: handleSetLocale }}>
      {children}
    </I18nContext.Provider>
  )
}

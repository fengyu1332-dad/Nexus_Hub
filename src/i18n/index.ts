import { cookies } from 'next/headers'
import type { Dictionary, Locale } from './types'
import { zhCN } from './zh-CN'
import { en } from './en'

export type { Dictionary, Locale } from './types'

const COOKIE_NAME = 'NEXUS_HUB_LOCALE'

const dictionaries: Record<Locale, Dictionary> = {
  'zh-CN': zhCN,
  en,
}

export function getLocale(): Locale {
  try {
    const cookieStore = cookies()
    const raw = cookieStore.get(COOKIE_NAME)?.value
    if (raw === 'en') return 'en'
  } catch {
    // cookies() may throw in non-server contexts
  }
  return 'zh-CN'
}

export function getDictionary(): Dictionary {
  const locale = getLocale()
  return dictionaries[locale]
}

export function isValidLocale(value: string | undefined): value is Locale {
  return value === 'zh-CN' || value === 'en'
}

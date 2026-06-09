'use client'

import { useI18n } from '@/components/I18nProvider'

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n()

  const toggle = () => {
    const next = locale === 'zh-CN' ? 'en' : 'zh-CN'
    setLocale(next)
  }

  return (
    <button
      onClick={toggle}
      className='text-xs font-medium px-2 py-1 rounded border border-zinc-300 hover:bg-zinc-200 dark:border-zinc-600 dark:hover:bg-zinc-700 transition-colors shrink-0'
      title={locale === 'zh-CN' ? 'Switch to English' : '切换到中文'}
    >
      {locale === 'zh-CN' ? 'EN' : '中文'}
    </button>
  )
}

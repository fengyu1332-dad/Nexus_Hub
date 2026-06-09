import { ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNowStrict } from 'date-fns'
import enLocale from 'date-fns/locale/en-US'
import zhLocale from 'date-fns/locale/zh-CN'
import type { Locale } from '@/i18n/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type FormatDistanceToken = keyof typeof formatDistanceLocaleEn

const formatDistanceLocaleEn = {
  lessThanXSeconds: 'just now',
  xSeconds: 'just now',
  halfAMinute: 'just now',
  lessThanXMinutes: '{{count}}m',
  xMinutes: '{{count}}m',
  aboutXHours: '{{count}}h',
  xHours: '{{count}}h',
  xDays: '{{count}}d',
  aboutXWeeks: '{{count}}w',
  xWeeks: '{{count}}w',
  aboutXMonths: '{{count}}mo',
  xMonths: '{{count}}mo',
  aboutXYears: '{{count}}y',
  xYears: '{{count}}y',
  overXYears: '{{count}}y',
  almostXYears: '{{count}}y',
}

const formatDistanceLocaleZh = {
  lessThanXSeconds: '刚刚',
  xSeconds: '刚刚',
  halfAMinute: '刚刚',
  lessThanXMinutes: '{{count}}分钟',
  xMinutes: '{{count}}分钟',
  aboutXHours: '{{count}}小时',
  xHours: '{{count}}小时',
  xDays: '{{count}}天',
  aboutXWeeks: '{{count}}周',
  xWeeks: '{{count}}周',
  aboutXMonths: '{{count}}个月',
  xMonths: '{{count}}个月',
  aboutXYears: '{{count}}年',
  xYears: '{{count}}年',
  overXYears: '{{count}}年',
  almostXYears: '{{count}}年',
}

function formatDistanceEn(token: FormatDistanceToken, count: number, options?: any): string {
  return formatDistanceImpl(formatDistanceLocaleEn, token, count, options)
}

function formatDistanceZh(token: FormatDistanceToken, count: number, options?: any): string {
  return formatDistanceImpl(formatDistanceLocaleZh, token, count, options, true)
}

function formatDistanceImpl(
  localeMap: Record<string, string>,
  token: FormatDistanceToken,
  count: number,
  options?: any,
  isZh: boolean = false
): string {
  const result = localeMap[token].replace('{{count}}', count.toString())

  if (options?.addSuffix) {
    if (options.comparison > 0) {
      return isZh ? `${result}后` : 'in ' + result
    } else {
      if (result === '刚刚' || result === 'just now') return result
      return isZh ? result + '前' : result + ' ago'
    }
  }

  return result
}

export function formatTimeToNow(date: Date, locale: Locale = 'en'): string {
  const isZh = locale === 'zh-CN'
  return formatDistanceToNowStrict(date, {
    addSuffix: true,
    locale: {
      ...(isZh ? zhLocale : enLocale),
      formatDistance: isZh ? formatDistanceZh : formatDistanceEn,
    },
  })
}

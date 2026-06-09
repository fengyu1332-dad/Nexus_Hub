'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useDict } from '@/components/I18nProvider'
import { cn } from '@/lib/utils'

const SortSelector = () => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const dict = useDict()

  const currentSort = searchParams.get('sort') || 'new'

  const options = [
    { value: 'new', label: dict.sort.new },
    { value: 'hot', label: dict.sort.hot },
    { value: 'top', label: dict.sort.top },
  ]

  const handleSort = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'new') {
      params.delete('sort')
    } else {
      params.set('sort', value)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className='flex items-center gap-1 bg-zinc-100 rounded-lg p-1'>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => handleSort(opt.value)}
          className={cn(
            'px-3 py-1 text-sm font-medium rounded-md transition-colors',
            currentSort === opt.value
              ? 'bg-white text-zinc-900 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-700'
          )}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export default SortSelector

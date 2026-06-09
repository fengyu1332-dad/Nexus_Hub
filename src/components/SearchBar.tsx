'use client'

import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import debounce from 'lodash.debounce'
import { usePathname, useRouter } from 'next/navigation'
import { FC, useCallback, useEffect, useRef, useState } from 'react'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/Command'
import { useOnClickOutside } from '@/hooks/use-on-click-outside'
import { FileText, Users } from 'lucide-react'
import { useDict } from '@/components/I18nProvider'

interface SearchBarProps {}

interface SearchResults {
  communities: { id: string; name: string; _count?: { subscribers?: number } }[]
  posts: {
    id: string
    title: string
    excerpt: string
    createdAt: string
    author: { username: string }
    subredditName: string
  }[]
}

const SearchBar: FC<SearchBarProps> = ({}) => {
  const [input, setInput] = useState<string>('')
  const pathname = usePathname()
  const commandRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const dict = useDict()

  useOnClickOutside(commandRef, () => {
    setInput('')
  })

  const request = debounce(async () => {
    refetch()
  }, 300)

  const debounceRequest = useCallback(() => {
    request()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const {
    isFetching,
    data: queryResults,
    refetch,
    isFetched,
  } = useQuery({
    queryFn: async () => {
      if (!input) return { communities: [], posts: [] }
      const { data } = await axios.get(`/api/search?q=${input}`)
      return data as SearchResults
    },
    queryKey: ['search-query'],
    enabled: false,
  })

  useEffect(() => {
    setInput('')
  }, [pathname])

  const hasCommunities = (queryResults?.communities?.length ?? 0) > 0
  const hasPosts = (queryResults?.posts?.length ?? 0) > 0
  const hasResults = hasCommunities || hasPosts

  return (
    <Command
      ref={commandRef}
      className='relative rounded-lg border max-w-lg z-50 overflow-visible'>
      <CommandInput
        isLoading={isFetching}
        onValueChange={(text) => {
          setInput(text)
          debounceRequest()
        }}
        value={input}
        className='outline-none border-none focus:border-none focus:outline-none ring-0'
        placeholder={dict.search.placeholder}
      />

      {input.length > 0 && (
        <CommandList className='absolute bg-white top-full inset-x-0 shadow rounded-b-md max-h-72 overflow-y-auto'>
          {isFetched && !hasResults && <CommandEmpty>{dict.search.noResults}</CommandEmpty>}
          {hasCommunities && (
            <CommandGroup heading={dict.search.communities}>
              {queryResults!.communities.map((sub) => (
                <CommandItem
                  onSelect={(e) => {
                    router.push(`/r/${e}`)
                    router.refresh()
                  }}
                  key={sub.id}
                  value={sub.name}>
                  <Users className='mr-2 h-4 w-4' />
                  <span>r/{sub.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {hasCommunities && hasPosts && <CommandSeparator />}
          {hasPosts && (
            <CommandGroup heading={dict.search.posts}>
              {queryResults!.posts.map((post) => (
                <CommandItem
                  onSelect={() => {
                    router.push(`/r/${post.subredditName}/post/${post.id}`)
                    router.refresh()
                  }}
                  key={post.id}
                  value={post.title}>
                  <FileText className='mr-2 h-4 w-4' />
                  <div className='flex flex-col'>
                    <span className='text-sm truncate'>{post.title}</span>
                    <span className='text-xs text-zinc-400'>
                      r/{post.subredditName} · u/{post.author.username}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      )}
    </Command>
  )
}

export default SearchBar

import { getDictionary } from '@/i18n'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const dict = getDictionary()

  return (
    <div className='p-8'>
      <h1 className='font-bold text-3xl md:text-4xl'>{dict.home.nexusHub}</h1>
      <p className='text-zinc-500 mt-2'>Homepage restored with dict only.</p>
    </div>
  )
}
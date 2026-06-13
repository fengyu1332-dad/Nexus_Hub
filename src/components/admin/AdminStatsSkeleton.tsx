export function AdminStatsSkeleton() {
  return (
    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className='bg-white rounded-lg border border-zinc-200 p-5 animate-pulse'>
          <div className='flex items-center justify-between'>
            <div className='flex-1'>
              <div className='h-4 bg-zinc-200 rounded w-16' />
              <div className='h-8 bg-zinc-200 rounded w-12 mt-3' />
            </div>
            <div className='p-2.5 rounded-lg bg-zinc-100'>
              <div className='h-5 w-5' />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

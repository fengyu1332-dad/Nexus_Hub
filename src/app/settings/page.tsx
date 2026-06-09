import { redirect } from 'next/navigation'

import { UserNameForm } from '@/components/UserNameForm'
import { NewsletterToggle } from '@/components/NewsletterToggle'
import { authOptions, getAuthSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { getDictionary } from '@/i18n'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary()
  return {
    title: dict.settings.settings,
    description: dict.settings.manageDescription,
  }
}

export default async function SettingsPage() {
  const dict = getDictionary()
  const session = await getAuthSession()

  if (!session?.user) {
    redirect(authOptions?.pages?.signIn || '/login')
  }

  // Check newsletter subscription status
  let isSubscribed = false
  try {
    const subs = await db.newsletterSubscriber.findMany({
      where: { email: session.user.email, active: true },
      select: { email: true },
    })
    isSubscribed = (subs && subs.length > 0) ? true : false
  } catch {
    // DB unavailable — just default to false
  }

  return (
    <div className='max-w-4xl mx-auto py-12'>
      <div className='grid items-start gap-8'>
        <h1 className='font-bold text-3xl md:text-4xl'>{dict.settings.settings}</h1>

        <div className='grid gap-10'>
          <UserNameForm
            user={{
              id: session.user.id,
              username: session.user.username || '',
            }}
          />

          {/* Account Info */}
          <div className='rounded-lg border bg-card text-card-foreground shadow-sm'>
            <div className='p-6 space-y-1'>
              <h3 className='text-2xl font-semibold leading-none tracking-tight'>{dict.user.account}</h3>
              <p className='text-sm text-muted-foreground'>{dict.user.accountDetails}</p>
            </div>
            <div className='p-6 pt-0'>
              <div className='grid gap-4'>
                <div>
                  <label className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'>
                    {dict.user.email}
                  </label>
                  <p className='mt-1.5 text-sm text-zinc-500'>{session.user.email || dict.user.notAvailable}</p>
                </div>
                <div>
                  <label className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'>
                    {dict.user.username}
                  </label>
                  <p className='mt-1.5 text-sm text-zinc-500'>u/{session.user.username || dict.user.notSet}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Newsletter Preference */}
          <NewsletterToggle
            email={session.user.email || ''}
            initialSubscribed={isSubscribed}
          />
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icons } from '@/components/Icons'
import UserAuthForm from '@/components/UserAuthForm'
import { Button } from '@/components/ui/Button'
import { useDict } from '@/components/I18nProvider'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'

const SignUp = () => {
  const dict = useDict()
  const { toast } = useToast()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const register = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password }),
      })
      if (res.ok) {
        toast({ title: dict.toast.registered, description: dict.toast.registeredDescription })
        router.push('/sign-in')
      } else if (res.status === 409) {
        toast({ title: dict.toast.error, description: await res.text(), variant: 'destructive' })
      } else {
        toast({ title: dict.toast.error, description: dict.toast.pleaseTryAgain, variant: 'destructive' })
      }
    } catch {
      toast({ title: dict.toast.error, description: dict.toast.pleaseTryAgain, variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='container mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]'>
      <div className='flex flex-col space-y-2 text-center'>
        <Icons.logo className='mx-auto h-6 w-6' />
        <h1 className='text-2xl font-semibold tracking-tight'>{dict.auth.signUp}</h1>
        <p className='text-sm max-w-xs mx-auto'>
          {dict.auth.termsConsent}
        </p>
      </div>

      <UserAuthForm />

      <div className='relative'>
        <div className='absolute inset-0 flex items-center'>
          <span className='w-full border-t' />
        </div>
        <div className='relative flex justify-center text-xs uppercase'>
          <span className='bg-background px-2 text-muted-foreground'>
            {dict.auth.orEmail}
          </span>
        </div>
      </div>

      <form onSubmit={register} className='flex flex-col gap-3'>
        <input
          type='text'
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={dict.auth.usernamePlaceholder}
          className='w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-300 focus:border-rose-400'
          required
        />
        <input
          type='email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={dict.auth.emailPlaceholder}
          className='w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-300 focus:border-rose-400'
          required
        />
        <input
          type='password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={dict.auth.passwordPlaceholder}
          className='w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:ring-2 focus:ring-rose-300 focus:border-rose-400'
          required
        />
        <Button isLoading={isLoading} type='submit' size='sm' className='w-full' disabled={isLoading}>
          {dict.auth.signUp}
        </Button>
      </form>

      <p className='px-8 text-center text-sm text-muted-foreground'>
        {dict.auth.alreadyMember}{' '}
        <Link
          href='/sign-in'
          className='hover:text-brand text-sm underline underline-offset-4'>
          {dict.auth.signIn}
        </Link>
      </p>
    </div>
  )
}

export default SignUp

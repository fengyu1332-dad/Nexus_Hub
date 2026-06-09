'use client'

import { buttonVariants } from '@/components/ui/Button'
import { toast } from '@/hooks/use-toast'
import Link from 'next/link'
import { useDict } from '@/components/I18nProvider'

export const useCustomToasts = () => {
  const dict = useDict()

  const loginToast = () => {
    const { dismiss } = toast({
      title: dict.toast.loginRequired,
      description: dict.toast.needLoginDescription,
      variant: 'destructive',
      action: (
        <Link
          onClick={() => dismiss()}
          href='/sign-in'
          className={buttonVariants({ variant: 'outline' })}>
          {dict.toast.login}
        </Link>
      ),
    })
  }

  return { loginToast }
}

import { User } from '@prisma/client'
import { AvatarProps } from '@radix-ui/react-avatar'
import { Sparkles } from 'lucide-react'

import { Icons } from '@/components/Icons'
import { Avatar, AvatarFallback } from '@/components/ui/Avatar'
import Image from 'next/image'

interface UserAvatarProps extends AvatarProps {
  user: Pick<User, 'image' | 'name' | 'isAI'>
}

export function UserAvatar({ user, ...props }: UserAvatarProps) {
  return (
    <Avatar {...props}>
      {user.image ? (
        <div className='relative aspect-square h-full w-full'>
          <Image
            fill
            src={user.image}
            alt='profile picture'
            referrerPolicy='no-referrer'
          />
        </div>
      ) : (
        <AvatarFallback>
          <span className='sr-only'>{user?.name}</span>
          {user.isAI ? (
            <Sparkles className='h-4 w-4' />
          ) : (
            <Icons.user className='h-4 w-4' />
          )}
        </AvatarFallback>
      )}
    </Avatar>
  )
}

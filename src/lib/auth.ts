import { nanoid } from 'nanoid'
import { NextAuthOptions, getServerSession } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

// PrismaAdapter 延迟加载避免 Vercel 冷启动时 DB 未就绪导致 crash
let _adapter: any = undefined
async function getAdapter() {
  if (!_adapter) {
    const { db } = await import('@/lib/db')
    const { PrismaAdapter } = await import('@next-auth/prisma-adapter')
    _adapter = PrismaAdapter(db)
  }
  return _adapter
}

export const authOptions: NextAuthOptions = {
  adapter: process.env.DATABASE_URL
    ? {
        createUser: (...args: any[]) => getAdapter().then((a: any) => a.createUser(...args)),
        getUser: (...args: any[]) => getAdapter().then((a: any) => a.getUser(...args)),
        getUserByEmail: (...args: any[]) => getAdapter().then((a: any) => a.getUserByEmail(...args)),
        getUserByAccount: (...args: any[]) => getAdapter().then((a: any) => a.getUserByAccount(...args)),
        linkAccount: (...args: any[]) => getAdapter().then((a: any) => a.linkAccount(...args)),
        createSession: (...args: any[]) => getAdapter().then((a: any) => a.createSession(...args)),
        getSessionAndUser: (...args: any[]) => getAdapter().then((a: any) => a.getSessionAndUser(...args)),
        updateUser: (...args: any[]) => getAdapter().then((a: any) => a.updateUser(...args)),
        updateSession: (...args: any[]) => getAdapter().then((a: any) => a.updateSession(...args)),
        deleteSession: (...args: any[]) => getAdapter().then((a: any) => a.deleteSession(...args)),
      }
    : undefined,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/sign-in',
  },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async session({ token, session }) {
      if (token) {
        session.user.id = token.id
        session.user.name = token.name
        session.user.email = token.email
        session.user.image = token.picture
        session.user.username = token.username
      }

      return session
    },

    async jwt({ token, user }) {
      // 未登录用户不触发 DB 查询
      if (!token.email) return token

      try {
        const { db } = await import('@/lib/db')
        const dbUser = await db.user.findFirst({
          where: { email: token.email },
        })

        if (!dbUser) {
          token.id = user!.id
          return token
        }

        if (!dbUser.username) {
          await db.user.update({
            where: { id: dbUser.id },
            data: { username: nanoid(10) },
          })
        }

        return {
          id: dbUser.id,
          name: dbUser.name,
          email: dbUser.email,
          picture: dbUser.image,
          username: dbUser.username,
        }
      } catch {
        // DB 不可用时降级
        return token
      }
    },
    redirect() {
      return '/'
    },
  },
}

export const getAuthSession = () => getServerSession(authOptions)

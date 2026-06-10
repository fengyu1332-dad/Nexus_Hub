import { NextAuthOptions, getServerSession } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { db } from '@/lib/db'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/sign-in' },
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
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        try {
          // 查找或创建用户记录
          let dbUser = await db.user.findFirst({
            where: { email: user.email! },
            select: { id: true, isAdmin: true, username: true },
          })
          if (!dbUser) {
            dbUser = await db.user.create({
              data: {
                email: user.email!,
                username: user.name?.replace(/\s+/g, '_').toLowerCase() ?? user.email!.split('@')[0],
                name: user.name ?? '',
                image: user.image ?? '',
                isAdmin: user.email === process.env.ADMIN_EMAIL,
              },
            })
          }
          // 将数据库 ID 挂到 profile 上，供 jwt 回调使用
          ;(user as any).dbId = (dbUser as any).id
          ;(user as any).dbIsAdmin = (dbUser as any).isAdmin ?? false
          ;(user as any).dbUsername = (dbUser as any).username
        } catch (e) {
          console.error('[auth] signIn callback error:', e instanceof Error ? e.message : String(e))
          return true // 即使 DB 失败也允许登录，降级
        }
      }
      return true
    },
    async session({ token, session }) {
      if (token) {
        session.user.id = token.id ?? token.sub ?? ''
        session.user.name = token.name ?? ''
        session.user.email = token.email ?? ''
        session.user.image = token.picture ?? ''
        session.user.username = token.username ?? ''
        session.user.isAdmin = token.isAdmin ?? false
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).dbId ?? user.id
        token.isAdmin = (user as any).dbIsAdmin ?? false
        token.username = (user as any).dbUsername ?? (token.username as any)
      }
      return token
    },
    redirect() {
      return '/'
    },
  },
}

export const getAuthSession = () => getServerSession(authOptions)

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
        token.id = user.id
      }
      if (token.id) {
        try {
          const dbUser = await db.user.findFirst({
            where: { id: token.id },
            select: { isAdmin: true, username: true },
          })
          if (dbUser) {
            token.isAdmin = (dbUser as any).isAdmin ?? false
            token.username = (dbUser as any).username ?? (token.username as any)
          }
        } catch {
          // keep existing token values on DB failure
        }
      }
      return token
    },
    redirect() {
      return '/'
    },
  },
}

export const getAuthSession = () => getServerSession(authOptions)

import { NextAuthOptions, getServerSession } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

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
      return token
    },
    redirect() {
      return '/'
    },
  },
}

export const getAuthSession = () => getServerSession(authOptions)

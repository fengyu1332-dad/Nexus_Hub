import { NextAuthOptions, getServerSession } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
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
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          }),
        ]
      : []),
    ...(process.env.WECHAT_APP_ID && process.env.WECHAT_APP_SECRET
      ? [
          {
            id: 'wechat',
            name: 'WeChat',
            type: 'oauth' as const,
            authorization: `https://open.weixin.qq.com/connect/qrconnect?appid=${process.env.WECHAT_APP_ID}&scope=snsapi_login#wechat_redirect`,
            token: {
              url: 'https://api.weixin.qq.com/sns/oauth2/access_token',
              async request(context: any) {
                const url = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${context.provider.clientId}&secret=${context.provider.clientSecret}&code=${context.params.code}&grant_type=authorization_code`
                const res = await fetch(url)
                const json = await res.json()
                return { tokens: json }
              },
            },
            userinfo: {
              url: 'https://api.weixin.qq.com/sns/userinfo',
              async request({ tokens }: any) {
                const url = `https://api.weixin.qq.com/sns/userinfo?access_token=${tokens.access_token}&openid=${tokens.openid}&lang=zh_CN`
                const res = await fetch(url)
                return await res.json()
              },
            },
            profile(profile: any) {
              return {
                id: profile.unionid ?? profile.openid,
                name: profile.nickname,
                image: profile.headimgurl,
              }
            },
            clientId: process.env.WECHAT_APP_ID,
            clientSecret: process.env.WECHAT_APP_SECRET,
          } as any,
        ]
      : []),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = (await db.user.findFirst({
          where: { email: credentials.email },
        })) as any
        if (!user || !user.passwordHash) return null
        const valid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!valid) return null
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.username ?? '',
          image: user.image ?? '',
          dbId: user.id,
          dbIsAdmin: user.isAdmin ?? false,
          dbUsername: user.username ?? '',
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google' || account?.provider === 'github' || account?.provider === 'wechat') {
        try {
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
          ;(user as any).dbId = (dbUser as any).id
          ;(user as any).dbIsAdmin = (dbUser as any).isAdmin ?? false
          ;(user as any).dbUsername = (dbUser as any).username
        } catch (e) {
          console.error('[auth] signIn callback error:', e instanceof Error ? e.message : String(e))
          return true
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

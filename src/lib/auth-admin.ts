import { getAuthSession } from './auth'

export async function getAdminSession() {
  const session = await getAuthSession()
  if (!session?.user?.isAdmin) {
    return null
  }
  return session
}

export function adminUnauthorizedResponse() {
  return new Response('Unauthorized', { status: 401 })
}

export function adminForbiddenResponse() {
  return new Response('Forbidden', { status: 403 })
}

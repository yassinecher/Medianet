import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isTokenExpired } from '@/lib/session'

// Redirect admins to backoffice
const PUBLIC = ['/', '/login', '/register', '/forgot-password', '/reset-password',
  '/programmes', '/a-propos', '/partenaires', '/societes-incubees']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const raw = request.cookies.get('token')?.value
  // An expired token is no session: treat it as logged out (and drop the cookie),
  // otherwise /login would bounce to /dashboard and private pages would render.
  const expired = !!raw && isTokenExpired(raw)
  const token = expired ? undefined : raw

  const isPublic =
    PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/')) ||
    pathname.startsWith('/invitations/') ||
    pathname.startsWith('/evaluate/') ||
    pathname.startsWith('/join/')

  let res: NextResponse
  if (!token && !isPublic) {
    const url = new URL('/login', request.url)
    if (expired) url.searchParams.set('expired', '1')
    res = NextResponse.redirect(url)
  } else if (token && (pathname === '/login' || pathname === '/register')) {
    res = NextResponse.redirect(new URL('/dashboard', request.url))
  } else {
    res = NextResponse.next()
  }
  if (expired) res.cookies.delete('token')
  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:png|svg|jpe?g|webp|ico)$).*)'],
}

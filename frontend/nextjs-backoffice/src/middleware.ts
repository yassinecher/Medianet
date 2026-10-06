import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isTokenExpired } from '@/lib/session'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (pathname === '/login') return NextResponse.next()

  // A cookie alone isn't a session: its token must also still be valid —
  // otherwise the panel would render (from the persisted profile) for a dead token.
  const token = request.cookies.get('admin_token')?.value
  if (!token || isTokenExpired(token)) {
    const url = new URL('/login', request.url)
    if (token) url.searchParams.set('expired', '1')
    const res = NextResponse.redirect(url)
    if (token) res.cookies.delete('admin_token')
    return res
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:png|svg|jpe?g|webp|ico)$).*)'],
}

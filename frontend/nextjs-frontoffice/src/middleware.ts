import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Redirect admins to backoffice
const PUBLIC = ['/', '/login', '/register', '/programmes', '/a-propos', '/partenaires', '/societes-incubees']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('token')?.value

  const isPublic =
    PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/')) ||
    pathname.startsWith('/invitations/') ||
    pathname.startsWith('/evaluate/') ||
    pathname.startsWith('/join/')

  if (!token && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (token && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}

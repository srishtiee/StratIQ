import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function getTokenRole(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.role ?? null
  } catch {
    return null
  }
}

// Paths that require approver or admin role
const APPROVER_PATHS = ['/workflow', '/approvals', '/audit']

export function middleware(request: NextRequest) {
  const token = request.cookies.get('stratiq_token')?.value
  const { pathname } = request.nextUrl

  const isPublicPath = pathname === '/login'

  if (!token && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (token && isPublicPath) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Role check: viewers cannot access workflow, approvals, or audit
  if (token && APPROVER_PATHS.some((p) => pathname.startsWith(p))) {
    const role = getTokenRole(token)
    if (role === 'viewer') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}

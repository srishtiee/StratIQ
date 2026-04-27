import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const PROTECTED_PREFIXES = ['/dashboard', '/people', '/retention', '/uploads', '/actions', '/settings']

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
}

export async function proxy(request: NextRequest) {
  const url = request.nextUrl
  const path = url.pathname

  // Build the response we'll return; the Supabase client will mutate its cookies.
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookies) {
          for (const { name, value, options } of cookies) {
            response.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  // getUser() is the canonical "is this session valid" check; getSession() trusts the cookie.
  const { data: { user } } = await supabase.auth.getUser()

  if (!user && isProtected(path)) {
    const redirect = new URL('/login', request.url)
    redirect.searchParams.set('next', path)
    return NextResponse.redirect(redirect)
  }

  if (user && (path === '/login' || path === '/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  // Skip Next internals and static assets — match everything else.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)'],
}

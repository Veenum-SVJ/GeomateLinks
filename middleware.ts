import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Protect admin routes with basic auth
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return new NextResponse('Authentication required', {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="Admin"' }
      })
    }

    const base64 = authHeader.split(' ')[1]
    const [user, pass] = Buffer.from(base64, 'base64').toString().split(':')
    const expectedUser = process.env.BASIC_AUTH_USER || 'admin'
    const expectedPass = process.env.BASIC_AUTH_PASSWORD

    if (!expectedPass || user !== expectedUser || pass !== expectedPass) {
      return new NextResponse('Invalid credentials', { status: 401 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/admin/:path*'
}
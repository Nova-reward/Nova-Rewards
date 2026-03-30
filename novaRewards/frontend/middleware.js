import { NextResponse } from 'next/server';

// Routes that require authentication
const PROTECTED = ['/dashboard', '/rewards', '/history', '/settings', '/referral', '/leaderboard'];
// Routes only for unauthenticated users
const AUTH_ONLY = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('authToken')?.value;

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  const isAuthOnly = AUTH_ONLY.some((p) => pathname.startsWith(p));

  if (isProtected && !token) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthOnly && token) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/rewards/:path*',
    '/history/:path*',
    '/settings/:path*',
    '/referral/:path*',
    '/leaderboard/:path*',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
  ],
};

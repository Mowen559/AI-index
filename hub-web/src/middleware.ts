import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip API routes, static files, next internals, and already localized routes
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  // If a cookie is already set, use it
  if (request.cookies.has('NEXT_LOCALE')) {
    return response;
  }

  // Detect language from Accept-Language header
  const acceptLanguage = request.headers.get('accept-language');
  let locale = 'zh-CN'; // Default

  if (acceptLanguage) {
    // A simple parse, matching standard logic
    if (acceptLanguage.includes('en')) {
      locale = 'en-US';
    } else if (acceptLanguage.includes('zh')) {
      locale = 'zh-CN';
    }
  }

  // Set the locale in a cookie (valid for 1 year)
  response.cookies.set('NEXT_LOCALE', locale, {
    path: '/',
    maxAge: 31536000,
    sameSite: 'lax'
  });

  return response;
}

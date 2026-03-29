import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/upload',
  '/documents',
  '/extraction',
  '/chat',
  '/analytics',
  '/settings',
];

// Routes that should redirect to dashboard if already logged in
const authRoutes = ['/login', '/register', '/forgot-password', '/reset-password'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Get token from cookie
  const token = request.cookies.get('auth_token')?.value;
  
  // Check if trying to access protected route without auth
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  );
  
  if (isProtectedRoute && !token) {
    // Redirect to landing page if not authenticated
    return NextResponse.redirect(new URL('/', request.url));
  }
  
  // Check if trying to access auth route while already logged in
  const isAuthRoute = authRoutes.includes(pathname);
  
  if (isAuthRoute && token) {
    // Redirect to dashboard if already authenticated
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  // If user is authenticated and accessing root (/), redirect to dashboard
  if (pathname === '/' && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  return NextResponse.next();
}

// Configure which routes the proxy runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

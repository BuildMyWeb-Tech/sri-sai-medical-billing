// middleware.ts
import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default clerkMiddleware((auth, req: NextRequest) => {
  const { pathname } = req.nextUrl;

  // ── All employee routes bypass Clerk completely ─────────────
  if (
    pathname.startsWith('/employee') ||
    pathname.startsWith('/api/employee/') ||
    pathname.startsWith('/api/auth/store-login') ||
    pathname.startsWith('/api/store/employee-auth')
  ) {
    return NextResponse.next();
  }

  // Everything else uses Clerk (existing behaviour)
  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
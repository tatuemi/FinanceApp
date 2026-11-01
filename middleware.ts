import { type NextRequest } from 'next/server';
import { updateSessionAndProtectRoutes } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSessionAndProtectRoutes(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|icons/.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

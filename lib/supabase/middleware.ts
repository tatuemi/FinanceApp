import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseEnv } from './env';

const PUBLIC_PATHS = new Set(['/login', '/auth/callback', '/manifest.webmanifest']);

export function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/icons/') ||
    pathname === '/sw.js' ||
    pathname === '/favicon.ico'
  ) {
    return true;
  }
  return false;
}

export async function updateSessionAndProtectRoutes(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith('/api/');
  const publicRoute = isPublicRoute(pathname);

  const env = getSupabaseEnv();

  // Si Supabase no está configurado aún, bloquear rutas privadas y redirigir a /login
  if (!env.isConfigured) {
    if (isApiRoute) {
      return NextResponse.json(
        {
          error: 'SERVICE_NOT_CONFIGURED',
          message:
            'El servicio de autenticación y base de datos (Supabase) aún no tiene credenciales configuradas en el entorno.',
        },
        { status: 503 }
      );
    }
    if (!publicRoute) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('reason', 'unconfigured');
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // REGLA DE SEGURIDAD (Sección 3.1): Validar identidad mediante getUser() en servidor, nunca solo getSession()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const isAuthenticated = Boolean(user && !error);

  if (!isAuthenticated && !publicRoute) {
    if (isApiRoute) {
      return NextResponse.json(
        {
          error: 'UNAUTHORIZED',
          message: 'Debes iniciar sesión para acceder a este recurso.',
        },
        { status: 401 }
      );
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    if (pathname !== '/' && pathname !== '/dashboard') {
      loginUrl.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && pathname === '/login') {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    dashboardUrl.search = '';
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}

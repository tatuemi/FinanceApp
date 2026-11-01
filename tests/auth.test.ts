import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { getSupabaseEnv, sanitizeRedirectPath } from '@/lib/supabase/env';
import { isPublicRoute, updateSessionAndProtectRoutes } from '@/lib/supabase/middleware';

describe('Fase 4: Autenticación Google, Protección de Rutas y Variables de Entorno', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('detecta credenciales no configuradas o valores de plantilla en getSupabaseEnv()', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const res1 = getSupabaseEnv();
    expect(res1.isConfigured).toBe(false);
    expect(res1.missingVars).toContain('NEXT_PUBLIC_SUPABASE_URL');
    expect(res1.missingVars).toContain(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
    );

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://tu-proyecto.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'tu-clave-anon-o-publishable-publica';

    const res2 = getSupabaseEnv();
    expect(res2.isConfigured).toBe(false);

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcdefghijklm.supabase.co';
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.realanonkey';

    const res3 = getSupabaseEnv();
    expect(res3.isConfigured).toBe(true);
    expect(res3.missingVars.length).toBe(0);
  });

  it('previene ataques Open Redirect en sanitizeRedirectPath()', () => {
    expect(sanitizeRedirectPath('/portfolio')).toBe('/portfolio');
    expect(sanitizeRedirectPath('/finances?month=2026-10')).toBe('/finances?month=2026-10');
    expect(sanitizeRedirectPath('https://malicious.example.com')).toBe('/dashboard');
    expect(sanitizeRedirectPath('//malicious.example.com')).toBe('/dashboard');
    expect(sanitizeRedirectPath('/\\malicious.example.com')).toBe('/dashboard');
    expect(sanitizeRedirectPath('')).toBe('/dashboard');
    expect(sanitizeRedirectPath(null)).toBe('/dashboard');
  });

  it('clasifica correctamente rutas públicas y privadas en isPublicRoute()', () => {
    expect(isPublicRoute('/login')).toBe(true);
    expect(isPublicRoute('/auth/callback')).toBe(true);
    expect(isPublicRoute('/manifest.webmanifest')).toBe(true);
    expect(isPublicRoute('/sw.js')).toBe(true);
    expect(isPublicRoute('/icons/icon-192.svg')).toBe(true);

    expect(isPublicRoute('/dashboard')).toBe(false);
    expect(isPublicRoute('/finances')).toBe(false);
    expect(isPublicRoute('/transactions')).toBe(false);
    expect(isPublicRoute('/portfolio')).toBe(false);
    expect(isPublicRoute('/assets')).toBe(false);
    expect(isPublicRoute('/investments')).toBe(false);
    expect(isPublicRoute('/settings')).toBe(false);
    expect(isPublicRoute('/api/market/quote')).toBe(false);
  });

  it('bloquea rutas privadas y endpoints API cuando no hay sesión ni configuración activa', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    const reqDashboard = new NextRequest('http://localhost:3000/dashboard');
    const resDashboard = await updateSessionAndProtectRoutes(reqDashboard);
    expect(resDashboard.status).toBe(307);
    expect(resDashboard.headers.get('location')).toContain('/login');

    const reqApi = new NextRequest('http://localhost:3000/api/market/quote?assetId=1');
    const resApi = await updateSessionAndProtectRoutes(reqApi);
    expect(resApi.status).toBe(503);
  });
});

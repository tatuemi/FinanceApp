import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import manifest from '@/app/manifest';
import {
  formatCurrencyUSD,
  formatSharePriceUSD,
  formatShareQuantity,
  formatPercentage,
  normalizeEntityId,
} from '@/lib/utils/format';

describe('Fase 8 y 9: PWA, Seguridad del Service Worker, Formatos y Ausencia de Secretos en Cliente', () => {
  it('genera un manifest PWA válido con display standalone e iconos 192x192 y 512x512 existentes', () => {
    const m = manifest();
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBe('/dashboard');
    expect(m.scope).toBe('/');
    expect(Array.isArray(m.icons)).toBe(true);

    const sizes = (m.icons ?? []).map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');

    // Verificar que los archivos de iconos existan físicamente en public/icons/
    const publicDir = path.resolve(__dirname, '../public');
    for (const icon of m.icons ?? []) {
      const iconPath = path.join(publicDir, icon.src);
      expect(fs.existsSync(iconPath)).toBe(true);
      const stat = fs.statSync(iconPath);
      expect(stat.size).toBeGreaterThan(100);
    }
  });

  it('verifica que el Service Worker excluya rutas privadas, APIs y autenticación de la caché', () => {
    const swPath = path.resolve(__dirname, '../public/sw.js');
    const swContent = fs.readFileSync(swPath, 'utf-8');

    expect(swContent).toContain("pathname.startsWith('/api/')");
    expect(swContent).toContain("pathname.startsWith('/auth/')");
    expect(swContent).toContain("pathname.startsWith('/dashboard')");
    expect(swContent).toContain("pathname.startsWith('/portfolio')");
  });

  it('formatea importes USD, cantidades fraccionadas, porcentajes e IDs BIGINT opacos sin pérdida de precisión', () => {
    // ID BIGINT superior a Number.MAX_SAFE_INTEGER (9007199254740991)
    const bigIntStr = '9223372036854775806';
    expect(normalizeEntityId(bigIntStr)).toBe(bigIntStr);
    expect(() => normalizeEntityId('0')).toThrow();
    expect(() => normalizeEntityId('-5')).toThrow();
    expect(() => normalizeEntityId('abc')).toThrow();

    expect(formatCurrencyUSD('1250.5000')).toBe('$1,250.50');
    expect(formatCurrencyUSD('-45.2000')).toBe('-$45.20');
    expect(formatCurrencyUSD('45.2000', { showSign: true })).toBe('+$45.20');

    expect(formatSharePriceUSD('185.25000000')).toBe('$185.25');
    expect(formatSharePriceUSD('0.12340000')).toBe('$0.1234');

    expect(formatShareQuantity('0.2500000000')).toBe('0.25');
    expect(formatShareQuantity('1.7500000000')).toBe('1.75');
    expect(formatShareQuantity('10.0000000000')).toBe('10');

    expect(formatPercentage(null)).toBe('N/A');
    expect(formatPercentage('14.567', { showSign: true })).toBe('+14.57%');
  });

  it('comprueba que ninguna clave privada de OAuth, Supabase Service Role o API bursátil use NEXT_PUBLIC_', () => {
    const forbiddenClientVars = [
      'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
      'NEXT_PUBLIC_GOOGLE_CLIENT_SECRET',
      'NEXT_PUBLIC_TWELVE_DATA_API_KEY',
      'NEXT_PUBLIC_FINNHUB_API_KEY',
    ];

    const dirsToScan = ['app', 'components', 'lib'];
    const rootDir = path.resolve(__dirname, '..');

    function scanDir(dirPath: string) {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && /\.(ts|tsx|js|mjs)$/.test(entry.name)) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          for (const forbidden of forbiddenClientVars) {
            expect(content).not.toContain(forbidden);
          }
        }
      }
    }

    for (const d of dirsToScan) {
      scanDir(path.join(rootDir, d));
    }
  });
});

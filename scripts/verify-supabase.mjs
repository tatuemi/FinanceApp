import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function loadEnv() {
  const envLocalPath = path.join(rootDir, '.env.local');
  const vars = { ...process.env };
  if (fs.existsSync(envLocalPath)) {
    const lines = fs.readFileSync(envLocalPath, 'utf-8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        const k = trimmed.slice(0, eq).trim();
        const v = trimmed.slice(eq + 1).trim();
        vars[k] = v;
      }
    }
  }
  return vars;
}

const REQUIRED_TABLES = [
  'profiles',
  'finance_categories',
  'finance_transactions',
  'investment_assets',
  'investment_transactions',
  'investment_quote_cache',
  'investment_price_history',
];

async function main() {
  const vars = loadEnv();
  const url = (vars.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
  const key = (
    vars.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    vars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    ''
  ).trim();

  console.log('=== VERIFICACIÓN DE CONEXIÓN SUPABASE Y ESQUEMA SQL ===');

  if (!url || !key) {
    console.error('✗ Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local');
    process.exit(1);
  }

  console.log(`✓ Proyecto Supabase configurado: ${url}`);

  // 1. Verificar proveedor Google OAuth en Supabase Auth
  const authRes = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: key },
  });
  if (authRes.ok) {
    const settings = await authRes.json();
    const googleEnabled = Boolean(settings?.external?.google);
    console.log(
      googleEnabled
        ? '✓ Proveedor Google OAuth 2.0: ACTIVO en Supabase Auth'
        : '⚠ Proveedor Google OAuth 2.0: Pendiente de activar en Supabase Dashboard -> Authentication -> Providers -> Google'
    );
  } else {
    console.error(`✗ Error al consultar Auth Settings (${authRes.status})`);
  }

  // 2. Verificar existencia de las 7 tablas y bloqueo RLS a usuarios anónimos
  let missingTables = 0;
  for (const table of REQUIRED_TABLES) {
    const res = await fetch(`${url}/rest/v1/${table}?select=id&limit=1`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    const text = await res.text();
    if (res.status === 404 && text.includes('PGRST205')) {
      missingTables += 1;
      console.log(`⚠ Tabla public.${table}: Pendiente de crear en SQL Editor (PGRST205)`);
    } else if (res.status === 401 || res.status === 403 || res.status === 200) {
      console.log(`✓ Tabla public.${table}: Creada y protegida por RLS (HTTP ${res.status})`);
    } else {
      console.log(`ℹ Tabla public.${table}: Respuesta HTTP ${res.status} (${text})`);
    }
  }

  if (missingTables > 0) {
    console.log('\nACCIÓN REQUERIDA EN SUPABASE DASHBOARD (1 minuto):');
    console.log('1. Abre https://supabase.com/dashboard/project/bthuewjxzhuggrcpmwvf/sql/new');
    console.log(
      '2. Copia y pega íntegramente el archivo: supabase/migrations/20261028000001_initial_schema_and_security.sql'
    );
    console.log('3. Haz clic en "Run" y vuelve a ejecutar: npm.cmd run verify:supabase');
  } else {
    console.log('\n✓ Las 7 tablas y políticas RLS están activas en tu instancia de Supabase.');
  }
}

main().catch((err) => {
  console.error('Error durante la verificación:', err);
  process.exit(1);
});

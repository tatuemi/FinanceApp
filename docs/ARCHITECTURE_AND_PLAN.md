# Arquitectura y Plan de Implementación (Fase 1)

**Fecha de inspección y consulta de documentación:** 2026-10-28  
**Objetivo de costo operativo:** $0.00 USD / mes

---

## 1. Inspección del Entorno y Repositorio

### 1.1. Estado inicial del directorio
- Ruta de trabajo: `C:\Users\emili\OneDrive\Escritorio\app finanzas`
- Archivos existentes inicialmente: únicamente `Master_Prompt.md` (54,637 bytes).
- Repositorio Git: no inicializado inicialmente (se inicializará dentro del proyecto con `.gitignore` estricto para proteger `.env*`).

### 1.2. Herramientas verificadas en el entorno
| Herramienta | Versión / Estado | Notas operativas |
|---|---|---|
| Sistema Operativo | Windows (PowerShell 5.1.26100) | Uso de `npm.cmd` y `npx.cmd` debido a la política de ejecución de scripts `.ps1` de PowerShell |
| Node.js | `v26.13.0` | Compatible con Next.js (App Router), TypeScript 5+ y herramientas modernas de testing |
| npm / npx | `v11.20.0` | Gestor de paquetes principal con `package-lock.json` |
| Git | `v2.56.0.windows.2` | Control de versiones local |

---

## 2. Verificación de Servicios Externos, Cuotas, Licencias y Costo Cero

**Fecha de verificación de condiciones y precios:** 2026-10-28

| Servicio / Librería | Plan seleccionado | Costo | Límites y Cuotas Verificadas | Restricciones de Licencia / Uso |
|---|---|---|---|---|
| **Supabase** (PostgreSQL + Auth) | Free Plan | $0 USD (sin tarjeta obligatoria) | 500 MB DB, 50,000 MAU en Auth, RLS ilimitado en motor Postgres, 5 GB egress. Pausa tras 7 días de inactividad (reactivación manual gratuita). | Uso personal y de producción permitido dentro de la cuota gratuita. Sin cobros automáticos en el plan Free. |
| **Google Cloud OAuth 2.0** | Google Identity (OAuth 2.0) | $0 USD | Sin costo para autenticación con alcances básicos (`openid`, `email`, `profile`). | Uso exclusivo de identidad básica; no solicita acceso a Gmail, Drive ni Contactos. |
| **Twelve Data API** (Proveedor primario recomendado) | Basic (Free Tier) | $0 USD (sin tarjeta) | 800 créditos/peticiones por día, máximo 8 peticiones por minuto. Soporta `/quote` y `/time_series` (OHLC histórico diario/semanal/mensual para acciones y ETF de EE. UU.). | Uso personal permitido en interfaz privada. Prohibida la redistribución pública masiva. |
| **Finnhub API** (Proveedor secundario soportado) | Free Plan | $0 USD (sin tarjeta) | Hasta 50–60 llamadas/minuto en datos de mercado de EE. UU. (`/quote` y `/stock/candle`). Nota: `/stock/candle` en plan gratuito puede devolver `403` para mercados fuera de EE. UU. o rangos restringidos. | Estricto para uso personal (`Personal Use`). |
| **TradingView Lightweight Charts** | Open Source (`lightweight-charts`) | $0 USD | Sin límites de ejecución local. | Licencia Apache 2.0. Requiere conservar aviso de atribución y enlace visible a `https://www.tradingview.com` (`attributionLogo: true` + mención en la interfaz). |
| **Vercel** | Hobby Plan | $0 USD (sin tarjeta) | 100 GB Fast Data Transfer/mes, 1,000,000 invocaciones de funciones/mes. Límites duros (pausa temporal si se excede, nunca factura automáticamente). | **Estrictamente uso personal y no comercial** (`Personal, Non-Commercial Use`). |

---

## 3. Diseño de Arquitectura Final

### 3.1. Pila Tecnológica
- **Framework:** Next.js (App Router) con React 19 y TypeScript en modo estricto (`strict: true`, `noUncheckedIndexedAccess: true`).
- **Estilos:** Tailwind CSS + iconos `lucide-react`.
- **Base de Datos y Auth:** Supabase (`@supabase/supabase-js` y `@supabase/ssr`).
- **Validación y Formularios:** `zod`, `react-hook-form`, `@hookform/resolvers`.
- **Precisión Numérica:** Aritmética decimal exacta en el dominio (`decimal.js`) alineada con columnas `NUMERIC(19,4)`, `NUMERIC(20,8)` y `NUMERIC(28,10)` de PostgreSQL. Los `id BIGINT` se manejan como `string` opacos en TypeScript/JSON para no perder precisión.
- **Gráficos:**
  - `lightweight-charts` para gráficos históricos de precios (velas OHLC y línea de cierre) con atribución a TradingView.
  - `recharts` para gráficos de distribución del portafolio (dona) y evolución/desglose financiero.
- **PWA:** `app/manifest.ts` + Service Worker seguro (`public/sw.js`) que solo almacena en caché recursos estáticos de interfaz, excluyendo estrictamente rutas `/api/*`, `/auth/*` y datos financieros privados.
- **Pruebas Automatizadas:** `vitest` + `@testing-library/react` + `@electric-sql/pglite` (motor PostgreSQL real en WebAssembly para verificar migraciones SQL, claves foráneas compuestas, triggers, funciones PL/pgSQL y aislamiento RLS entre usuarios sin depender de servidores externos).

### 3.2. Modelo de Datos y Seguridad (Surrogate Keys + RLS)
- Todas las 7 tablas de negocio (`profiles`, `finance_categories`, `finance_transactions`, `investment_assets`, `investment_transactions`, `investment_quote_cache`, `investment_price_history`) utilizan `id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY` y `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`.
- **Integridad cruzada por usuario:** Claves foráneas compuestas (`(category_id, user_id, transaction_type)` y `(asset_id, user_id)`) que impiden en motor PostgreSQL asociar transacciones a categorías o activos de otro usuario o de distinto tipo.
- **RLS Estricto:** Políticas independientes `SELECT`, `INSERT`, `UPDATE`, `DELETE` para el rol `authenticated` comprobando `(select auth.uid()) = user_id`. Sin permisos de escritura ni lectura para `anon`.
- **Validación transaccional de ventas:** Función PL/pgSQL y trigger `BEFORE INSERT OR UPDATE OR DELETE ON public.investment_transactions` (con bloqueo por activo `pg_advisory_xact_lock`) que verifica cronológicamente (`ORDER BY trade_date ASC, id ASC`) que en ningún punto del historial la cantidad acumulada de títulos sea negativa, rechazando ventas en descubierto o modificaciones retroactivas inválidas directamente en PostgreSQL.

### 3.3. Capa de Datos Bursátiles y Degradación Controlada
- Interfaz `MarketDataProvider` desacoplada en `lib/market-data/`:
  - Adaptador `TwelveDataProvider` (soporta cotizaciones y velas históricas OHLC en plan gratuito).
  - Adaptador `FinnhubProvider` (soporta cotizaciones y velas para acciones de EE. UU.).
  - Selección mediante variable `MARKET_DATA_PROVIDER` (`twelvedata` | `finnhub` | `manual`).
- Caché persistente en PostgreSQL (`investment_quote_cache` e `investment_price_history`) con TTL configurable (por defecto 15 minutos para cotizaciones y 24 horas para velas diarias) y control de tasa de refresco para no agotar las cuotas gratuitas.
- **Modo Manual Garantizado:** Si no hay clave de API configurada, si el proveedor devuelve `429 Too Many Requests` o si un símbolo no tiene cobertura gratuita, el usuario puede registrar y actualizar cotizaciones manuales identificadas con `provider = 'manual'` y fecha de referencia, manteniendo 100% operativo el portafolio.

---

## 4. Variables de Entorno y Credenciales Externas

Ninguna credencial es inventada ni almacenada en el código. En `.env.example` se documentan:

| Variable | Servicio | Exposición | Propósito y Dónde Configurarse |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | Cliente / Servidor | URL del proyecto Supabase (`Project Settings > API`). Se configura en `.env.local` y en Vercel Environment Variables. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase | Cliente / Servidor | Clave pública (`anon` / `publishable key`) sujeta a RLS (`Project Settings > API`). También se admite `NEXT_PUBLIC_SUPABASE_ANON_KEY` como alias compatible. |
| `GOOGLE_CLIENT_ID` | Google Cloud OAuth | Servidor (Supabase Auth Dashboard) | ID de cliente OAuth 2.0 creado en Google Cloud Console (`APIs & Services > Credentials`) y configurado en Supabase (`Authentication > Providers > Google`). |
| `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth | Servidor (Supabase Auth Dashboard) | Secreto de cliente OAuth 2.0 configurado exclusivamente en el panel de Supabase Auth. |
| `MARKET_DATA_PROVIDER` | Aplicación | Servidor | Proveedor activo: `twelvedata`, `finnhub` o `manual`. |
| `TWELVE_DATA_API_KEY` | Twelve Data | Servidor exclusivamente | API Key gratuita obtenida en `twelvedata.com`. Se configura en `.env.local` y Vercel (nunca con `NEXT_PUBLIC_`). |
| `FINNHUB_API_KEY` | Finnhub | Servidor exclusivamente | API Key gratuita obtenida en `finnhub.io`. Se configura en `.env.local` y Vercel (nunca con `NEXT_PUBLIC_`). |
| `NEXT_PUBLIC_APP_URL` | Aplicación | Cliente / Servidor | URL base (`http://localhost:3000` en local, URL HTTPS de Vercel en producción) para redirecciones OAuth y metadatos. |

---

## 5. Plan Secuencial de Fases y Comprobaciones

1. **Fase 1 — Inspección y planificación:** Inspección del entorno, verificación de servicios gratuitos y documentación de este plan arquitectónico.
2. **Fase 2 — Inicialización y estructura base:** Configuración de Next.js (App Router), TypeScript estricto, Tailwind CSS, estructura modular de carpetas (`app`, `components`, `lib`, `types`, `supabase`, `tests`), `.env.example`, ESLint y verificación de compilación inicial.
3. **Fase 3 — PostgreSQL y seguridad:** Creación de migraciones SQL en `supabase/migrations/`, las 7 tablas con `BIGINT GENERATED ALWAYS AS IDENTITY`, claves foráneas compuestas, políticas RLS, triggers de validación cronológica de ventas, funciones de portafolio y suite de pruebas automatizadas con PostgreSQL real (PGlite) demostrando aislamiento entre usuarios.
4. **Fase 4 — Autenticación Google:** Cliente SSR de Supabase (`@supabase/ssr`), middleware/guardia de sesión con `supabase.auth.getUser()`, pantalla `/login`, ruta `/auth/callback`, creación idempotente de perfil y categorías semilla opcionales, cierre de sesión y guía de configuración de Google OAuth.
5. **Fase 5 — Módulo de finanzas personales:** Lógica de dominio, validaciones Zod, Server Actions / Route Handlers, gestión de categorías personalizadas (con protección ante eliminación si tienen movimientos), CRUD completo de ingresos/gastos, dashboard financiero mensual con comparativa y gráficos, e historial paginado con filtros.
6. **Fase 6 — Portafolio de inversiones:** Gestión de activos (acciones y ETF), motor de cálculo de **costo promedio ponderado móvil** con precisión decimal exacta, soporte de fracciones y compra/venta por cantidad o por importe en USD, validación cronológica contra ventas sin títulos suficientes y pruebas unitarias exhaustivas.
7. **Fase 7 — API bursátil y gráficos:** Adaptadores de servidor (`TwelveDataProvider`, `FinnhubProvider` y cotización manual), rutas protegidas `/api/market/quote` y `/api/market/history` con caché en PostgreSQL y manejo de código `429`, gráfico histórico interactivo con `lightweight-charts` (y atribución a TradingView) y gráfico de dona de distribución con `recharts`.
8. **Fase 8 — PWA y adaptación móvil:** `app/manifest.ts`, iconos SVG/PNG 192x192 y 512x512, Service Worker seguro para activos estáticos, guía/banner de instalación en PC/Android/iOS y navegación adaptable (barra lateral en escritorio, barra inferior en móvil).
9. **Fase 9 — Pruebas y control de calidad:** Ejecución completa de `tsc --noEmit`, ESLint, pruebas unitarias y de integración (cálculos financieros, validaciones Zod, costo promedio móvil, fracciones, bloqueo de ventas en corto, aislamiento RLS en PostgreSQL, límites de API y estados de cotización) y `next build` de producción.
10. **Fase 10 — Preparación para despliegue:** Inicialización de repositorio Git local, revisión de seguridad para confirmar ausencia de secretos en el cliente, configuración para Vercel Hobby y procedimiento de reactivación ante pausa de Supabase Free.
11. **Fase 11 — Documentación y entrega final:** `README.md` integral con guías paso a paso de instalación local, Supabase, Google OAuth, API bursátil, Vercel, PWA, fórmulas financieras, resultados de pruebas y estado final del proyecto.

# Finanzas & Portafolio Personal (PWA)

Plataforma web full-stack de **gestión de finanzas personales** y **seguimiento de portafolio de inversiones (acciones y ETF)** con soporte de títulos fraccionados, diseñada bajo una arquitectura de **costo operativo $0.00 USD mensuales**, seguridad estricta en PostgreSQL mediante **Row Level Security (RLS)** y experiencia **Progressive Web App (PWA)** instalable en computadora, Android e iOS.

---

## Tabla de Contenidos

1. [Resumen de Funcionalidades Implementadas](#1-resumen-de-funcionalidades-implementadas)
2. [Filosofía de Costo Cero y Cuotas Verificadas](#2-filosofía-de-costo-cero-y-cuotas-verificadas)
3. [Estructura del Proyecto](#3-estructura-del-proyecto)
4. [Instalación y Ejecución Local](#4-instalación-y-ejecución-local)
5. [Configuración de Supabase (PostgreSQL, Migraciones y RLS)](#5-configuración-de-supabase-postgresql-migraciones-y-rls)
6. [Configuración de Google OAuth 2.0](#6-configuración-de-google-oauth-20)
7. [Configuración de la API Bursátil Gratuita y Modo Manual](#7-configuración-de-la-api-bursátil-gratuita-y-modo-manual)
8. [Metodología de Cálculos Financieros y de Portafolio](#8-metodología-de-cálculos-financieros-y-de-portafolio)
9. [Guía de Despliegue en Vercel Hobby](#9-guía-de-despliegue-en-vercel-hobby)
10. [Instalación como Aplicación (PWA) en PC, Android e iOS](#10-instalación-como-aplicación-pwa-en-pc-android-e-ios)
11. [Resultados de Pruebas y Control de Calidad](#11-resultados-de-pruebas-y-control-de-calidad)
12. [Limitaciones Conocidas (Versión 1.0) y Acciones Manuales Pendientes](#12-limitaciones-conocidas-versión-10-y-acciones-manuales-pendientes)

---

## 1. Resumen de Funcionalidades Implementadas

### Módulo 0: Acceso, Seguridad y Perfil
- Inicio de sesión con **Google OAuth 2.0** mediante Supabase Auth (`@supabase/ssr`), solicitando únicamente permisos de identidad básica (`openid email profile`).
- Validación de sesión en el servidor con `supabase.auth.getUser()` (nunca confiando exclusivamente en `getSession()`).
- Protección en middleware de todas las rutas privadas (`/dashboard`, `/finances`, `/transactions`, `/portfolio`, `/assets`, `/investments`, `/settings`) y endpoints `/api/*`.
- Creación idempotente del perfil en `public.profiles` e inicialización automática de las 11 categorías financieras base al primer acceso.
- Protección contra vulnerabilidades *Open Redirect* en el callback de autenticación.

### Módulo 1: Finanzas Personales
- **CRUD completo de ingresos y gastos** en USD (`NUMERIC(19,4)`), con confirmación antes de eliminar y actualización inmediata de métricas.
- **Categorías personalizadas** con nombre, tipo (`income` / `expense`), color hexadecimal e icono controlado.
- **Integridad de tipos y propietario:** tanto la aplicación como la clave foránea compuesta en PostgreSQL (`finance_transaction_category_owner_fk`) impiden asociar una categoría de gasto a un ingreso o referenciar categorías de otro usuario.
- **Protección al eliminar categorías:** si una categoría tiene operaciones asociadas, el sistema exige reasignarlas explícitamente a otra categoría del mismo tipo antes de eliminarla.
- **Dashboard financiero mensual:** ingresos del mes, gastos del mes, balance mensual (`Ingresos − Gastos`), comparativa porcentual con el mes anterior, gráfico de evolución diaria acumulada y desglose por categorías.
- **Historial financiero independiente:** búsqueda por descripción, filtros por tipo, categoría y rango de fechas, ordenación cronológica y paginación. Las compras/ventas bursátiles no se mezclan con gastos/ingresos ordinarios para evitar duplicaciones contables.

### Módulo 2: Portafolio de Acciones y ETF
- **Catálogo de activos:** registro de acciones (`stock`) y fondos cotizados (`etf`) con normalización del símbolo a mayúsculas, bolsa (`exchange`) y símbolo específico para el proveedor de datos (`provider_symbol`).
- **Compras y ventas con títulos fraccionados (`NUMERIC(28,10)`):**
  - Registro directo por **cantidad de títulos** (admite fracciones como `0.25`, `0.5`, `1.75`).
  - Registro por **importe en USD** (`Cantidad = Importe de la operación / Precio por título`).
  - Separación clara entre el precio de ejecución confirmado y la cotización de mercado de referencia.
- **Validación cronológica estricta de ventas:**
  - Verifica todo el historial del activo ordenado por `(trade_date ASC, id ASC)` tanto en la capa de dominio como mediante el trigger transaccional `validate_investment_ledger_consistency` en PostgreSQL (con bloqueo `pg_advisory_xact_lock`).
  - Impide ventas que dejen la posición en negativo y bloquea ediciones o eliminaciones retroactivas de compras si invalidan una venta posterior.
- **Motor de Costo Promedio Ponderado Móvil** con aritmética decimal exacta (`decimal.js`).
- **Indicadores y gráficos del portafolio:**
  - Valor de mercado total valorado, costo base restante, ganancia/pérdida no realizada ($ y %), ganancia/pérdida realizada acumulada en ventas, peso porcentual por activo y distribución Acciones vs ETF.
  - Alerta explícita de valoración incompleta cuando existen activos sin cotización disponible (nunca se asume precio `$0.00`).
  - Gráfico histórico interactivo por activo con `lightweight-charts` (línea de cierre y velas OHLC, selector `1M`, `3M`, `6M`, `1Y`, `5Y` y atribución oficial a TradingView).
  - Gráfico de dona de distribución del portafolio con `recharts`.

---

## 2. Filosofía de Costo Cero y Cuotas Verificadas

**Fecha de consulta de condiciones y precios:** 2026-10-28

| Servicio | Plan Gratuito | Límites Verificados | Política ante Agotamiento |
|---|---|---|---|
| **Supabase** | Free Plan ($0/mes) | 500 MB PostgreSQL, 50,000 MAU en Auth, 5 GB egress, RLS ilimitado en motor Postgres. Pausa tras 7 días sin actividad. | No genera cobros automáticos. Si se pausa por inactividad, se reactiva gratis desde el panel. |
| **Twelve Data** | Basic Free ($0/mes) | 800 peticiones/día, 8 peticiones/minuto. Cubre `/quote` y `/time_series` (velas OHLC diarias/semanales de acciones y ETF de EE. UU.). | Caché persistente en PostgreSQL (TTL 15 min cotizaciones / 12 h historial). Si devuelve `429`, muestra la última cotización en caché y habilita precio manual. |
| **Finnhub** | Free Plan ($0/mes) | 50–60 llamadas/minuto para acciones de EE. UU. (uso personal). | Soportado como proveedor alternativo (`MARKET_DATA_PROVIDER=finnhub`). |
| **Vercel** | Hobby Plan ($0/mes) | 100 GB Fast Data Transfer/mes, 1,000,000 invocaciones de funciones/mes. Uso personal no comercial. | Límite duro sin facturación automática. |

---

## 3. Estructura del Proyecto

```text
/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx               # Pantalla de acceso con Google OAuth y avisos de estado
│   ├── (dashboard)/
│   │   ├── layout.tsx                   # Layout autenticado con barra lateral/navegación móvil
│   │   ├── loading.tsx                  # Estado de carga global del dashboard
│   │   ├── error.tsx                    # Control de errores recuperables sin exponer trazas
│   │   ├── dashboard/page.tsx           # Resumen general consolidado
│   │   ├── finances/page.tsx            # Dashboard financiero mensual, CRUD y categorías
│   │   ├── transactions/page.tsx        # Historial financiero con filtros y paginación
│   │   ├── portfolio/page.tsx           # Dashboard de portafolio, distribución y gráficos
│   │   ├── assets/page.tsx              # Gestión de acciones y ETF registrados
│   │   ├── investments/page.tsx         # Registro e historial de compras y ventas
│   │   └── settings/page.tsx            # Perfil, moneda base e instalación PWA
│   ├── api/
│   │   └── market/
│   │       ├── quote/route.ts           # Endpoint protegido de cotizaciones con caché
│   │       └── history/route.ts         # Endpoint protegido de velas históricas OHLC
│   ├── auth/
│   │   ├── callback/route.ts            # Intercambio seguro de código OAuth + creación de perfil
│   │   └── signout/route.ts             # Cierre de sesión e invalidación de cookies
│   ├── layout.tsx                       # Metadatos raíz y configuración de viewport PWA
│   ├── manifest.ts                      # Web App Manifest (standalone, iconos 192 y 512)
│   └── globals.css                      # Estilos base con Tailwind CSS
├── components/
│   ├── auth/GoogleSignInButton.tsx
│   ├── charts/
│   │   ├── AssetPriceChart.tsx          # Gráfico histórico con TradingView lightweight-charts
│   │   ├── PortfolioAllocationChart.tsx # Gráfico de dona con Recharts
│   │   └── FinanceCharts.tsx            # Evolución de balance y desglose por categorías
│   ├── dashboard/
│   │   ├── AppShell.tsx                 # Navegación responsive (PC y móvil)
│   │   └── SettingsView.tsx             # Preferencias de perfil y estado de proveedores
│   ├── finances/
│   │   ├── FinanceWorkspace.tsx         # Gestión integral de ingresos, gastos y categorías
│   │   └── FinanceHistoryView.tsx       # Buscador y tabla paginada de movimientos
│   ├── portfolio/
│   │   ├── PortfolioDashboardView.tsx   # Indicadores del portafolio y posiciones abiertas
│   │   ├── AssetsManagerView.tsx        # CRUD de activos y cotizaciones manuales
│   │   └── InvestmentTransactionsView.tsx # Registro de compras/ventas (fracciones o importe)
│   └── ui/                              # Iconos, diálogos de confirmación, badges e instalador PWA
├── lib/
│   ├── auth/session.ts                  # Verificación getUser() y creación idempotente de perfil
│   ├── finance/                         # Cálculos decimales, consultas y Server Actions financieras
│   ├── investments/                     # Motor de costo promedio móvil, consultas y Server Actions
│   ├── market-data/                     # Abstracción MarketDataProvider (Twelve Data, Finnhub, Manual)
│   ├── supabase/                        # Clientes Browser, Server SSR y Middleware
│   ├── utils/                           # Formateadores USD, fracciones y normalización BIGINT
│   └── validations/                     # Esquemas Zod para finanzas e inversiones
├── public/
│   ├── icons/                           # Iconos PWA 192x192 y 512x512 (PNG y SVG)
│   └── sw.js                            # Service Worker seguro (solo recursos estáticos de UI)
├── supabase/
│   ├── migrations/
│   │   └── 20261028000001_initial_schema_and_security.sql # Esquema, claves sustitutas, triggers y RLS
│   └── tests/
│       └── rls_and_schema.test.ts       # Pruebas automatizadas en motor PostgreSQL (PGlite)
├── tests/                               # Suite de pruebas unitarias y de integración (Vitest)
├── types/database.ts                    # Tipos estrictos alineados con PostgreSQL
├── .env.example                         # Plantilla documentada de variables de entorno
└── docs/ARCHITECTURE_AND_PLAN.md        # Documento de arquitectura y plan de fases
```

---

## 4. Instalación y Ejecución Local

### Requisitos previos
- **Node.js** 20+ (verificado en `v26.13.0`).
- **npm** 10+ (verificado en `v11.20.0`).

### Pasos
1. Clona o abre la carpeta del proyecto e instala las dependencias:
   ```bash
   npm install
   ```
2. Crea tu archivo `.env.local` copiando la plantilla `.env.example`:
   ```bash
   cp .env.example .env.local
   ```
3. Completa las variables de entorno en `.env.local` siguiendo las secciones 5, 6 y 7 de esta guía.
4. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```
5. Abre `http://localhost:3000` en tu navegador.

### Comandos de verificación disponibles
```bash
npm run typecheck   # Comprobación estricta de tipos TypeScript (tsc --noEmit)
npm run lint        # Linter ESLint sin advertencias permitidas
npm test            # Ejecución completa de las 25 pruebas automatizadas (incluye PostgreSQL PGlite)
npm run build       # Compilación optimizada de producción
```

---

## 5. Configuración de Supabase (PostgreSQL, Migraciones y RLS)

### 5.1. Crear el proyecto gratuito
1. Entra en [https://supabase.com](https://supabase.com) e inicia sesión.
2. Crea un nuevo proyecto seleccionando el **Plan Free ($0/mes)**.
3. En **Project Settings → API**, copia:
   - `Project URL` → asígnalo a `NEXT_PUBLIC_SUPABASE_URL` en `.env.local`.
   - `anon` / `publishable` key → asígnalo a `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local`.
   - **Importante:** Nunca copies la clave `service_role` al cliente ni la expongas con `NEXT_PUBLIC_`.

### 5.2. Ejecutar la migración SQL en una instancia nueva
1. En el panel de tu proyecto Supabase, abre **SQL Editor → New query**.
2. Abre el archivo local [`supabase/migrations/20261028000001_initial_schema_and_security.sql`](./supabase/migrations/20261028000001_initial_schema_and_security.sql), copia todo su contenido y ejecútalo (**Run**).
3. Esta migración crea de forma idempotente:
   - Los tipos enumerados (`finance_transaction_type`, `investment_asset_type`, `investment_transaction_type`).
   - Las 7 tablas con clave primaria `id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY` y `user_id UUID`.
   - Claves foráneas compuestas que garantizan que cada operación apunte únicamente a categorías o activos del mismo usuario.
   - Índices B-tree compuestos optimizados para los filtros reales y RLS.
   - El trigger `validate_investment_ledger_consistency` que impide ventas sin saldo de títulos suficiente.
   - Políticas **Row Level Security (RLS)** independientes (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) en las 7 tablas comprobando `(select auth.uid()) = user_id`.

### 5.3. Cómo restaurar el servicio si Supabase Free pausa el proyecto por inactividad
En el plan gratuito de Supabase, si el proyecto no recibe actividad durante **7 días consecutivos**, se pausa automáticamente para ahorrar recursos sin generar costos:
1. Ingresa a [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Selecciona tu proyecto marcado como **Paused**.
3. Haz clic en el botón **Restore project** (o **Resume project**).
4. En 1 a 2 minutos la instancia de PostgreSQL y Auth vuelve a estar 100% activa con todos tus datos, migraciones y políticas RLS intactas, sin ningún cargo económico.

---

## 6. Configuración de Google OAuth 2.0

1. Entra en [Google Cloud Console](https://console.cloud.google.com/).
2. Crea un proyecto (o selecciona uno existente) y ve a **APIs & Services → OAuth consent screen**:
   - Configura el nombre de la aplicación y añade únicamente los alcances básicos: `openid`, `.../auth/userinfo.email` y `.../auth/userinfo.profile`.
3. Ve a **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Tipo de aplicación: **Web application**.
   - En **Authorized JavaScript origins**, añade:
     - `http://localhost:3000`
     - Tu URL de producción en Vercel (ej. `https://tu-app.vercel.app`).
   - En **Authorized redirect URIs**, añade la URL de callback de tu proyecto Supabase (disponible en **Supabase Dashboard → Authentication → Providers → Google**):
     - `https://<TU-PROYECTO-REF>.supabase.co/auth/v1/callback`
4. Copia el **Client ID** y el **Client Secret** generados por Google y pégalos en **Supabase Dashboard → Authentication → Providers → Google**.
5. En **Supabase Dashboard → Authentication → URL Configuration**:
   - **Site URL:** `http://localhost:3000` (en desarrollo) o `https://tu-app.vercel.app` (en producción).
   - **Redirect URLs:** añade `http://localhost:3000/auth/callback` y `https://tu-app.vercel.app/auth/callback`.

---

## 7. Configuración de la API Bursátil Gratuita y Modo Manual

### Opción A: Twelve Data (Recomendada por cobertura gratuita de historial OHLC)
1. Crea una cuenta gratuita en [https://twelvedata.com](https://twelvedata.com) (Plan Basic Free: $0/mes, sin tarjeta, 800 créditos/día y 8 req/minuto).
2. Copia tu API Key desde el panel de Twelve Data y configúrala exclusivamente en el servidor (`.env.local` o variables de entorno de Vercel):
   ```env
   MARKET_DATA_PROVIDER=twelvedata
   TWELVE_DATA_API_KEY=tu_clave_secreta_de_twelvedata
   ```

### Opción B: Finnhub
1. Crea una cuenta gratuita en [https://finnhub.io](https://finnhub.io) (Plan Free para uso personal: 60 llamadas/minuto para acciones de EE. UU.).
2. Configúrala en `.env.local`:
   ```env
   MARKET_DATA_PROVIDER=finnhub
   FINNHUB_API_KEY=tu_clave_secreta_de_finnhub
   ```

### Opción C: Operar sin cotizaciones automáticas (Modo 100% Manual)
Si prefieres no configurar ninguna clave bursátil externa o si en algún momento alcanzas el límite gratuito del proveedor:
1. Define en `.env.local`:
   ```env
   MARKET_DATA_PROVIDER=manual
   ```
2. En las pantallas **Portafolio** (`/portfolio`) o **Activos** (`/assets`), pulsa el botón **«Manual»** junto a cualquier acción o ETF e introduce el precio unitario en USD.
3. El sistema guarda la cotización en `public.investment_quote_cache` marcada con origen `manual` y fecha de referencia, calculando de inmediato el valor de mercado, las ganancias no realizadas y el gráfico de distribución.

---

## 8. Metodología de Cálculos Financieros y de Portafolio

### 8.1. Balance Financiero Mensual
$$\text{Balance Mensual} = \text{Ingresos del período} - \text{Gastos del período}$$
- Todas las cantidades se almacenan en `NUMERIC(19,4)` y se operan con `decimal.js` sin errores de coma flotante binaria.

### 8.2. Costo Promedio Ponderado Móvil (Portafolio)
Las operaciones de cada activo se procesan en orden cronológico estricto `(trade_date ASC, id ASC)`:
- **En cada compra (`buy`):**
  $$\text{Cantidad acumulada} = \text{Cantidad anterior} + \text{Cantidad comprada}$$
  $$\text{Costo base acumulado} = \text{Costo base anterior} + (\text{Cantidad comprada} \times \text{Precio de ejecución}) + \text{Comisiones}$$
  $$\text{Costo promedio por título} = \frac{\text{Costo base acumulado}}{\text{Cantidad acumulada}}$$
- **En cada venta (`sell`):**
  1. Se verifica que $\text{Cantidad vendida} \le \text{Cantidad acumulada}$. En caso contrario, la operación se rechaza.
  2. Se determina el costo base de los títulos vendidos usando el costo promedio inmediatamente anterior a la venta:
     $$\text{Costo base vendido} = \text{Costo promedio anterior} \times \text{Cantidad vendida}$$
     *(Si se vende el 100% de la posición restante, el costo base vendido es exactamente el costo base restante para evitar residuos de redondeo).*
  3. Se calcula el resultado realizado neto de la venta:
     $$\text{Resultado realizado} = (\text{Cantidad vendida} \times \text{Precio de venta} - \text{Comisiones}) - \text{Costo base vendido}$$
  4. Se actualiza la posición abierta:
     $$\text{Cantidad restante} = \text{Cantidad anterior} - \text{Cantidad vendida}$$
     $$\text{Costo base restante} = \text{Costo base anterior} - \text{Costo base vendido}$$

### 8.3. Valoración de Mercado y Pesos Porcentuales
- Si el activo tiene una cotización válida ($\text{Precio} > 0$):
  $$\text{Valor de mercado} = \text{Cantidad restante} \times \text{Último precio válido}$$
  $$\text{G/P no realizada} = \text{Valor de mercado} - \text{Costo base restante}$$
  $$\text{Rentabilidad no realizada (\%)} = \frac{\text{G/P no realizada}}{\text{Costo base restante}} \times 100 \quad (\text{si Costo base} > 0)$$
  $$\text{Peso del activo (\%)} = \frac{\text{Valor de mercado del activo}}{\text{Valor de mercado total valorado}} \times 100$$
- Si un activo no tiene cotización disponible, **no se asume precio cero**: se mantiene su costo base, se marca como `Sin cotización` y el dashboard informa explícitamente qué activos están pendientes de valoración.

---

## 9. Guía de Despliegue en Vercel Hobby

1. Sube el repositorio a tu cuenta de GitHub (verifica que `.env` y `.env.local` estén excluidos por `.gitignore`).
2. Entra en [https://vercel.com](https://vercel.com) con una cuenta **Hobby ($0/mes, uso personal no comercial)**.
3. Importa el repositorio de GitHub y, en la sección **Environment Variables**, añade:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `MARKET_DATA_PROVIDER` (`twelvedata`, `finnhub` o `manual`)
   - `TWELVE_DATA_API_KEY` (si usas Twelve Data)
   - `FINNHUB_API_KEY` (si usas Finnhub)
   - `NEXT_PUBLIC_APP_URL` (la URL HTTPS asignada por Vercel, ej. `https://tu-proyecto.vercel.app`)
4. Haz clic en **Deploy**.
5. Una vez desplegado, añade `https://tu-proyecto.vercel.app/auth/callback` en **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**.

---

## 10. Instalación como Aplicación (PWA) en PC, Android e iOS

La aplicación sirve un Web App Manifest válido (`/manifest.webmanifest`), iconos en `192x192` y `512x512` píxeles y un Service Worker seguro (`/sw.js`):
- **En Computadora (Chrome, Edge, Brave):** abre la URL HTTPS y haz clic en el botón **«Instalar App»** de la barra superior/lateral o en el icono de instalación de la barra de direcciones.
- **En Android (Chrome):** abre el menú del navegador (`⋮`) y selecciona **«Instalar aplicación»** o **«Añadir a la pantalla de inicio»**.
- **En iOS / iPadOS (Safari):** toca el botón **Compartir** en la barra de Safari y selecciona **«Agregar a inicio»**.

---

## 11. Resultados de Pruebas y Control de Calidad

Todas las comprobaciones de la Fase 9 han sido ejecutadas y verificadas:

- **TypeScript Estricto (`npm run typecheck`):** `0` errores (`strict: true`, `noUncheckedIndexedAccess: true`).
- **Linter (`npm run lint`):** `0` errores y `0` advertencias.
- **Pruebas Automatizadas (`npm test` — Vitest + PGlite PostgreSQL):** **6 suites pasadas, 25 pruebas pasadas (100%)**:
  - `supabase/tests/rls_and_schema.test.ts` (5 pruebas en motor PostgreSQL real):
    - Verificación de `id BIGINT GENERATED ALWAYS AS IDENTITY` y RLS forzado en las 7 tablas.
    - Creación aislada de perfiles y semilla de categorías por usuario.
    - Bloqueo por clave foránea compuesta ante intentos de cruzar categorías entre usuarios o asociar categorías de gasto a ingresos.
    - Bloqueo mediante trigger PL/pgSQL `validate_investment_ledger_consistency` ante ventas en descubierto, ventas anteriores a la compra o ediciones/eliminaciones retroactivas inválidas.
    - Aislamiento de caché de cotizaciones y denegación total al rol `anon`.
  - `tests/auth.test.ts` (4 pruebas): detección de variables de entorno, sanitización anti-Open-Redirect y protección de rutas privadas y APIs en middleware.
  - `tests/finance.test.ts` (3 pruebas): validaciones Zod de categorías y operaciones (`NUMERIC(19,4)`), cálculo exacto de balance mensual, desgloses y evolución diaria.
  - `tests/investments.test.ts` (5 pruebas): normalización de símbolos, fracciones de títulos, registro por importe en USD, costo promedio ponderado móvil con comisiones, liquidación total sin residuos y valoración con activos sin cotización.
  - `tests/market-data.test.ts` (4 pruebas): sanitización de símbolos y velas OHLC, manejo de código `429` (cuota agotada), `403` y modo manual.
  - `tests/pwa-and-ui.test.ts` (4 pruebas): manifest PWA e iconos físicos, exclusión de rutas privadas en el Service Worker, manejo de IDs `BIGINT` mayores a `2^53 - 1` y escaneo estático garantizando ausencia de claves privadas con `NEXT_PUBLIC_`.

---

## 12. Limitaciones Conocidas (Versión 1.0) y Acciones Manuales Pendientes

### Limitaciones de alcance de la primera versión
1. **Moneda base única (USD):** Tanto las finanzas personales como el portafolio operan en dólares estadounidenses (`USD`) para evitar conversiones multimoneda sin un tipo de cambio histórico verificado por operación.
2. **Eventos corporativos complejos:** El motor calcula posiciones mediante costo promedio ponderado móvil sobre compras y ventas. Desdoblamientos de acciones (*stock splits*), fusiones o dividendos en efectivo deben registrarse como operaciones explícitas.
3. **Retraso y cuotas de datos gratuitos:** Los planes gratuitos de Twelve Data (8 req/min, 800 req/día) y Finnhub (60 req/min en mercado de EE. UU.) están destinados a uso personal y pueden presentar retraso respecto al mercado en tiempo real.

### Acciones manuales que dependen de tus credenciales personales
Para conectar la aplicación a tus cuentas propias en local o producción:
1. Crear tu proyecto gratuito en **Supabase**, ejecutar [`supabase/migrations/20261028000001_initial_schema_and_security.sql`](./supabase/migrations/20261028000001_initial_schema_and_security.sql) en el SQL Editor y copiar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local`.
2. Configurar tu Client ID y Client Secret de **Google Cloud OAuth 2.0** dentro de **Supabase Dashboard → Authentication → Providers → Google**.
3. (Opcional) Añadir tu clave gratuita `TWELVE_DATA_API_KEY` o `FINNHUB_API_KEY` en `.env.local` para cotizaciones automáticas, o mantener `MARKET_DATA_PROVIDER=manual` para operar con precios manuales.

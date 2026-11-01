# MASTER PROMPT: DESARROLLO DE UNA PLATAFORMA PERSONAL DE FINANZAS E INVERSIONES

## 1. CONTEXTO, ROL Y OBJETIVO DEL PROYECTO

Actúa como un **ingeniero de software senior, arquitecto full-stack, especialista en PostgreSQL, seguridad web, aplicaciones PWA y desarrollo asistido por agentes autónomos**.

Tu misión consiste en diseñar, implementar, probar y documentar desde cero una aplicación web de finanzas personales y seguimiento de inversiones, utilizable desde computadoras, tabletas y teléfonos móviles.

El proyecto debe incluir dos módulos principales:

1. Gestión de finanzas personales: ingresos, gastos, categorías, balances y estadísticas.
2. Portafolio de inversiones: seguimiento de compras y ventas de acciones y ETF, títulos fraccionados, cotizaciones, valoración del portafolio y gráficos históricos.

### 1.1. Objetivo principal

Construye una aplicación funcional, segura, responsive, instalable y mantenible, con arquitectura preparada para producción y un costo operativo objetivo de **$0 USD mensuales**.

No entregues solamente un prototipo visual, una maqueta, una demostración con datos ficticios ni una colección de componentes desconectados.

Implementa el flujo completo de cada funcionalidad: interfaz, validaciones, autenticación, persistencia de datos, consultas, cálculos, control de errores y pruebas.

### 1.2. Reglas obligatorias de trabajo

- Inspecciona el repositorio y el entorno antes de modificar archivos. Si el proyecto está vacío, inicialízalo; si ya contiene código, conserva e integra lo que sea útil.
- Trabaja secuencialmente, dividiendo el proyecto en fases verificables.
- Toma decisiones técnicas razonables sin detenerte a preguntar por preferencias no esenciales.
- Antes de instalar una dependencia, comprueba que sea necesaria, compatible y mantenida.
- Consulta la documentación oficial vigente cuando implementes servicios externos, APIs, autenticación o funcionalidades del framework.
- No inventes endpoints, límites gratuitos, cotizaciones, respuestas de API ni capacidades de servicios.
- No simules persistencia con `localStorage` cuando la funcionalidad requiera almacenamiento en PostgreSQL.
- No dejes botones sin comportamiento, formularios sin guardar datos ni gráficos con información ficticia presentada como real.
- No declares completada una fase si todavía tiene errores importantes, pruebas fallidas o funcionalidades esenciales pendientes.
- Si una integración depende de credenciales que no están disponibles, implementa la integración de forma segura, documenta exactamente qué falta y continúa con el resto del proyecto.
- No solicites ni publiques secretos en el código fuente, en el repositorio ni en documentación accesible públicamente.

**Prioridad absoluta:** seguridad, integridad de los datos, costo cero, experiencia móvil y funcionamiento real.

---

## 2. FILOSOFÍA DE COSTO CERO Y ARQUITECTURA DE LA APLICACIÓN

### 2.1. Restricción económica

El presupuesto operativo permitido es de $0 USD.

Utiliza exclusivamente servicios, dependencias y recursos que puedan utilizarse sin pago dentro de sus respectivos planes y condiciones vigentes.

Quedan excluidos:

- Membresías de Apple Developer o Google Play Console.
- Servidores VPS de pago.
- Bases de datos de pago.
- Dominios personalizados de pago.
- Servicios obligatorios de correo electrónico de pago.
- APIs bursátiles que requieran una suscripción para la funcionalidad implementada.
- Servicios que comiencen automáticamente a facturar al superar un límite.
- Funcionalidades que dependan de una prueba gratuita temporal para seguir funcionando.

No añadas tarjetas bancarias ni habilites la facturación automática. Cuando una cuota gratuita se agote, la aplicación debe degradarse de manera controlada en lugar de generar costos.

Antes de seleccionar cada servicio externo, verifica sus precios, cuotas, licencias y restricciones. Registra la fecha de consulta en la documentación del proyecto.

### 2.2. Pila tecnológica obligatoria

Utiliza la siguiente arquitectura:

| Componente | Tecnología |
|---|---|
| Framework | Next.js, App Router |
| Lenguaje | TypeScript con comprobación estricta |
| Interfaz | React y Tailwind CSS |
| Backend | Route Handlers y Server Actions de Next.js cuando correspondan |
| Base de datos | PostgreSQL mediante Supabase Free |
| Autenticación | Supabase Auth con Google OAuth 2.0 |
| Cliente de base de datos | `@supabase/supabase-js` |
| Integración SSR | `@supabase/ssr` |
| Validación | Zod |
| Formularios | React Hook Form, cuando aporte valor |
| Gráficos bursátiles | `lightweight-charts` |
| Gráficos de distribución | Recharts o una alternativa open-source equivalente |
| Instalación móvil | Progressive Web App (PWA) |
| Despliegue | Vercel Hobby, sujeto a sus condiciones de uso |

Utiliza versiones estables y compatibles. Registra las versiones elegidas en el archivo de dependencias y conserva el archivo de bloqueo correspondiente.

No instales paquetes innecesarios ni introduzcas un segundo framework de frontend.

### 2.3. Una aplicación para PC y celular

La solución debe ser una **PWA responsive**, no dos aplicaciones independientes.

Debe poder abrirse mediante una URL HTTPS y permitir su instalación desde los navegadores compatibles.

En computadora, debe funcionar como una aplicación web normal y permitir su instalación cuando el navegador lo admita.

En Android, debe ofrecer la posibilidad de instalarse desde el navegador compatible.

En iOS, debe proporcionar una experiencia responsive y permitir añadirla a la pantalla de inicio mediante el procedimiento que admita el navegador.

Implementa:

- `app/manifest.ts` o el mecanismo de manifest compatible con la versión elegida de Next.js.
- Nombre y nombre corto de la aplicación.
- Iconos de 192 × 192 y 512 × 512 píxeles.
- Color del tema y de fondo.
- `display: standalone`.
- `start_url` y ámbito de navegación correctamente definidos.
- HTTPS en producción.
- Service worker, utilizando una solución compatible y mantenida.
- Pantalla o instrucciones para instalar la aplicación.
- Actualizaciones de la PWA sin corromper sesiones ni formularios.

No almacenes respuestas privadas de la API, información financiera, tokens de sesión ni páginas autenticadas en cachés públicas del service worker. La estrategia offline debe limitarse al contenido seguro de la interfaz y a los recursos estáticos.

La PWA no debe depender de la publicación en tiendas móviles para funcionar.

### 2.4. Política de consumo de recursos

Programa el sistema para reducir consultas innecesarias:

- Evita solicitar una cotización cada vez que se renderiza un componente.
- Implementa caché con caducidad para las cotizaciones.
- Actualiza los datos cuando sea necesario, no continuamente.
- No implementes procesos permanentes ni tareas programadas que generen consumo evitable.
- Utiliza paginación o consultas limitadas para historiales grandes.
- Muestra cuándo se actualizó cada cotización.
- Implementa estados de servicio no disponible, cuota agotada y respuesta desactualizada.

Si el usuario supera el límite gratuito de un proveedor, debe seguir pudiendo registrar operaciones y usar el resto de la aplicación.

**La meta es mantener el costo en cero dentro de las cuotas disponibles, no garantizar disponibilidad ilimitada ni cotizaciones en tiempo real gratuitas.**

---

## 3. SEGURIDAD, AUTENTICACIÓN Y ARQUITECTURA DE DATOS

### 3.1. Autenticación con Google

Implementa el inicio de sesión mediante Supabase Auth y Google OAuth 2.0.

Flujo requerido:

1. El usuario abre la aplicación.
2. Si no tiene una sesión válida, se muestra la pantalla de acceso.
3. El usuario selecciona «Continuar con Google».
4. Se ejecuta el flujo OAuth compatible con Supabase.
5. Google autentica al usuario y devuelve el control a la aplicación.
6. La aplicación establece y valida la sesión.
7. Se crea o recupera el perfil del usuario.
8. El usuario accede a su dashboard.
9. El cierre de sesión invalida la sesión y protege las rutas privadas.

Utiliza el mecanismo SSR recomendado para la versión de Supabase elegida, con cookies seguras y manejo correcto del intercambio de códigos OAuth cuando corresponda.

Configura las URLs permitidas de redirección para desarrollo y producción.

Utiliza únicamente los permisos de Google necesarios para obtener la identidad básica del usuario. No solicites acceso al correo, archivos, contactos u otros servicios que no sean necesarios.

Si el usuario no está autenticado, ninguna ruta protegida ni operación de datos privados debe quedar accesible.

No utilices `getSession()` como única garantía de autenticación del lado del servidor. Valida la identidad mediante el mecanismo de verificación de usuario recomendado por Supabase.

### 3.2. Variables de entorno

Prepara un archivo `.env.example` con las variables necesarias, por ejemplo:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

MARKET_DATA_PROVIDER=
FINNHUB_API_KEY=
TWELVE_DATA_API_KEY=

NEXT_PUBLIC_APP_URL=
```

Ajusta los nombres a la configuración oficial y definitiva de cada proveedor. No mantengas variables innecesarias.

Las claves privadas de OAuth y del proveedor bursátil deben permanecer en el servidor.

La clave publicable de Supabase puede utilizarse desde el cliente junto con RLS correctamente configurado.

No expongas `SUPABASE_SERVICE_ROLE_KEY` ni otras claves privilegiadas mediante variables con prefijo `NEXT_PUBLIC_`. Evita utilizar una clave privilegiada si la operación puede ejecutarse de forma segura con el usuario autenticado.

Si una operación privilegiada resulta indispensable, ejecútala exclusivamente en el servidor, verifica la identidad y las autorizaciones del usuario y limita los datos afectados.

### 3.3. Arquitectura obligatoria de claves sustitutas

Utiliza estrictamente claves sustitutas o *surrogate keys* para las entidades de negocio.

Todas las tablas propias de la aplicación deben seguir este patrón para su clave primaria:

```sql
id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
```

Las claves foráneas deben apuntar a los identificadores numéricos de las entidades relacionadas, en lugar de utilizar símbolos bursátiles, nombres, correos electrónicos o descripciones como claves primarias.

La excepción necesaria es la identidad del usuario autenticado:

```sql
user_id UUID REFERENCES auth.users(id)
```

El UUID identifica al propietario porque Supabase Auth utiliza ese formato. No lo sustituyas por un ID numérico inventado.

En consecuencia:

- `id BIGINT`: identifica la entidad de negocio.
- `user_id UUID`: identifica al propietario en Supabase Auth.
- Las claves foráneas entre entidades de negocio utilizan `BIGINT`.
- Los registros dependientes deben comprobar que la entidad referenciada pertenece al mismo usuario.

No uses claves compuestas como clave primaria principal de las tablas de negocio.

Puedes utilizar restricciones `UNIQUE` compuestas adicionales para garantizar la integridad de las relaciones y evitar referencias entre usuarios diferentes.

Emplea índices B-tree para las claves primarias, las claves foráneas y los filtros frecuentes. Añade índices compuestos siguiendo el orden real de las consultas y las políticas RLS.

No afirmes que una clave numérica garantiza por sí sola un rendimiento óptimo. Verifica el diseño mediante consultas e índices apropiados.

En TypeScript, trata los identificadores `BIGINT` como identificadores opacos y evita las conversiones innecesarias a `number`. Diseña las respuestas de la capa de datos para conservar su precisión y utiliza cadenas para representar los identificadores cuando puedan atravesar límites JSON o APIs.

### 3.4. Aislamiento obligatorio con Row Level Security

Activa Row Level Security (RLS) en **todas las tablas de la aplicación**, incluyendo categorías, operaciones financieras, activos, compras, ventas, cotizaciones almacenadas e historial de precios.

Toda tabla con datos privados debe tener `user_id UUID` asociado al usuario propietario.

Para las operaciones de lectura, inserción, modificación y eliminación, crea políticas específicas que comprueben que:

```sql
(select auth.uid()) = user_id
```

Cada operación debe aplicar las restricciones apropiadas:

- `SELECT`: el usuario solo puede consultar sus registros.
- `INSERT`: solo puede crear registros asignados a su propia identidad.
- `UPDATE`: solo puede modificar registros propios y no puede reasignarlos a otro usuario.
- `DELETE`: solo puede eliminar registros propios.

No implementes la seguridad únicamente en los componentes de React o en el middleware.

Utiliza RLS como barrera real de autorización en PostgreSQL.

Para las relaciones, garantiza además que una transacción solo pueda referenciar una categoría o un activo perteneciente al mismo usuario. Las claves foráneas compuestas deben reforzar esta restricción.

No crees políticas globales que permitan a cualquier usuario autenticado modificar todos los registros.

Las tablas de datos privados nunca deben ser accesibles para usuarios anónimos. Los datos bursátiles de terceros tampoco deben mezclarse entre cuentas si se almacenan bajo propiedad de cada usuario.

### 3.5. Integridad y precisión numérica

Para cantidades monetarias, precios y cantidades de títulos utiliza tipos `NUMERIC`, no `FLOAT` ni `REAL`.

Utiliza una precisión apropiada, por ejemplo:

- Importes monetarios: `NUMERIC(19,4)`.
- Precio por título: `NUMERIC(20,8)`.
- Cantidad de títulos: `NUMERIC(28,10)`.

Define validaciones tanto en la aplicación como en PostgreSQL.

No permitas importes negativos cuando la operación se representa mediante un tipo explícito de ingreso, gasto, compra o venta. Utiliza un campo de tipo para establecer el signo lógico de la operación.

Las restricciones deben impedir cantidades no positivas de títulos, precios inválidos y comisiones negativas.

### 3.6. Migraciones y administración del esquema

Versiona todos los cambios de base de datos en `supabase/migrations/`.

No dependas de modificaciones manuales no documentadas efectuadas desde el panel de Supabase.

Cada migración debe incluir, cuando corresponda:

- Tablas y columnas.
- Claves primarias y foráneas.
- Restricciones `CHECK` y `UNIQUE`.
- Índices.
- Políticas RLS.
- Funciones SQL y triggers.
- Permisos.
- Vistas o funciones de consulta necesarias para el cálculo de métricas.

Documenta el procedimiento para ejecutar las migraciones en una instancia nueva.

---

## 4. ESQUEMA DE BASE DE DATOS SQL

Implementa como mínimo las siguientes entidades:

| Tabla | Propósito |
|---|---|
| `profiles` | Perfil y preferencias de cada usuario |
| `finance_categories` | Categorías personalizadas de ingresos y gastos |
| `finance_transactions` | Registro de ingresos y gastos |
| `investment_assets` | Acciones y ETF registrados por el usuario |
| `investment_transactions` | Historial de compras y ventas |
| `investment_quote_cache` | Última cotización disponible por activo |
| `investment_price_history` | Historial de precios utilizado para los gráficos |

Las siete tablas de negocio deben utilizar `id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY`, así como `user_id UUID` cuando corresponda para garantizar el aislamiento por usuario.

### 4.1. Migración SQL base

Utiliza la siguiente estructura como base de la primera migración y complétala con las funciones auxiliares necesarias.

```sql
CREATE TYPE public.finance_transaction_type AS ENUM (
    'income',
    'expense'
);

CREATE TYPE public.investment_asset_type AS ENUM (
    'stock',
    'etf'
);

CREATE TYPE public.investment_transaction_type AS ENUM (
    'buy',
    'sell'
);

CREATE TABLE public.profiles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE
        REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    base_currency CHAR(3) NOT NULL DEFAULT 'USD'
        CHECK (base_currency = 'USD'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (id, user_id)
);

CREATE TABLE public.finance_categories (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL
        CHECK (length(trim(name)) BETWEEN 1 AND 80),
    kind public.finance_transaction_type NOT NULL,
    color TEXT NOT NULL DEFAULT '#64748b',
    icon TEXT NOT NULL DEFAULT 'wallet',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (id, user_id, kind)
);

CREATE UNIQUE INDEX finance_categories_unique_name_idx
ON public.finance_categories (
    user_id,
    kind,
    lower(name)
);

CREATE TABLE public.finance_transactions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id BIGINT NOT NULL,
    transaction_type public.finance_transaction_type NOT NULL,
    amount NUMERIC(19,4) NOT NULL CHECK (amount > 0),
    currency CHAR(3) NOT NULL DEFAULT 'USD'
        CHECK (currency = 'USD'),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL
        CHECK (length(trim(description)) BETWEEN 1 AND 200),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT finance_transaction_category_owner_fk
        FOREIGN KEY (
            category_id,
            user_id,
            transaction_type
        )
        REFERENCES public.finance_categories (
            id,
            user_id,
            kind
        )
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    UNIQUE (id, user_id)
);

CREATE INDEX finance_transactions_user_date_idx
ON public.finance_transactions (
    user_id,
    transaction_date DESC,
    id DESC
);

CREATE INDEX finance_transactions_user_category_date_idx
ON public.finance_transactions (
    user_id,
    category_id,
    transaction_date DESC
);

CREATE TABLE public.investment_assets (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL
        CHECK (symbol = upper(trim(symbol))),
    name TEXT NOT NULL
        CHECK (length(trim(name)) BETWEEN 1 AND 150),
    asset_type public.investment_asset_type NOT NULL,
    exchange TEXT,
    provider_symbol TEXT,
    currency CHAR(3) NOT NULL DEFAULT 'USD'
        CHECK (currency = 'USD'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT investment_assets_user_symbol_unique
        UNIQUE (user_id, symbol),

    CONSTRAINT investment_assets_id_user_unique
        UNIQUE (id, user_id)
);

CREATE INDEX investment_assets_user_idx
ON public.investment_assets (user_id, id);

CREATE TABLE public.investment_transactions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    asset_id BIGINT NOT NULL,
    transaction_type public.investment_transaction_type NOT NULL,
    trade_date DATE NOT NULL DEFAULT CURRENT_DATE,
    quantity NUMERIC(28,10) NOT NULL CHECK (quantity > 0),
    price_per_share NUMERIC(20,8) NOT NULL
        CHECK (price_per_share > 0),
    fees NUMERIC(19,4) NOT NULL DEFAULT 0
        CHECK (fees >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'USD'
        CHECK (currency = 'USD'),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT investment_transaction_asset_owner_fk
        FOREIGN KEY (asset_id, user_id)
        REFERENCES public.investment_assets (id, user_id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,

    UNIQUE (id, user_id)
);

CREATE INDEX investment_transactions_user_asset_date_idx
ON public.investment_transactions (
    user_id,
    asset_id,
    trade_date,
    id
);

CREATE TABLE public.investment_quote_cache (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    asset_id BIGINT NOT NULL,
    price NUMERIC(20,8) NOT NULL CHECK (price > 0),
    currency CHAR(3) NOT NULL DEFAULT 'USD'
        CHECK (currency = 'USD'),
    provider TEXT NOT NULL,
    market_time TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT investment_quote_asset_owner_fk
        FOREIGN KEY (asset_id, user_id)
        REFERENCES public.investment_assets (id, user_id)
        ON DELETE CASCADE,

    CONSTRAINT investment_quote_one_per_asset
        UNIQUE (asset_id, user_id)
);

CREATE INDEX investment_quote_user_asset_idx
ON public.investment_quote_cache (user_id, asset_id);

CREATE TABLE public.investment_price_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    asset_id BIGINT NOT NULL,
    interval TEXT NOT NULL
        CHECK (
            interval IN (
                '1min', '5min', '15min',
                '30min', '1hour', '1day',
                '1week', '1month'
            )
        ),
    candle_at TIMESTAMPTZ NOT NULL,
    open NUMERIC(20,8) NOT NULL CHECK (open > 0),
    high NUMERIC(20,8) NOT NULL CHECK (high > 0),
    low NUMERIC(20,8) NOT NULL CHECK (low > 0),
    close NUMERIC(20,8) NOT NULL CHECK (close > 0),
    volume NUMERIC(28,10),
    provider TEXT NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT investment_history_ohlc_valid
        CHECK (
            high >= low
            AND high >= open
            AND high >= close
            AND low <= open
            AND low <= close
        ),

    CONSTRAINT investment_history_asset_owner_fk
        FOREIGN KEY (asset_id, user_id)
        REFERENCES public.investment_assets (id, user_id)
        ON DELETE CASCADE,

    CONSTRAINT investment_history_point_unique
        UNIQUE (user_id, asset_id, interval, candle_at)
);

CREATE INDEX investment_history_user_asset_time_idx
ON public.investment_price_history (
    user_id,
    asset_id,
    interval,
    candle_at DESC
);
```

Este esquema es la base de la implementación, no una autorización para omitir las verificaciones restantes.

Antes de utilizarlo, comprueba que cada restricción sea compatible con las operaciones previstas. Añade políticas RLS, permisos, índices adicionales justificados, triggers de actualización y funciones auxiliares en la migración definitiva.

No elimines las restricciones de propietario para simplificar las consultas.

### 4.2. Políticas RLS

Todas las tablas anteriores contienen `user_id` y deben tener RLS habilitado.

Implementa políticas independientes de lectura, inserción, actualización y eliminación en las siete tablas.

La siguiente estructura ilustra el resultado esperado para la tabla de transacciones financieras:

```sql
ALTER TABLE public.finance_transactions
ENABLE ROW LEVEL SECURITY;

CREATE POLICY finance_transactions_select_own
ON public.finance_transactions
FOR SELECT
TO authenticated
USING ((select auth.uid()) = user_id);

CREATE POLICY finance_transactions_insert_own
ON public.finance_transactions
FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY finance_transactions_update_own
ON public.finance_transactions
FOR UPDATE
TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY finance_transactions_delete_own
ON public.finance_transactions
FOR DELETE
TO authenticated
USING ((select auth.uid()) = user_id);
```

Repite el patrón adaptado para cada tabla. No dejes una tabla fuera del esquema de autorización.

Concede únicamente los permisos necesarios a `authenticated` y evita permisos de escritura para `anon`.

La aplicación debe probar expresamente que un usuario no puede leer, modificar, borrar o referenciar registros pertenecientes a otro usuario.

### 4.3. Funciones de base de datos que debes completar

Desarrolla las funciones SQL o la lógica transaccional equivalente para:

1. Crear y actualizar el perfil del usuario autenticado.
2. Garantizar la consistencia de las transacciones de inversión.
3. Validar la disponibilidad de títulos antes de procesar una venta.
4. Calcular o proporcionar los datos necesarios para los indicadores del portafolio.
5. Actualizar la caché de cotizaciones sin duplicar registros.
6. Consultar el historial bursátil con filtros y límites seguros.

Siempre que una validación dependa de un conjunto de transacciones, evita que operaciones concurrentes puedan producir resultados inconsistentes.

No confíes únicamente en validar una venta desde React. La operación definitiva debe verificar el historial pertinente de forma consistente antes de guardar el cambio.

---

## 5. REQUISITOS FUNCIONALES POR MÓDULO

## 5.1. Módulo 0: acceso y perfil

Implementa una página de inicio de sesión clara, minimalista y responsive.

Incluye:

- Botón de acceso mediante Google.
- Estados de carga.
- Mensajes de error comprensibles.
- Redirección al dashboard después de una autenticación válida.
- Protección de rutas privadas.
- Cierre de sesión.
- Perfil con nombre y avatar cuando estén disponibles.
- Preferencias de visualización y moneda base.
- Tratamiento correcto de sesiones expiradas.

Tras iniciar sesión, crea el perfil solo si todavía no existe. Evita perfiles duplicados ante solicitudes concurrentes.

## 5.2. Módulo 1: finanzas personales

### A. Registro de ingresos y gastos

Implementa un CRUD completo para ingresos y gastos.

Campos mínimos de cada operación:

- Identificador.
- Tipo: ingreso o gasto.
- Importe.
- Categoría.
- Fecha.
- Descripción.
- Notas opcionales.
- Fecha de creación y modificación, cuando corresponda.

Proporciona acciones para crear, consultar, editar y eliminar operaciones.

Incluye confirmación antes de eliminar. Después de modificar o borrar un registro, actualiza todos los indicadores afectados.

Valida los importes, los textos, las fechas y la categoría seleccionada. Rechaza las operaciones con datos inconsistentes.

No permitas asociar una categoría de gasto a un ingreso.

### B. Categorías personalizadas

Permite crear, editar y eliminar categorías de ingresos y gastos.

Ejemplos iniciales de referencia:

**Ingresos:** Sueldo, Freelance, Otros ingresos.

**Gastos:** Alimentación, Transporte, Servicios, Educación, Comida, Salida amigos, Ocio, Otros.

Cada usuario debe gestionar sus propias categorías.

Permite personalizar nombre, color e icono mediante un conjunto controlado de opciones.

No permitas duplicados ignorando mayúsculas y minúsculas dentro del mismo usuario y tipo de categoría.

Si una categoría tiene operaciones relacionadas, define una regla clara antes de eliminarla: impedir su eliminación hasta reasignar las operaciones o proporcionar una reasignación explícita. No pierdas registros silenciosamente.

### C. Dashboard financiero

Desarrolla un dashboard con los siguientes indicadores:

- Ingresos del mes.
- Gastos del mes.
- Balance mensual.
- Cantidad de operaciones.
- Evolución del balance.
- Desglose de gastos por categoría.
- Desglose de ingresos por categoría.
- Comparación con el mes anterior.
- Historial de las operaciones recientes.

Las cifras deben calcularse a partir de PostgreSQL, usando consultas o funciones adecuadas, y nunca desde datos de ejemplo en producción.

Fórmula del balance mensual:

`Balance = Ingresos del período − Gastos del período`

Implementa filtros por mes y año. Las operaciones deben pertenecer a un período claramente definido, sin mezclar fechas ni duplicar importes.

Si el usuario no tiene registros, muestra un estado vacío útil que le permita crear su primera operación.

### D. Historial de movimientos

Implementa una pantalla de historial con:

- Búsqueda por descripción.
- Filtro por tipo.
- Filtro por categoría.
- Filtro por fechas.
- Orden por fecha.
- Paginación.
- Acciones para editar y eliminar.

Muestra correctamente los importes en dólares, con una convención coherente de decimales.

No cuentes las compras de acciones automáticamente como gastos personales ni las ventas de acciones como ingresos ordinarios. El historial de inversión debe conservar su significado independiente para evitar duplicaciones contables.

---

## 5.3. Módulo 2: portafolio de acciones y ETF

### A. Gestión de activos

Permite que el usuario registre acciones y ETF.

Cada activo debe contener:

- Símbolo bursátil, por ejemplo `AAPL` o `QQQ`.
- Nombre del activo.
- Tipo: acción o ETF.
- Mercado o bolsa, cuando se conozca.
- Símbolo reconocido por el proveedor de cotizaciones.
- Moneda de negociación.
- Fecha de incorporación al portafolio.

Normaliza los símbolos a mayúsculas y valida que no estén vacíos.

No supongas que el nombre del activo basta para identificarlo inequívocamente en todos los proveedores. Permite confirmar o corregir el símbolo reconocido por la API.

En la primera versión, utiliza USD como moneda base y limita la valoración automática a activos con cotizaciones expresadas en USD. No conviertas monedas distintas sin un tipo de cambio válido y una política explícita de conversión.

### B. Registro de compras y ventas

Implementa el registro de operaciones de compra y venta de acciones y ETF.

Los campos requeridos son:

- Activo.
- Tipo de operación: compra o venta.
- Fecha de negociación.
- Cantidad de títulos.
- Precio por título.
- Comisiones.
- Importe bruto calculado.
- Notas opcionales.

Debe admitir cantidades fraccionadas, por ejemplo `0.25`, `0.5` o `1.75` títulos.

También debe permitir introducir un importe en dólares en lugar de la cantidad de títulos.

Cuando el usuario introduce un importe, calcula la cantidad a partir del precio de ejecución confirmado:

`Cantidad = Importe de la operación / Precio por título`

El precio de ejecución no debe confundirse con la última cotización de mercado. Permite utilizar el precio de mercado como referencia, pero exige confirmar o introducir el precio correspondiente a la operación registrada.

Valida los datos tanto en el cliente como en el servidor.

No permitas ventas que dejen la posición en negativo. Si en el futuro se requieren posiciones cortas, deberán diseñarse como una funcionalidad separada y expresamente autorizada.

### C. Historial de operaciones bursátiles

Implementa una tabla de operaciones con filtros por:

- Activo.
- Tipo de operación.
- Fecha inicial y final.
- Orden cronológico.
- Cantidad.
- Precio de ejecución.
- Comisiones.
- Importe bruto.

Permite corregir y eliminar operaciones, pero vuelve a calcular las métricas después de cada modificación.

Si una corrección retroactiva provoca que el historial contenga una venta anterior a la compra de los títulos correspondientes, rechaza el cambio o solicita la corrección necesaria.

La validación debe considerar el conjunto de operaciones ordenadas por fecha de negociación e identificador, no únicamente la posición agregada actual.

### D. Cálculo de posiciones y costo promedio

Implementa una función de cálculo verificable y reutilizable que procese las operaciones cronológicamente para cada activo.

Utiliza el método de **costo promedio ponderado móvil** como método de costo base de la primera versión. Documenta este supuesto y úsalo de forma consistente.

Para cada compra:

- Aumenta la cantidad de títulos.
- Incrementa el costo base por el importe bruto de la compra y las comisiones.

Para cada venta:

- Verifica que existan títulos suficientes.
- Calcula el costo promedio inmediatamente anterior a la venta.
- Determina el costo base de los títulos vendidos.
- Calcula el resultado realizado de la venta.
- Reduce la cantidad y el costo base de la posición restante.

Expresiones básicas:

`Costo promedio = Costo base restante / Cantidad restante`

`Valor de mercado = Cantidad restante × Último precio válido`

`Pérdida o ganancia no realizada = Valor de mercado − Costo base restante`

`Rentabilidad no realizada (%) = Ganancia o pérdida no realizada / Costo base restante × 100`

El porcentaje no debe mostrarse como un valor válido cuando el costo base sea cero.

Incluye las comisiones de forma consistente en el costo base y en el cálculo de los ingresos netos de las ventas.

Define cuidadosamente las reglas de redondeo. Conserva la máxima precisión razonable durante los cálculos y redondea únicamente para su presentación o cuando sea necesario por una regla explícita del modelo.

Documenta las limitaciones de esta primera versión, incluidas las operaciones corporativas, los desdoblamientos de acciones y los dividendos si todavía no están implementados.

### E. Indicadores del portafolio

El dashboard debe mostrar:

- Valor de mercado total.
- Costo base restante.
- Ganancia o pérdida no realizada.
- Rentabilidad porcentual no realizada.
- Cantidad de activos en cartera.
- Distribución porcentual por activo.
- Distribución entre acciones y ETF.
- Última actualización de cotizaciones.
- Resultado realizado de las ventas, como indicador adicional.
- Posiciones sin cotización disponible.

El peso porcentual de un activo debe calcularse de la siguiente manera:

`Peso del activo (%) = Valor de mercado del activo / Valor de mercado total valorado × 100`

No trates una cotización ausente como si el precio fuese cero. Si existen posiciones sin cotización válida, informa que la valoración total está incompleta y explica qué posiciones están pendientes de valoración.

Permite introducir una cotización manual cuando el proveedor no pueda suministrarla o cuando el usuario desee registrar un precio de referencia. Identifica claramente el origen manual y la fecha de referencia para no confundirlo con un precio de mercado actualizado.

### F. Integración de API bursátil gratuita

Diseña una capa de abstracción independiente del proveedor.

Evalúa Finnhub y Twelve Data como candidatos, pero no los selecciones automáticamente sin verificar las condiciones actuales.

Antes de implementar el proveedor elegido, confirma:

- Disponibilidad gratuita para el uso previsto.
- Permiso para el uso personal de cotizaciones.
- Permiso para mostrar los datos en una interfaz privada.
- Disponibilidad de datos históricos.
- Mercados y símbolos cubiertos.
- Límites de peticiones por minuto y por día.
- Requisitos de atribución.
- Restricciones sobre almacenamiento y redistribución.

No utilices scraping de páginas financieras ni endpoints no oficiales como sustituto de una API autorizada.

Implementa una interfaz interna similar a:

```ts
export type MarketQuote = {
  symbol: string;
  price: string;
  currency: "USD";
  marketTime: string | null;
  fetchedAt: string;
  provider: string;
};

export type PriceCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export interface MarketDataProvider {
  getQuote(symbol: string): Promise<MarketQuote>;
  getHistory(
    symbol: string,
    range: "1M" | "3M" | "6M" | "1Y" | "5Y"
  ): Promise<PriceCandle[]>;
}
```

Adapta las firmas si el proveedor seleccionado requiere otros parámetros. Usa tipos adecuados, validación de respuestas y manejo de errores.

Implementa el proveedor concreto en el servidor. La clave API nunca debe llegar al navegador.

Proporciona rutas protegidas para obtener cotizaciones e historial. Verifica la sesión, comprueba que el activo pertenezca al usuario y evita que una petición pueda acceder al portafolio de otra cuenta.

Implementa:

- Caché persistente mediante las tablas previstas cuando la licencia permita almacenar los datos.
- Duración de caché configurable.
- Límite de frecuencia de actualización.
- Control de errores HTTP.
- Manejo del código `429` por límite de peticiones.
- Validación de símbolos.
- Validación de precios y marcas de tiempo.
- Respuestas normalizadas.
- Registro de errores sin exponer claves.
- Opción de introducir precios manuales.
- Indicadores de cotización desactualizada o indisponible.

No llames a la API desde cada componente ni por cada renderizado del dashboard.

Actualiza las cotizaciones únicamente cuando sea necesario y respeta las limitaciones del proveedor.

Si no existe un proveedor gratuito cuya licencia permita la funcionalidad de visualización requerida, no simules datos bursátiles reales ni implementes una solución que dependa de pagos. Conserva el registro de operaciones, habilita precios manuales y documenta claramente la limitación.

### G. Gráfico histórico por activo

Utiliza `lightweight-charts` para mostrar la evolución del precio de cada acción o ETF.

Incluye, según los datos disponibles:

- Línea de precio de cierre o gráfico de velas OHLC.
- Selector de rango temporal.
- Información de precio y fecha al interactuar con el gráfico.
- Estado de carga.
- Estado vacío cuando no exista historial.
- Etiqueta de la fuente.
- Fecha de última actualización.
- Aviso cuando los datos sean retrasados o incompletos.

Adapta el gráfico al tamaño de la pantalla y limpia correctamente las instancias cuando el componente se desmonte.

Respeta las condiciones de licencia de la librería y la atribución requerida por TradingView.

No inventes puntos históricos para rellenar huecos.

### H. Gráfico de distribución del portafolio

Implementa un gráfico de dona con Recharts u otra librería open-source apropiada para mostrar:

- Peso porcentual de cada activo.
- Valor de mercado por activo.
- Símbolos y nombres.
- Leyenda y colores consistentes.
- Información emergente con el valor y porcentaje.

Permite identificar activos sin cotización, sin ocultar silenciosamente que la valoración está incompleta.

Si no hay posiciones valorables, presenta un estado vacío.

### I. Tratamiento de datos bursátiles

Todas las métricas deben indicar el momento de valoración utilizado.

La aplicación es una herramienta de registro y seguimiento, no un sistema de ejecución de órdenes.

No la conectes a un bróker para enviar órdenes ni presentes sus resultados como garantía de rentabilidad futura.

Incluye un aviso discreto indicando que las cotizaciones pueden estar retrasadas, que las métricas dependen de la calidad de los datos disponibles y que la aplicación no sustituye el análisis financiero personal.

---

## 6. DISEÑO DE INTERFAZ Y EXPERIENCIA DE USUARIO

Implementa una interfaz moderna, consistente y sobria.

No priorices efectos visuales sobre legibilidad, rendimiento ni accesibilidad.

### 6.1. Navegación

En escritorio, utiliza una barra lateral con:

- Dashboard.
- Finanzas.
- Historial financiero.
- Portafolio.
- Activos.
- Operaciones de inversión.
- Ajustes.

En móviles, transforma la navegación en una barra inferior o un menú compacto, manteniendo accesibles las acciones principales.

### 6.2. Diseño responsive

Prueba los tamaños siguientes como referencia:

- Teléfono: 360–430 px de ancho.
- Tableta: 768–1024 px.
- Computadora: desde 1280 px.

Evita desbordamientos horizontales. Las tablas deben usar columnas adaptables, tarjetas o desplazamiento controlado cuando sea necesario.

Los formularios deben ser cómodos de utilizar mediante teclado y pantalla táctil.

### 6.3. Componentes reutilizables

Crea componentes para:

- Tarjetas de indicadores.
- Campos de formulario.
- Selectores de fechas.
- Selectores de categorías.
- Tablas de operaciones.
- Modales de creación y edición.
- Confirmaciones de eliminación.
- Etiquetas de estado.
- Gráficos.
- Estados de carga.
- Estados vacíos.
- Mensajes de error y confirmación.

Utiliza formatos coherentes para moneda, fechas, porcentajes y cantidades fraccionarias.

### 6.4. Estados de la interfaz

Cada pantalla debe contemplar:

- Cargando.
- Carga correcta.
- Sin datos.
- Error recuperable.
- Sesión expirada.
- Sin conectividad.
- API no disponible.
- Límite gratuito agotado.
- Datos desactualizados.

No muestres errores internos, tokens ni información sensible al usuario.

Implementa accesibilidad básica mediante etiquetas, contraste suficiente, foco visible, navegación por teclado y controles con nombres comprensibles.

---

## 7. ESTRUCTURA DEL PROYECTO Y ORGANIZACIÓN DEL CÓDIGO

Organiza el proyecto por responsabilidades. Utiliza una estructura equivalente a la siguiente, ajustándola si la versión elegida de Next.js requiere alguna variación:

```text
/
├── app/
│   ├── (auth)/
│   │   └── login/
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   ├── finances/
│   │   ├── transactions/
│   │   ├── portfolio/
│   │   ├── assets/
│   │   └── settings/
│   ├── api/
│   │   └── market/
│   ├── auth/
│   │   └── callback/
│   ├── layout.tsx
│   ├── manifest.ts
│   └── globals.css
├── components/
│   ├── ui/
│   ├── dashboard/
│   ├── finances/
│   ├── portfolio/
│   └── charts/
├── lib/
│   ├── supabase/
│   ├── auth/
│   ├── finance/
│   ├── investments/
│   ├── market-data/
│   ├── validations/
│   └── utils/
├── types/
├── public/
│   ├── icons/
│   └── ...
├── supabase/
│   ├── migrations/
│   └── tests/
├── tests/
├── .env.example
├── package.json
├── README.md
└── ...
```

Separa la lógica de negocio de la presentación.

Utiliza módulos de dominio para los cálculos financieros y bursátiles. La interfaz no debe ser la única responsable de calcular posiciones, validar ventas o determinar si una cotización está disponible.

Usa Zod para validar entradas en los límites del sistema.

Crea tipos TypeScript coherentes con el esquema SQL y evita `any` sin justificación.

Mantén una única fuente de verdad para cada cálculo importante. Las métricas del portafolio deben reutilizar la misma lógica en el dashboard, el detalle de cada activo y las consultas correspondientes.

Genera tipos de base de datos cuando sea compatible con el flujo de trabajo y revísalos para que reflejen realmente el esquema de PostgreSQL.

---

## 8. PLAN DE EJECUCIÓN SECUENCIAL

Ejecuta las fases siguientes en orden. No abandones una fase esencial para pasar directamente a la siguiente por motivos estéticos.

### Fase 1. Inspección y planificación

1. Inspecciona archivos, dependencias y configuración.
2. Confirma la versión de Node.js y las herramientas disponibles.
3. Consulta la documentación vigente de Next.js, Supabase, Vercel y de la API bursátil candidata.
4. Diseña la arquitectura final.
5. Identifica variables de entorno, permisos y tareas que dependen de credenciales externas.
6. Presenta un plan breve dentro de la documentación del repositorio y comienza su ejecución.

**Criterio de aceptación:** el proyecto tiene una arquitectura definida, una lista de tareas verificables y ningún servicio de pago obligatorio.

### Fase 2. Inicialización y estructura base

1. Inicializa o adapta Next.js con App Router.
2. Configura TypeScript estricto.
3. Configura Tailwind CSS.
4. Añade las dependencias indispensables.
5. Crea la estructura de carpetas.
6. Configura ESLint y las herramientas de formato o validación elegidas.
7. Crea `.env.example`.
8. Verifica que el proyecto arranque y compile.

**Criterio de aceptación:** la aplicación base inicia correctamente y no presenta errores de compilación.

### Fase 3. PostgreSQL y seguridad

1. Crea las migraciones SQL.
2. Implementa las siete tablas mínimas.
3. Añade claves primarias `BIGINT GENERATED ALWAYS AS IDENTITY`.
4. Añade las claves foráneas y restricciones.
5. Crea índices B-tree justificados.
6. Activa RLS en todas las tablas.
7. Implementa las políticas de lectura y escritura.
8. Configura los permisos.
9. Implementa las funciones auxiliares y triggers necesarios.
10. Prepara pruebas automatizadas de aislamiento entre usuarios.

**Criterio de aceptación:** las migraciones pueden ejecutarse en una base de datos nueva y las pruebas demuestran que los datos de un usuario no son accesibles desde otra cuenta.

### Fase 4. Autenticación Google

1. Configura el cliente SSR de Supabase.
2. Implementa el botón de acceso.
3. Implementa la ruta de callback.
4. Configura las cookies y la persistencia de sesión.
5. Protege las rutas privadas.
6. Implementa el perfil.
7. Implementa el cierre de sesión.
8. Documenta la configuración manual en Google Cloud y Supabase.

**Criterio de aceptación:** el flujo de autenticación funciona cuando existen las credenciales y bloquea a usuarios no autenticados.

### Fase 5. Módulo de finanzas personales

1. Implementa operaciones CRUD.
2. Implementa categorías personalizadas.
3. Implementa validaciones de importes, tipos y fechas.
4. Implementa el historial.
5. Implementa el dashboard financiero.
6. Implementa filtros y gráficos.
7. Verifica que cada operación persista en PostgreSQL.
8. Comprueba que las métricas se actualicen tras cualquier modificación.

**Criterio de aceptación:** el módulo funciona de extremo a extremo con datos realmente guardados y no necesita datos ficticios para mostrar sus resultados.

### Fase 6. Portafolio de inversiones

1. Implementa la gestión de activos.
2. Implementa las compras y ventas.
3. Añade cantidades fraccionadas.
4. Añade registro por cantidad o por importe.
5. Implementa la validación de disponibilidad de títulos.
6. Implementa el costo promedio ponderado móvil.
7. Implementa ganancias y pérdidas realizadas y no realizadas.
8. Implementa el valor de mercado y los porcentajes de distribución.
9. Añade pruebas para escenarios de compra, venta y modificación retroactiva.

**Criterio de aceptación:** las posiciones y métricas coinciden con los resultados de los casos de prueba, incluidos los errores de redondeo y los intentos de venta de títulos no disponibles.

### Fase 7. API bursátil y gráficos

1. Verifica las condiciones vigentes de la API seleccionada.
2. Confirma los límites gratuitos y los permisos de visualización.
3. Implementa el adaptador del proveedor.
4. Implementa las rutas de cotizaciones e historial.
5. Integra la caché.
6. Implementa el manejo de límites y errores.
7. Integra `lightweight-charts`.
8. Implementa el gráfico de dona.
9. Añade marcas de tiempo y estados de cotización.
10. Implementa el modo de cotizaciones manuales.

**Criterio de aceptación:** los gráficos utilizan datos verificables cuando están disponibles, muestran correctamente su estado de actualización y no requieren una suscripción de pago para una alternativa funcional de seguimiento manual.

### Fase 8. PWA y adaptación móvil

1. Implementa el manifest.
2. Prepara iconos válidos.
3. Implementa el service worker compatible.
4. Configura HTTPS en el entorno de despliegue.
5. Asegura que la caché no exponga información privada.
6. Adapta formularios, tablas y gráficos a móviles.
7. Documenta la instalación.
8. Prueba el diseño en distintas resoluciones.

**Criterio de aceptación:** la aplicación se puede utilizar desde PC y móvil, y se instala desde navegadores compatibles sin depender de las tiendas de aplicaciones.

### Fase 9. Pruebas y control de calidad

Ejecuta como mínimo:

- Comprobación de tipos TypeScript.
- Linter.
- Compilación de producción.
- Pruebas unitarias de los cálculos financieros.
- Pruebas de validación de formularios.
- Pruebas de operaciones CRUD.
- Pruebas de RLS y aislamiento entre usuarios.
- Pruebas de ventas con cantidades insuficientes.
- Pruebas de fracciones de títulos.
- Pruebas de cotizaciones ausentes y desactualizadas.
- Pruebas de límites de la API.
- Pruebas de interfaz responsive.
- Pruebas de autenticación y rutas privadas.

Incluye los casos límite importantes y conserva los resultados obtenidos. No afirmes que una prueba pasó si no fue ejecutada correctamente.

### Fase 10. Preparación para despliegue

1. Configura el proyecto en Git.
2. Documenta las variables de entorno.
3. Documenta las migraciones.
4. Prepara el despliegue en Vercel.
5. Configura las URLs de callback de Google y Supabase.
6. Configura las variables del entorno de producción.
7. Verifica que los secretos no aparezcan en el cliente.
8. Prueba la aplicación desplegada.
9. Comprueba que no se activen servicios de pago ni gastos por superar las cuotas.
10. Documenta cómo restaurar el servicio si Supabase pausa el proyecto por inactividad.

No marques el despliegue como completo si faltan las credenciales o las configuraciones que necesariamente debe introducir el propietario de las cuentas.

### Fase 11. Documentación y entrega final

Entrega:

- Código fuente completo.
- Migraciones SQL versionadas.
- Políticas RLS y funciones auxiliares.
- `.env.example`.
- Instrucciones de instalación local.
- Instrucciones de configuración de Supabase.
- Guía de configuración de Google OAuth.
- Guía de configuración de la API bursátil.
- Guía de despliegue en Vercel.
- Instrucciones para instalar la PWA.
- Descripción de la estructura del proyecto.
- Explicación de los cálculos de inversión.
- Resultados de las pruebas.
- Limitaciones conocidas.
- Procedimiento para operar sin cotizaciones automáticas.

Cierra el proyecto con un informe que indique qué está implementado, qué se ha probado, qué depende de credenciales y qué acciones manuales faltan.

---

## 9. DEFINICIÓN DE TERMINADO Y CRITERIOS FINALES DE ACEPTACIÓN

El proyecto se considera terminado únicamente cuando se cumplan todos los criterios esenciales siguientes.

### Funcionalidad

- [ ] El usuario puede iniciar sesión mediante Google.
- [ ] El usuario puede registrar, modificar y eliminar ingresos y gastos.
- [ ] El usuario puede crear y gestionar categorías personalizadas.
- [ ] El dashboard muestra balances mensuales reales.
- [ ] El usuario puede registrar compras y ventas de acciones y ETF.
- [ ] El sistema admite títulos fraccionados y registro por importe.
- [ ] Las ventas se validan contra el historial de operaciones.
- [ ] El costo base, el valor de mercado y las ganancias o pérdidas se calculan correctamente.
- [ ] La distribución porcentual se calcula a partir de posiciones valorables.
- [ ] Los gráficos muestran datos históricos verificables cuando están disponibles.
- [ ] Los precios manuales permiten seguir utilizando el portafolio cuando la API no está disponible.

### Seguridad

- [ ] Todas las tablas de negocio tienen claves primarias numéricas del tipo requerido.
- [ ] Todas las tablas tienen RLS habilitado.
- [ ] No existen rutas privadas accesibles sin autenticación válida.
- [ ] Las políticas aíslan correctamente los datos por usuario.
- [ ] Las relaciones impiden vincular registros pertenecientes a usuarios distintos.
- [ ] Los secretos permanecen exclusivamente en el servidor.
- [ ] Las operaciones sensibles validan la integridad de los datos.

### Calidad

- [ ] TypeScript estricto funciona sin errores importantes.
- [ ] El linter se ejecuta correctamente.
- [ ] La compilación de producción finaliza correctamente.
- [ ] Las pruebas esenciales pasan.
- [ ] Los formularios tienen validaciones y mensajes útiles.
- [ ] Los estados de carga, vacío y error están implementados.
- [ ] La interfaz funciona en móvil y escritorio.
- [ ] La aplicación puede instalarse como PWA en los navegadores compatibles.

### Costos y despliegue

- [ ] Ninguna dependencia esencial exige una suscripción de pago.
- [ ] Los servicios están configurados dentro de sus condiciones de uso gratuito.
- [ ] No se requiere membresía de Apple Developer ni Google Play Console.
- [ ] Las APIs no provocan una dependencia obligatoria de planes de pago.
- [ ] La aplicación puede seguir utilizándose con cotizaciones manuales.
- [ ] Los límites de los servicios gratuitos están documentados.
- [ ] El despliegue respeta las condiciones comerciales del proveedor.
- [ ] El procedimiento de configuración desde cero está documentado.

## INSTRUCCIÓN FINAL PARA EL AGENTE

Comienza ahora inspeccionando el repositorio y el entorno disponibles. Después, ejecuta las fases de forma secuencial y construye la aplicación real.

No te limites a entregar recomendaciones, fragmentos de código aislados ni una arquitectura teórica. Escribe los archivos, implementa la lógica, prepara el esquema SQL, ejecuta las comprobaciones posibles y corrige los errores que encuentres.

Cuando una función dependa de claves externas, deja su integración preparada y explica exactamente cómo configurarla. No inventes credenciales ni afirmes que el servicio está conectado si no lo has verificado.

**La prioridad es entregar una aplicación funcional, segura, instalable, documentada y compatible con el objetivo de costo cero, no simplemente un prototipo visual.**
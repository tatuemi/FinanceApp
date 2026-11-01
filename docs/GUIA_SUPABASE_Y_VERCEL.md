# Guía Rápida de Activación en Supabase y Despliegue en Vercel Hobby ($0 USD/mes)

Esta guía resume los pasos exactos para dejar tu plataforma 100% operativa tanto en tu computadora como publicada en internet con HTTPS mediante **Vercel Hobby ($0/mes)**.

---

## Paso 1: Ejecutar la Migración SQL en tu Proyecto Supabase (`bthuewjxzhuggrcpmwvf`)

Ya comprobamos que tu proyecto Supabase (`https://bthuewjxzhuggrcpmwvf.supabase.co`) y el proveedor **Google OAuth 2.0** están activos, pero las 7 tablas de negocio aún no han sido creadas en tu base de datos remota (la clave pública `anon` tiene prohibido por seguridad ejecutar sentencias `CREATE TABLE`).

Haz lo siguiente (toma menos de 1 minuto):

1. Abre directamente el **SQL Editor** de tu proyecto en Supabase:
   - `https://supabase.com/dashboard/project/bthuewjxzhuggrcpmwvf/sql/new`
2. En tu computadora, abre el archivo:
   - [`supabase/migrations/20261028000001_initial_schema_and_security.sql`](../supabase/migrations/20261028000001_initial_schema_and_security.sql)
3. Selecciona todo su contenido (`Ctrl + A`), cópialo (`Ctrl + C`), pégalo en el editor SQL de Supabase (`Ctrl + V`) y haz clic en el botón **Run** (o `Ctrl + Enter`).
4. Para comprobar que las 7 tablas y las políticas RLS quedaron activas, ejecuta en tu terminal:
   ```powershell
   npm.cmd run verify:supabase
   ```

---

## Paso 2: Probar en Local

Con la migración ejecutada y tu archivo `.env.local` ya configurado:

```powershell
npm.cmd run dev
```

Abre `http://localhost:3000`, pulsa **«Continuar con Google»** y accederás automáticamente a tu dashboard personal con tus 11 categorías iniciales creadas.

---

## Paso 3: Subir el Proyecto a GitHub (Sin Exponer Secretos)

El archivo [`.gitignore`](../.gitignore) ya bloquea `.env` y `.env.local` para que tus claves nunca se suban al repositorio.

1. Crea un repositorio nuevo (privado o público) en [https://github.com/new](https://github.com/new).
2. En la terminal dentro de la carpeta del proyecto, ejecuta:
   ```powershell
   git add .
   git commit -m "feat: plataforma personal de finanzas e inversiones PWA"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
   git push -u origin main
   ```

---

## Paso 4: Desplegar Gratis en Vercel Hobby ($0 USD/mes)

1. Entra en [https://vercel.com](https://vercel.com) e inicia sesión con tu cuenta de GitHub (asegúrate de estar en el plan **Hobby — Personal, Non-Commercial Use**, que es $0 USD/mes y no requiere tarjeta bancaria).
2. Haz clic en **Add New... → Project** e importa el repositorio que acabas de subir.
3. En la sección **Environment Variables** de Vercel, añade estas variables:

   | Nombre de la Variable | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://bthuewjxzhuggrcpmwvf.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(Tu clave anon que ya está en `.env.local`)* |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | *(La misma clave anon)* |
   | `MARKET_DATA_PROVIDER` | `manual` *(o `twelvedata` / `finnhub` si añades tu API key gratuita)* |
   | `TWELVE_DATA_API_KEY` | *(Opcional: tu API key gratuita de twelvedata.com)* |
   | `FINNHUB_API_KEY` | *(Opcional: tu API key gratuita de finnhub.io)* |

4. Haz clic en **Deploy**. En aproximadamente 1 minuto Vercel te dará tu dominio HTTPS de producción (por ejemplo, `https://tu-app-finanzas.vercel.app`).

---

## Paso 5: Autorizar la URL de Vercel en Supabase Auth

Una vez que tengas la URL HTTPS de Vercel (`https://tu-app-finanzas.vercel.app`):

1. Entra en el panel de tu proyecto Supabase:
   - `https://supabase.com/dashboard/project/bthuewjxzhuggrcpmwvf/auth/url-configuration`
2. En **Site URL**, escribe tu URL de producción:
   - `https://tu-app-finanzas.vercel.app`
3. En **Redirect URLs**, asegúrate de tener añadidas ambas rutas (local y producción):
   - `http://localhost:3000/auth/callback`
   - `https://tu-app-finanzas.vercel.app/auth/callback`
4. Guarda los cambios (**Save**).

¡Listo! Desde ese momento podrás abrir la URL HTTPS desde tu computadora o teléfono móvil, iniciar sesión con Google e instalar la PWA en tu pantalla de inicio.

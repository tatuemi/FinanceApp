'use server';

import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { ensureUserProfileForUser } from './session';

const loginSchema = z.object({
  email: z.string().trim().email('Introduce un correo electrónico válido.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
});

const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Introduce tu nombre completo (mínimo 2 caracteres).')
    .max(100, 'El nombre no puede superar los 100 caracteres.'),
  email: z.string().trim().email('Introduce un correo electrónico válido.'),
  password: z
    .string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres.')
    .max(72, 'La contraseña no puede superar los 72 caracteres.'),
  originUrl: z.string().optional(),
});

export interface AuthActionResult {
  success: boolean;
  message: string;
  autoSignedIn?: boolean;
}

export async function loginWithEmailAction(rawInput: {
  email: string;
  password: string;
}): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? 'Datos de inicio de sesión inválidos.',
    };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error || !data.user) {
      const msg = error?.message?.toLowerCase() ?? '';
      if (msg.includes('invalid login credentials')) {
        return {
          success: false,
          message:
            'Correo o contraseña incorrectos. Si eres nuevo, selecciona la pestaña «Crear cuenta».',
        };
      }
      if (msg.includes('email not confirmed')) {
        return {
          success: false,
          message:
            'Tu correo electrónico aún no ha sido confirmado. Revisa tu bandeja de entrada (o desactiva "Confirm email" en Supabase → Authentication → Providers → Email).',
        };
      }
      return {
        success: false,
        message: 'No se pudo iniciar sesión. Verifica tus datos e inténtalo de nuevo.',
      };
    }

    await ensureUserProfileForUser(data.user);

    return {
      success: true,
      autoSignedIn: true,
      message: 'Sesión iniciada correctamente.',
    };
  } catch {
    return {
      success: false,
      message: 'Error al conectar con el servidor de autenticación.',
    };
  }
}

export async function registerWithEmailAction(rawInput: {
  fullName: string;
  email: string;
  password: string;
  originUrl?: string;
}): Promise<AuthActionResult> {
  const parsed = registerSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? 'Datos de registro inválidos.',
    };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const callbackUrl = parsed.data.originUrl
      ? `${parsed.data.originUrl.replace(/\/$/, '')}/auth/callback`
      : undefined;

    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          full_name: parsed.data.fullName,
          name: parsed.data.fullName,
        },
        ...(callbackUrl ? { emailRedirectTo: callbackUrl } : {}),
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('already registered') || msg.includes('already exists')) {
        return {
          success: false,
          message:
            'Este correo ya está registrado. Cambia a la pestaña «Iniciar sesión» para entrar.',
        };
      }
      if (msg.includes('rate limit')) {
        return {
          success: false,
          message:
            'Límite de envío de correos alcanzado temporalmente. Intenta en unos minutos o inicia sesión con Google.',
        };
      }
      return {
        success: false,
        message: `No se pudo crear la cuenta: ${error.message}`,
      };
    }

    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return {
        success: false,
        message:
          'Este correo ya tiene una cuenta registrada. Usa la pestaña «Iniciar sesión» o entra con Google.',
      };
    }

    if (data.session && data.user) {
      await ensureUserProfileForUser(data.user);
      return {
        success: true,
        autoSignedIn: true,
        message: '¡Cuenta creada exitosamente! Redirigiendo a tu panel...',
      };
    }

    return {
      success: true,
      autoSignedIn: false,
      message:
        '¡Cuenta registrada! Te enviamos un correo de confirmación. Abre el enlace que llegó a tu correo para activar tu cuenta (o si eres el administrador, puedes desactivar "Confirm email" en Supabase → Authentication → Providers → Email para entrar directo).',
    };
  } catch {
    return {
      success: false,
      message: 'Error al registrar la cuenta en el servidor.',
    };
  }
}

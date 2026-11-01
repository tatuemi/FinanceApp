'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { loginWithEmailAction, registerWithEmailAction } from '@/lib/auth/actions';
import {
  Mail,
  Lock,
  User,
  Loader2,
  AlertCircle,
  CheckCircle2,
  LogIn,
  UserPlus,
} from 'lucide-react';

interface EmailAuthFormProps {
  isConfigured: boolean;
  nextPath?: string;
}

export function EmailAuthForm({
  isConfigured,
  nextPath = '/dashboard',
}: EmailAuthFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [feedback, setFeedback] = useState<{
    type: 'ok' | 'err';
    text: string;
  } | null>(null);

  function switchMode(nextMode: 'login' | 'register') {
    setMode(nextMode);
    setFeedback(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (!isConfigured) {
      setFeedback({
        type: 'err',
        text: 'Configura primero las variables de Supabase en el entorno.',
      });
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setFeedback({
        type: 'err',
        text: 'Las contraseñas no coinciden. Verifica ambos campos.',
      });
      return;
    }

    startTransition(async () => {
      if (mode === 'login') {
        const res = await loginWithEmailAction({ email, password });
        if (!res.success) {
          setFeedback({ type: 'err', text: res.message });
          return;
        }
        setFeedback({ type: 'ok', text: res.message });
        router.push(nextPath);
        router.refresh();
      } else {
        const res = await registerWithEmailAction({
          fullName,
          email,
          password,
          originUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
        });
        if (!res.success) {
          setFeedback({ type: 'err', text: res.message });
          return;
        }
        setFeedback({ type: 'ok', text: res.message });
        if (res.autoSignedIn) {
          router.push(nextPath);
          router.refresh();
        } else {
          setPassword('');
          setConfirmPassword('');
        }
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Selector de pestaña: Iniciar sesión vs Crear cuenta */}
      <div className="grid grid-cols-2 rounded-xl border border-slate-800 bg-slate-950/80 p-1">
        <button
          type="button"
          onClick={() => switchMode('login')}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
            mode === 'login'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LogIn className="h-3.5 w-3.5" />
          <span>Iniciar sesión</span>
        </button>
        <button
          type="button"
          onClick={() => switchMode('register')}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
            mode === 'register'
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <UserPlus className="h-3.5 w-3.5" />
          <span>Crear cuenta nueva</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {mode === 'register' && (
          <div>
            <label
              htmlFor="auth-fullname"
              className="block text-xs font-medium text-slate-300"
            >
              Nombre completo *
            </label>
            <div className="relative mt-1">
              <User className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                id="auth-fullname"
                type="text"
                required
                maxLength={100}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej. Emilio Aguilera"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        <div>
          <label
            htmlFor="auth-email"
            className="block text-xs font-medium text-slate-300"
          >
            Correo electrónico *
          </label>
          <div className="relative mt-1">
            <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="auth-password"
            className="block text-xs font-medium text-slate-300"
          >
            Contraseña *
          </label>
          <div className="relative mt-1">
            <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              id="auth-password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {mode === 'register' && (
          <div>
            <label
              htmlFor="auth-confirm-password"
              className="block text-xs font-medium text-slate-300"
            >
              Confirmar contraseña *
            </label>
            <div className="relative mt-1">
              <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                id="auth-confirm-password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite tu contraseña"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {feedback && (
          <div
            role={feedback.type === 'err' ? 'alert' : 'status'}
            className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${
              feedback.type === 'ok'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
            }`}
          >
            {feedback.type === 'ok' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending || !isConfigured}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>
                {mode === 'login' ? 'Iniciando sesión...' : 'Creando cuenta...'}
              </span>
            </>
          ) : (
            <span>
              {mode === 'login' ? 'Entrar con mi cuenta' : 'Registrarme y crear cuenta'}
            </span>
          )}
        </button>
      </form>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Wallet,
  History,
  PieChart,
  Briefcase,
  ArrowLeftRight,
  Settings,
  LogOut,
  TrendingUp,
  Menu,
  X,
} from 'lucide-react';
import { PwaInstaller } from '@/components/ui/PwaInstaller';

interface AppShellProps {
  userEmail: string;
  fullName: string;
  avatarUrl: string | null;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/finances', label: 'Finanzas', icon: Wallet },
  { href: '/transactions', label: 'Historial financiero', icon: History },
  { href: '/portfolio', label: 'Portafolio', icon: PieChart },
  { href: '/assets', label: 'Activos', icon: Briefcase },
  { href: '/investments', label: 'Operaciones de inversión', icon: ArrowLeftRight },
  { href: '/settings', label: 'Ajustes', icon: Settings },
] as const;

const MOBILE_BOTTOM_NAV = [
  { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { href: '/finances', label: 'Finanzas', icon: Wallet },
  { href: '/portfolio', label: 'Portafolio', icon: PieChart },
  { href: '/investments', label: 'Invertir', icon: ArrowLeftRight },
  { href: '/settings', label: 'Ajustes', icon: Settings },
] as const;

export function AppShell({ userEmail, fullName, children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col lg:flex-row">
      {/* Barra lateral en escritorio (lg+) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-800/80 bg-slate-950/90">
        <div className="flex h-16 items-center gap-3 px-6 border-b border-slate-800/80">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
            <TrendingUp className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight text-white">
              Finanzas & Portafolio
            </span>
            <span className="block text-[10px] font-medium text-emerald-400">
              Base USD · RLS Activo
            </span>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto" aria-label="Navegación principal">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium transition ${
                  isActive
                    ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-800/80 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">{fullName}</p>
              <p className="truncate text-[11px] text-slate-400">{userEmail}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <PwaInstaller />
            <form action="/auth/signout" method="POST">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-rose-500/15 hover:text-rose-300 hover:border-rose-500/30 transition"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Salir</span>
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Cabecera compacta móvil (< lg) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-800/80 bg-slate-950/95 px-4 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
          </div>
          <span className="text-sm font-bold text-white">Finanzas & Portafolio</span>
        </div>

        <div className="flex items-center gap-2">
          <PwaInstaller />
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Abrir menú de navegación"
            className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-300 hover:text-white"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Menú desplegable móvil completo */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs lg:hidden">
          <div className="fixed inset-y-0 right-0 w-72 border-l border-slate-800 bg-slate-950 p-5 shadow-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <p className="text-xs font-semibold text-white">{fullName}</p>
                  <p className="text-[11px] text-slate-400">{userEmail}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Cerrar menú"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <nav className="mt-4 space-y-1" aria-label="Menú móvil">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium ${
                        isActive
                          ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                          : 'text-slate-300 hover:bg-slate-900'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <form action="/auth/signout" method="POST" className="border-t border-slate-800 pt-4">
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs font-semibold text-rose-300"
              >
                <LogOut className="h-4 w-4" />
                <span>Cerrar sesión</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Contenido principal */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-10 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Barra inferior fija en móviles (< lg) */}
      <nav
        aria-label="Navegación rápida móvil"
        className="fixed bottom-0 inset-x-0 z-30 flex items-center justify-around border-t border-slate-800/90 bg-slate-950/95 px-2 py-1.5 backdrop-blur lg:hidden"
      >
        {MOBILE_BOTTOM_NAV.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[10px] font-medium transition ${
                isActive ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { Download, Smartphone, WifiOff, Share, PlusSquare, X, Monitor } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function PwaInstaller({ showInlineGuide = false }: { showInlineGuide?: boolean }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Registrar Service Worker seguro (solo activos estáticos)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Silenciar si el navegador bloquea SW en modo incógnito
      });
    }

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(standalone);

    const ua = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(ua);
    setIsIos(iosDevice);

    setIsOffline(!window.navigator.onLine);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  async function handleInstallClick() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
      return;
    }
    setShowModal(true);
  }

  return (
    <>
      {isOffline && (
        <div
          role="status"
          className="flex items-center justify-center gap-2 bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 text-xs font-medium text-amber-200"
        >
          <WifiOff className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <span>
            Sin conexión a internet. La interfaz está disponible; para guardar o actualizar datos necesitarás restablecer la conexión.
          </span>
        </div>
      )}

      {!isInstalled && !showInlineGuide && (
        <button
          type="button"
          onClick={handleInstallClick}
          className="inline-flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/20"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Instalar App</span>
        </button>
      )}

      {showInlineGuide && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Instalación como Aplicación (PWA) en PC y Celular
                </h3>
                <p className="text-xs text-slate-400">
                  {isInstalled
                    ? 'La aplicación ya se está ejecutando en modo instalado (standalone).'
                    : 'Instálala directamente desde tu navegador sin pasar por tiendas móviles ($0 USD).'}
                </p>
              </div>
            </div>
            {!isInstalled && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                <Download className="h-4 w-4" />
                <span>{deferredPrompt ? 'Instalar ahora' : 'Ver instrucciones'}</span>
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3 text-xs">
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3.5">
              <div className="flex items-center gap-2 font-semibold text-slate-200">
                <Monitor className="h-4 w-4 text-indigo-400" />
                <span>Computadora (Chrome / Edge)</span>
              </div>
              <p className="mt-1.5 text-slate-400 leading-relaxed">
                Haz clic en el icono de instalación en la barra de direcciones o pulsa el botón «Instalar App».
              </p>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3.5">
              <div className="flex items-center gap-2 font-semibold text-slate-200">
                <Smartphone className="h-4 w-4 text-emerald-400" />
                <span>Android (Chrome)</span>
              </div>
              <p className="mt-1.5 text-slate-400 leading-relaxed">
                Abre el menú del navegador (⋮) y selecciona «Instalar aplicación» o «Añadir a la pantalla de inicio».
              </p>
            </div>
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3.5">
              <div className="flex items-center gap-2 font-semibold text-slate-200">
                <Share className="h-4 w-4 text-sky-400" />
                <span>iPhone / iPad (Safari)</span>
              </div>
              <p className="mt-1.5 text-slate-400 leading-relaxed">
                Toca el botón Compartir (<Share className="inline h-3 w-3" />) en Safari y elige «Agregar a inicio» (<PlusSquare className="inline h-3 w-3" />).
              </p>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <h3 id="pwa-modal-title" className="text-base font-semibold text-white">
                Cómo instalar Finanzas & Portafolio
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Cerrar instrucciones"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-slate-300">
              {isIos ? (
                <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3.5">
                  <p className="font-semibold text-sky-300">Estás en iOS (iPhone / iPad):</p>
                  <ol className="mt-2 list-inside list-decimal space-y-1.5">
                    <li>Toca el icono de Compartir en la barra de Safari.</li>
                    <li>Desliza hacia abajo y selecciona «Agregar a inicio».</li>
                    <li>Confirma tocando «Agregar» en la esquina superior derecha.</li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <p className="font-semibold text-slate-200">En PC (Chrome, Edge, Brave):</p>
                    <p className="mt-1 text-slate-400">
                      Haz clic en el icono de instalar aplicación situado en el extremo derecho de la barra de direcciones URL.
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <p className="font-semibold text-slate-200">En Android (Chrome):</p>
                    <p className="mt-1 text-slate-400">
                      Abre el menú de tres puntos (⋮) arriba a la derecha y selecciona «Instalar aplicación».
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

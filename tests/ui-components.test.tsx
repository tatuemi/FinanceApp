// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { CategoryIcon } from '@/components/ui/CategoryIcon';

describe('Fase 8 y 9: Pruebas de Componentes de Interfaz, Estados y Accesibilidad', () => {
  it('renderiza correctamente todos los estados de cotización en StatusBadge', () => {
    const { rerender } = render(<StatusBadge status="live" label="twelvedata" />);
    expect(screen.getByText('twelvedata')).toBeDefined();

    rerender(<StatusBadge status="manual" />);
    expect(screen.getByText('Manual')).toBeDefined();

    rerender(<StatusBadge status="stale" />);
    expect(screen.getByText('Desactualizada')).toBeDefined();

    rerender(<StatusBadge status="quota_exhausted" />);
    expect(screen.getByText('Límite gratuito alcanzado')).toBeDefined();

    rerender(<StatusBadge status="missing" />);
    expect(screen.getByText('Sin cotización')).toBeDefined();
  });

  it('muestra el diálogo de confirmación accesible y ejecuta callbacks al confirmar o cancelar', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        isOpen={true}
        title="Eliminar operación de prueba"
        description="¿Confirmas eliminar este registro?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Eliminar operación de prueba')).toBeDefined();

    fireEvent.click(screen.getByText('Confirmar eliminación'));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Cancelar'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('deshabilita el botón de Google OAuth cuando faltan credenciales y lo habilita cuando están presentes', () => {
    const { rerender } = render(<GoogleSignInButton isConfigured={false} />);
    const btn = screen.getByRole('button', { name: /Continuar con Google/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);

    rerender(
      <GoogleSignInButton
        isConfigured={true}
        supabaseUrl="https://example.supabase.co"
        supabaseKey="public-anon-key"
      />
    );
    const enabledBtn = screen.getByRole('button', { name: /Continuar con Google/i });
    expect((enabledBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('renderiza iconos de categorías controlados sin errores', () => {
    const icons = ['wallet', 'briefcase', 'laptop', 'utensils', 'car', 'zap', 'tag'];
    for (const icon of icons) {
      const { container } = render(<CategoryIcon iconName={icon} />);
      expect(container.querySelector('svg')).not.toBeNull();
    }
  });
});

'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useMemo, useState } from 'react';

export interface ToastItem {
  id: string;
  title: string;
  variant?: 'default' | 'destructive';
}

interface ToastContextValue {
  toasts: ToastItem[];
  toast: (toast: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps): ReactNode {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      toast: (toastValue) => {
        const id = crypto.randomUUID();

        setToasts((current) => [...current, { id, ...toastValue }]);

        window.setTimeout(() => {
          setToasts((current) => current.filter((toastItem) => toastItem.id !== id));
        }, 3000);
      },
      dismiss: (id) => {
        setToasts((current) => current.filter((toastItem) => toastItem.id !== id));
      },
    }),
    [toasts],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): Pick<ToastContextValue, 'toast'> {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider.');
  }

  return {
    toast: context.toast,
  };
}

export function useToastState(): ToastContextValue {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToastState must be used within a ToastProvider.');
  }

  return context;
}
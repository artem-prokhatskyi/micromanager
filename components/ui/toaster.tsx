'use client';

import type { ReactElement } from 'react';

import { useToastState } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function Toaster(): ReactElement {
  const { dismiss, toasts } = useToastState();

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-3">
      {toasts.map((toast) => (
        <div
          className={cn(
            'pointer-events-auto rounded-2xl border px-4 py-3 shadow-2xl shadow-black/20 backdrop-blur',
            toast.variant === 'destructive'
              ? 'border-red-500/40 bg-red-950/80 text-red-100'
              : 'border-border/80 bg-card/90 text-card-foreground',
          )}
          key={toast.id}
          role="status"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium leading-6">{toast.title}</p>
            <button
              aria-label="Dismiss notification"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => dismiss(toast.id)}
              type="button"
            >
              Close
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
'use client';

import type { ButtonHTMLAttributes, HTMLAttributes, ReactElement, ReactNode } from 'react';
import { createContext, useContext, useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

interface AlertDialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const AlertDialogContext = createContext<AlertDialogContextValue | null>(null);

interface AlertDialogProps {
  children: ReactNode;
}

interface AlertDialogActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

interface AlertDialogCancelProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

interface AlertDialogContentProps extends HTMLAttributes<HTMLDivElement> {}

interface AlertDialogDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

interface AlertDialogFooterProps extends HTMLAttributes<HTMLDivElement> {}

interface AlertDialogHeaderProps extends HTMLAttributes<HTMLDivElement> {}

interface AlertDialogTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

interface AlertDialogTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

function useAlertDialog(): AlertDialogContextValue {
  const context = useContext(AlertDialogContext);

  if (!context) {
    throw new Error('AlertDialog components must be used within AlertDialog.');
  }

  return context;
}

export function AlertDialog({ children }: AlertDialogProps): ReactElement {
  const [open, setOpen] = useState<boolean>(false);
  const value = useMemo<AlertDialogContextValue>(() => ({ open, setOpen }), [open]);

  return <AlertDialogContext.Provider value={value}>{children}</AlertDialogContext.Provider>;
}

export function AlertDialogTrigger({ children, className, ...props }: AlertDialogTriggerProps): ReactElement {
  const { setOpen } = useAlertDialog();

  return (
    <button
      className={className}
      onClick={() => setOpen(true)}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

export function AlertDialogContent({ children, className, ...props }: AlertDialogContentProps): ReactElement | null {
  const { open, setOpen } = useAlertDialog();

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <button
        aria-label="Close dialog"
        className="absolute inset-0"
        onClick={() => setOpen(false)}
        type="button"
      />
      <div
        className={cn(
          'relative z-10 w-full max-w-md rounded-3xl border border-border/80 bg-card p-6 shadow-2xl shadow-black/30',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

export function AlertDialogHeader({ className, ...props }: AlertDialogHeaderProps): ReactElement {
  return <div className={cn('space-y-2', className)} {...props} />;
}

export function AlertDialogTitle({ className, ...props }: AlertDialogTitleProps): ReactElement {
  return <h2 className={cn('text-lg font-semibold tracking-tight text-foreground', className)} {...props} />;
}

export function AlertDialogDescription({ className, ...props }: AlertDialogDescriptionProps): ReactElement {
  return <p className={cn('text-sm leading-6 text-muted-foreground', className)} {...props} />;
}

export function AlertDialogFooter({ className, ...props }: AlertDialogFooterProps): ReactElement {
  return <div className={cn('mt-6 flex justify-end gap-3', className)} {...props} />;
}

export function AlertDialogCancel({ className, onClick, ...props }: AlertDialogCancelProps): ReactElement {
  const { setOpen } = useAlertDialog();

  return (
    <button
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-lg border border-border bg-card/40 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        setOpen(false);
      }}
      type="button"
      {...props}
    />
  );
}

export function AlertDialogAction({ className, onClick, ...props }: AlertDialogActionProps): ReactElement {
  const { setOpen } = useAlertDialog();

  return (
    <button
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        setOpen(false);
      }}
      type="button"
      {...props}
    />
  );
}
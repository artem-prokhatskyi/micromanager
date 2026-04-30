'use client';

import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import { createContext, useContext, useEffect } from 'react';

import { cn } from '@/lib/utils';

interface DialogContextValue {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

const DialogContext = createContext<DialogContextValue | null>(null);

interface DialogProps {
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

interface DialogContentProps extends HTMLAttributes<HTMLDivElement> {}

interface DialogDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

interface DialogFooterProps extends HTMLAttributes<HTMLDivElement> {}

interface DialogHeaderProps extends HTMLAttributes<HTMLDivElement> {}

interface DialogTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

function useDialog(): DialogContextValue {
  const context = useContext(DialogContext);

  if (!context) {
    throw new Error('Dialog components must be used within Dialog.');
  }

  return context;
}

export function Dialog({ children, onOpenChange, open }: DialogProps): ReactElement {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return <DialogContext.Provider value={{ onOpenChange, open }}>{children}</DialogContext.Provider>;
}

export function DialogContent({ children, className, ...props }: DialogContentProps): ReactElement | null {
  const { onOpenChange, open } = useDialog();

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 px-4 py-4 sm:py-8">
      <button aria-label="Close dialog" className="absolute inset-0" onClick={() => onOpenChange(false)} type="button" />
      <div
        className={cn(
          'relative z-10 mx-auto my-auto w-full max-w-2xl overflow-y-auto rounded-3xl border border-border/80 bg-card p-4 shadow-2xl shadow-black/30 max-h-[calc(100vh-2rem)] sm:p-6 sm:max-h-[calc(100vh-4rem)]',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ className, ...props }: DialogHeaderProps): ReactElement {
  return <div className={cn('space-y-2', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: DialogTitleProps): ReactElement {
  return <h2 className={cn('text-xl font-semibold tracking-tight text-foreground', className)} {...props} />;
}

export function DialogDescription({ className, ...props }: DialogDescriptionProps): ReactElement {
  return <p className={cn('text-sm leading-6 text-muted-foreground', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: DialogFooterProps): ReactElement {
  return <div className={cn('flex flex-wrap justify-end gap-3', className)} {...props} />;
}
'use client';

import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import { createContext, useContext, useState } from 'react';

import { cn } from '@/lib/utils';

interface TooltipContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const TooltipContext = createContext<TooltipContextValue | null>(null);

interface TooltipProps {
  children: ReactNode;
}

interface TooltipContentProps extends HTMLAttributes<HTMLDivElement> {}

interface TooltipTriggerProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
}

function useTooltip(): TooltipContextValue {
  const context = useContext(TooltipContext);

  if (!context) {
    throw new Error('Tooltip components must be used within Tooltip.');
  }

  return context;
}

export function Tooltip({ children }: TooltipProps): ReactElement {
  const [open, setOpen] = useState<boolean>(false);

  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <span className="relative inline-flex">{children}</span>
    </TooltipContext.Provider>
  );
}

export function TooltipTrigger({ children, className, ...props }: TooltipTriggerProps): ReactElement {
  const { setOpen } = useTooltip();

  return (
    <span
      className={cn('inline-flex', className)}
      onBlur={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      {...props}
    >
      {children}
    </span>
  );
}

export function TooltipContent({ children, className, ...props }: TooltipContentProps): ReactElement | null {
  const { open } = useTooltip();

  if (!open) {
    return null;
  }

  return (
    <div
      className={cn(
        'absolute left-1/2 top-full z-20 mt-2 w-max max-w-64 -translate-x-1/2 rounded-2xl border border-border/80 bg-background/95 px-3 py-2 text-left text-xs text-foreground shadow-2xl shadow-black/20 backdrop-blur',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
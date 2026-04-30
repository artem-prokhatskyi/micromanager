import type { HTMLAttributes, ReactElement } from 'react';

import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'secondary' | 'outline';

type ExtendedBadgeVariant = BadgeVariant | 'destructive';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: ExtendedBadgeVariant;
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps): ReactElement {
  const variantClassName = {
    default: 'bg-primary/15 text-primary',
    secondary: 'bg-secondary text-secondary-foreground',
    outline: 'border border-border bg-transparent text-foreground',
    destructive: 'bg-red-500/15 text-red-200 ring-1 ring-inset ring-red-500/40',
  } satisfies Record<ExtendedBadgeVariant, string>;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium tracking-tight',
        variantClassName[variant],
        className,
      )}
      {...props}
    />
  );
}
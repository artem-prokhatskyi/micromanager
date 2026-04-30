import type { HTMLAttributes, ReactElement } from 'react';

import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'secondary' | 'outline';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps): ReactElement {
  const variantClassName = {
    default: 'bg-primary/15 text-primary',
    secondary: 'bg-secondary text-secondary-foreground',
    outline: 'border border-border bg-transparent text-foreground',
  } satisfies Record<BadgeVariant, string>;

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
import type { HTMLAttributes, ReactElement } from 'react';

import { cn } from '@/lib/utils';

interface SeparatorProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
}

export function Separator({ className, orientation = 'horizontal', ...props }: SeparatorProps): ReactElement {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'shrink-0 bg-border/80',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  );
}
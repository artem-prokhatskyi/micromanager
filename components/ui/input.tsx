import type { InputHTMLAttributes, ReactElement } from 'react';

import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, type = 'text', ...props }: InputProps): ReactElement {
  return (
    <input
      className={cn(
        'flex h-10 w-full rounded-xl border border-input bg-background/70 px-3 py-2 text-sm text-foreground transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      type={type}
      {...props}
    />
  );
}
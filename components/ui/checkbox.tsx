import type { InputHTMLAttributes, ReactElement } from 'react';

import { cn } from '@/lib/utils';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {}

export function Checkbox({ className, ...props }: CheckboxProps): ReactElement {
  return (
    <input
      className={cn(
        'h-4 w-4 rounded border border-input bg-background text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      type="checkbox"
      {...props}
    />
  );
}
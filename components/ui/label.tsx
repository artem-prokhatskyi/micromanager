import type { LabelHTMLAttributes, ReactElement } from 'react';

import { cn } from '@/lib/utils';

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {}

export function Label({ className, ...props }: LabelProps): ReactElement {
  return <label className={cn('text-sm font-medium text-foreground', className)} {...props} />;
}
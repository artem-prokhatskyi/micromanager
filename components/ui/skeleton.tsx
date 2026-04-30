import type { HTMLAttributes, ReactElement } from 'react';

import { cn } from '@/lib/utils';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps): ReactElement {
  return <div className={cn('animate-pulse rounded-xl bg-accent/70', className)} {...props} />;
}
import type { ReactElement } from 'react';

import { cn } from '@/lib/utils';

interface SprintBandProps {
  isEnd: boolean;
  isOverdue: boolean;
  isStart: boolean;
  title: string;
}

export function SprintBand({ isEnd, isOverdue, isStart, title }: SprintBandProps): ReactElement {
  return (
    <div
      aria-label={title}
      className={cn(
        'h-2 w-full border border-transparent',
        isOverdue ? 'bg-destructive/35' : 'bg-sky-500/30',
        isStart ? 'rounded-l-full' : 'rounded-l-none',
        isEnd ? 'rounded-r-full' : 'rounded-r-none',
      )}
    />
  );
}
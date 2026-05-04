import type { ReactElement } from 'react';

import Link from 'next/link';

import { cn } from '@/lib/utils';

interface SprintBandProps {
  className?: string;
  href: string;
  isEnd: boolean;
  isStart: boolean;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  title: string;
}

export function SprintBand({ className, href, isEnd, isStart, onClick, title }: SprintBandProps): ReactElement {
  return (
    <div className="group relative w-full">
      <Link
        aria-label={title}
        className={cn(
          'block h-2 w-full border border-transparent transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          className,
          isStart ? 'rounded-l-full' : 'rounded-l-none',
          isEnd ? 'rounded-r-full' : 'rounded-r-none',
        )}
        href={href}
        onClick={onClick}
        title={title}
      />
      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-max max-w-64 -translate-x-1/2 rounded-2xl border border-border/80 bg-background/95 px-3 py-2 text-left text-xs text-foreground shadow-2xl shadow-black/20 backdrop-blur group-hover:block group-focus-within:block">
        {title}
      </div>
    </div>
  );
}
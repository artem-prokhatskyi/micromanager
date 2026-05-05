import type { ReactElement } from 'react';

import { NonWorkingDayTooltip } from '@/components/calendar/non-working-day-tooltip';
import { SprintBand } from '@/components/calendar/sprint-band';
import { cn } from '@/lib/utils';
import type { CalendarNonWorkingDayRecord } from '@/types';

interface DayBand {
  className: string;
  href: string;
  id: string;
  isEnd: boolean;
  isStart: boolean;
  title: string;
}

interface CalendarDayCellProps {
  bands: DayBand[];
  dateNumber: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  nonWorkingDays: CalendarNonWorkingDayRecord[];
  onClick: () => void;
}

export function CalendarDayCell({
  bands,
  dateNumber,
  isCurrentMonth,
  isToday,
  nonWorkingDays,
  onClick,
}: CalendarDayCellProps): ReactElement {
  return (
    <div
      className={cn(
        'relative flex h-[66px] w-full cursor-pointer flex-col items-stretch justify-between rounded-2xl border border-border/60 bg-background/70 px-2 py-2 text-left shadow-none transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        isToday && 'border-primary/70 bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.16)] hover:bg-primary/15',
        !isCurrentMonth && 'bg-background/30 text-muted-foreground hover:bg-background/50',
      )}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="space-y-1">
        {bands.map((band) => (
          <SprintBand
            className={band.className}
            href={band.href}
            isEnd={band.isEnd}
            isStart={band.isStart}
            key={band.id}
            onClick={(event) => {
              event.stopPropagation();
            }}
            title={band.title}
          />
        ))}
      </div>
      <div className="flex items-end justify-between">
        <span className={cn('text-sm font-medium', !isCurrentMonth && 'text-muted-foreground')}>{dateNumber}</span>
        {nonWorkingDays.length > 0 ? (
          <NonWorkingDayTooltip records={nonWorkingDays}>
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive/15 px-1.5 text-xs font-semibold text-destructive">
              ×
            </span>
          </NonWorkingDayTooltip>
        ) : null}
      </div>
    </div>
  );
}
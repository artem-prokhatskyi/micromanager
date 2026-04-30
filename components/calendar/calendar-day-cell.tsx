import type { ReactElement } from 'react';

import { NonWorkingDayTooltip } from '@/components/calendar/non-working-day-tooltip';
import { SprintBand } from '@/components/calendar/sprint-band';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CalendarNonWorkingDayRecord } from '@/types';

interface DayBand {
  id: string;
  isEnd: boolean;
  isOverdue: boolean;
  isStart: boolean;
  title: string;
}

interface CalendarDayCellProps {
  bands: DayBand[];
  dateNumber: string;
  isCurrentMonth: boolean;
  nonWorkingDays: CalendarNonWorkingDayRecord[];
  onClick: () => void;
}

export function CalendarDayCell({
  bands,
  dateNumber,
  isCurrentMonth,
  nonWorkingDays,
  onClick,
}: CalendarDayCellProps): ReactElement {
  return (
    <Button
      className={cn(
        'relative h-28 w-full flex-col items-stretch rounded-2xl border border-border/60 bg-background/70 px-2 py-2 text-left shadow-none hover:bg-accent/40',
        !isCurrentMonth && 'bg-background/30 text-muted-foreground hover:bg-background/50',
      )}
      onClick={onClick}
      type="button"
      variant="ghost"
    >
      <div className="space-y-1">
        {bands.map((band) => (
          <SprintBand
            isEnd={band.isEnd}
            isOverdue={band.isOverdue}
            isStart={band.isStart}
            key={band.id}
            title={band.title}
          />
        ))}
      </div>
      <div className="mt-2 flex items-start justify-between gap-2">
        <span className={cn('text-sm font-medium', !isCurrentMonth && 'text-muted-foreground')}>{dateNumber}</span>
        {nonWorkingDays.length > 0 ? (
          <NonWorkingDayTooltip records={nonWorkingDays}>
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive/15 px-1.5 text-xs font-semibold text-destructive">
              ×
            </span>
          </NonWorkingDayTooltip>
        ) : null}
      </div>
    </Button>
  );
}
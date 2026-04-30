import type { ReactElement } from 'react';

import { CalendarDayCell } from '@/components/calendar/calendar-day-cell';
import {
  endOfUtcMonth,
  formatUtcDate,
  getTodayUtc,
  isSameUtcMonth,
  listUtcDaysInRange,
  parseUtcDate,
  startOfUtcMonth,
  startOfUtcWeek,
  endOfUtcWeek,
} from '@/lib/date';
import type { CalendarNonWorkingDayRecord, CalendarSprintBand } from '@/types';

interface CalendarMonthProps {
  month: Date;
  nonWorkingDays: CalendarNonWorkingDayRecord[];
  onDayClick: (date: Date) => void;
  sprints: CalendarSprintBand[];
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatMonthLabel(month: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(month);
}

function getEffectiveSprintEnd(sprint: CalendarSprintBand): Date {
  if (sprint.actualEnd) {
    return parseUtcDate(sprint.actualEnd);
  }

  return sprint.isOverdue ? getTodayUtc() : parseUtcDate(sprint.plannedEnd);
}

export function CalendarMonth({ month, nonWorkingDays, onDayClick, sprints }: CalendarMonthProps): ReactElement {
  const monthStart = startOfUtcMonth(month);
  const monthEnd = endOfUtcMonth(month);
  const gridStart = startOfUtcWeek(monthStart);
  const gridEnd = endOfUtcWeek(monthEnd);
  const days = listUtcDaysInRange(gridStart, gridEnd);

  return (
    <section className="space-y-4 rounded-3xl border border-border/80 bg-background/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{formatMonthLabel(month)}</h2>
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">UTC</p>
      </div>
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dateKey = formatUtcDate(day);
          const dayRecords = nonWorkingDays.filter((record) => record.date === dateKey);
          const dayBands = sprints
            .filter((sprint) => {
              const start = parseUtcDate(sprint.plannedStart);
              const end = getEffectiveSprintEnd(sprint);

              return day >= start && day <= end;
            })
            .map((sprint) => {
              const start = parseUtcDate(sprint.plannedStart);
              const plannedEnd = parseUtcDate(sprint.plannedEnd);
              const end = getEffectiveSprintEnd(sprint);

              return {
                id: sprint.id,
                isEnd: day.getTime() === end.getTime(),
                isOverdue: sprint.isOverdue && day.getTime() > plannedEnd.getTime(),
                isStart: day.getTime() === start.getTime(),
                title: sprint.name,
              };
            });

          return (
            <CalendarDayCell
              bands={dayBands}
              dateNumber={String(day.getUTCDate())}
              isCurrentMonth={isSameUtcMonth(day, month)}
              key={dateKey}
              nonWorkingDays={dayRecords}
              onClick={() => onDayClick(day)}
            />
          );
        })}
      </div>
    </section>
  );
}
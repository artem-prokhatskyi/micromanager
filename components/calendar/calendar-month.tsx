import type { ReactElement } from 'react';
import { useMemo } from 'react';

import { CalendarDayCell } from '@/components/calendar/calendar-day-cell';
import {
  endOfUtcMonth,
  formatUtcDate,
  getTodayUtc,
  listUtcDaysInRange,
  parseUtcDate,
  startOfUtcMonth,
} from '@/lib/date';
import type { CalendarNonWorkingDayRecord, CalendarSprintBand } from '@/types';

interface CalendarMonthProps {
  month: Date;
  nonWorkingDays: CalendarNonWorkingDayRecord[];
  onDayClick: (date: Date) => void;
  sprints: CalendarSprintBand[];
  teamId: string;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SPRINT_BAND_COLORS = [
  {
    active: 'bg-sky-500/35 border-sky-500/20',
    overdue: 'border-sky-500/25 bg-gradient-to-r from-sky-500/35 to-destructive/45',
  },
  {
    active: 'bg-emerald-500/35 border-emerald-500/20',
    overdue: 'border-emerald-500/25 bg-gradient-to-r from-emerald-500/35 to-destructive/45',
  },
  {
    active: 'bg-amber-500/35 border-amber-500/20',
    overdue: 'border-amber-500/25 bg-gradient-to-r from-amber-500/35 to-destructive/45',
  },
  {
    active: 'bg-fuchsia-500/35 border-fuchsia-500/20',
    overdue: 'border-fuchsia-500/25 bg-gradient-to-r from-fuchsia-500/35 to-destructive/45',
  },
  {
    active: 'bg-cyan-500/35 border-cyan-500/20',
    overdue: 'border-cyan-500/25 bg-gradient-to-r from-cyan-500/35 to-destructive/45',
  },
  {
    active: 'bg-rose-500/35 border-rose-500/20',
    overdue: 'border-rose-500/25 bg-gradient-to-r from-rose-500/35 to-destructive/45',
  },
] as const;

function getMondayWeekdayIndex(date: Date): number {
  return (date.getUTCDay() + 6) % 7;
}

function getEffectiveSprintStart(sprint: CalendarSprintBand): Date {
  return parseUtcDate(sprint.activatedAt ?? sprint.plannedStart);
}

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

function getSprintBandClassName(paletteIndex: number, isOverdue: boolean): string {
  const palette = SPRINT_BAND_COLORS[paletteIndex];

  return isOverdue ? palette.overdue : palette.active;
}

export function CalendarMonth({ month, nonWorkingDays, onDayClick, sprints, teamId }: CalendarMonthProps): ReactElement {
  const monthStart = startOfUtcMonth(month);
  const monthEnd = endOfUtcMonth(month);
  const days = listUtcDaysInRange(monthStart, monthEnd);
  const todayKey = formatUtcDate(getTodayUtc());
  const leadingEmptyDays = getMondayWeekdayIndex(monthStart);
  const trailingEmptyDays = (7 - ((leadingEmptyDays + days.length) % 7)) % 7;
  const sprintPaletteIndexById = useMemo(
    () => new Map(
      [...sprints]
        .sort((left, right) => {
          const leftStart = getEffectiveSprintStart(left).getTime();
          const rightStart = getEffectiveSprintStart(right).getTime();

          if (leftStart !== rightStart) {
            return leftStart - rightStart;
          }

          return left.name.localeCompare(right.name);
        })
        .map((sprint, index) => [sprint.id, index % SPRINT_BAND_COLORS.length]),
    ),
    [sprints],
  );

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
        {Array.from({ length: leadingEmptyDays }).map((_, index) => (
          <div aria-hidden="true" className="h-[66px] rounded-2xl border border-transparent" key={`leading-empty-${index}`} />
        ))}
        {days.map((day) => {
          const dateKey = formatUtcDate(day);
          const dayRecords = nonWorkingDays.filter((record) => record.date === dateKey);
          const dayBands = sprints
            .filter((sprint) => {
              const start = getEffectiveSprintStart(sprint);
              const end = getEffectiveSprintEnd(sprint);

              return day >= start && day <= end;
            })
            .map((sprint) => {
              const start = getEffectiveSprintStart(sprint);
              const plannedEnd = parseUtcDate(sprint.plannedEnd);
              const end = getEffectiveSprintEnd(sprint);
              const isOverdue = sprint.isOverdue && day.getTime() > plannedEnd.getTime();
              const paletteIndex = sprintPaletteIndexById.get(sprint.id) ?? 0;

              return {
                className: getSprintBandClassName(paletteIndex, isOverdue),
                href: `/teams/${teamId}/sprints/${sprint.id}`,
                id: sprint.id,
                isEnd: day.getTime() === end.getTime(),
                isStart: day.getTime() === start.getTime(),
                title: sprint.name,
              };
            });

          return (
            <CalendarDayCell
              bands={dayBands}
              dateNumber={String(day.getUTCDate())}
              isCurrentMonth={true}
              isToday={dateKey === todayKey}
              key={dateKey}
              nonWorkingDays={dayRecords}
              onClick={() => onDayClick(day)}
            />
          );
        })}
        {Array.from({ length: trailingEmptyDays }).map((_, index) => (
          <div aria-hidden="true" className="h-[66px] rounded-2xl border border-transparent" key={`trailing-empty-${index}`} />
        ))}
      </div>
    </section>
  );
}
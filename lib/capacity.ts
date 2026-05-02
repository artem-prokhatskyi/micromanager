import { getTodayUtc, isUtcDateInRange, listUtcDaysInRange, startOfUtcDay } from '@/lib/date';
import { NON_WORKING_DAY_TYPE, WEEK_DAY } from '@/types';
import type {
  AbsenceSummary,
  NonWorkingDayRecord,
  SprintRecord,
  WeekDay,
} from '@/types';

const WEEKDAY_MAP: Record<WeekDay, number> = {
  [WEEK_DAY.SUN]: 0,
  [WEEK_DAY.MON]: 1,
  [WEEK_DAY.TUE]: 2,
  [WEEK_DAY.WED]: 3,
  [WEEK_DAY.THU]: 4,
  [WEEK_DAY.FRI]: 5,
  [WEEK_DAY.SAT]: 6,
};

export function workingDaysInRange(
  workingDays: WeekDay[],
  nonWorkingDays: NonWorkingDayRecord[],
  start: Date,
  end: Date,
): number {
  const normalizedStart = startOfUtcDay(start);
  const normalizedEnd = startOfUtcDay(end);
  const workingDayNumbers = new Set<number>(workingDays.map((day) => WEEKDAY_MAP[day]));
  const intervalDays = listUtcDaysInRange(normalizedStart, normalizedEnd);

  let count = intervalDays.filter((day) => workingDayNumbers.has(day.getUTCDay())).length;

  for (const nonWorkingDay of nonWorkingDays) {
    const normalizedDate = startOfUtcDay(new Date(nonWorkingDay.date));

    if (!isUtcDateInRange(normalizedDate, normalizedStart, normalizedEnd)) {
      continue;
    }

    if (!workingDayNumbers.has(normalizedDate.getUTCDay())) {
      continue;
    }

    count -= nonWorkingDay.halfDay ? 0.5 : 1;
  }

  return Math.max(0, count);
}

export function actualStartDate(sprint: Pick<SprintRecord, 'plannedStart' | 'activatedAt'>): Date {
  return sprint.activatedAt ? startOfUtcDay(sprint.activatedAt) : startOfUtcDay(sprint.plannedStart);
}

export function actualEndDate(sprint: Pick<SprintRecord, 'plannedEnd' | 'actualEnd'>): Date {
  if (sprint.actualEnd) {
    return sprint.actualEnd;
  }

  const today = getTodayUtc();
  const plannedEnd = startOfUtcDay(sprint.plannedEnd);

  return today > plannedEnd ? today : plannedEnd;
}

export function isSprintOverdue(sprint: Pick<SprintRecord, 'plannedEnd' | 'actualEnd'>): boolean {
  const plannedEnd = startOfUtcDay(sprint.plannedEnd);

  if (sprint.actualEnd) {
    return startOfUtcDay(sprint.actualEnd) > plannedEnd;
  }

  return getTodayUtc() > plannedEnd;
}

export function calculateCapacity(workingDays: number, focusFactor: number): number {
  return Math.round(workingDays * focusFactor * 10) / 10;
}

export function summarizeAbsencesByType(nonWorkingDays: NonWorkingDayRecord[]): AbsenceSummary {
  return nonWorkingDays.reduce<AbsenceSummary>(
    (summary, nonWorkingDay) => {
      const amount = nonWorkingDay.halfDay ? 0.5 : 1;

      if (nonWorkingDay.type === NON_WORKING_DAY_TYPE.HOLIDAY) {
        summary.holiday += amount;
      }

      if (nonWorkingDay.type === NON_WORKING_DAY_TYPE.VACATION) {
        summary.vacation += amount;
      }

      if (nonWorkingDay.type === NON_WORKING_DAY_TYPE.SICKLEAVE) {
        summary.sickleave += amount;
      }

      return summary;
    },
    {
      holiday: 0,
      vacation: 0,
      sickleave: 0,
    },
  );
}
import { eachDayOfInterval, startOfDay } from 'date-fns';

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
  const normalizedStart = startOfDay(start);
  const normalizedEnd = startOfDay(end);
  const workingDayNumbers = new Set<number>(workingDays.map((day) => WEEKDAY_MAP[day]));
  const intervalDays = eachDayOfInterval({ start: normalizedStart, end: normalizedEnd });

  let count = intervalDays.filter((day) => workingDayNumbers.has(day.getDay())).length;

  for (const nonWorkingDay of nonWorkingDays) {
    const normalizedDate = startOfDay(new Date(nonWorkingDay.date));

    if (normalizedDate < normalizedStart || normalizedDate > normalizedEnd) {
      continue;
    }

    if (!workingDayNumbers.has(normalizedDate.getDay())) {
      continue;
    }

    count -= nonWorkingDay.halfDay ? 0.5 : 1;
  }

  return Math.max(0, count);
}

export function actualEndDate(sprint: Pick<SprintRecord, 'plannedEnd' | 'actualEnd'>): Date {
  if (sprint.actualEnd) {
    return sprint.actualEnd;
  }

  const today = startOfDay(new Date());
  const plannedEnd = startOfDay(sprint.plannedEnd);

  return today > plannedEnd ? today : plannedEnd;
}

export function isSprintOverdue(sprint: Pick<SprintRecord, 'plannedEnd' | 'actualEnd'>): boolean {
  const plannedEnd = startOfDay(sprint.plannedEnd);

  if (sprint.actualEnd) {
    return startOfDay(sprint.actualEnd) > plannedEnd;
  }

  return startOfDay(new Date()) > plannedEnd;
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
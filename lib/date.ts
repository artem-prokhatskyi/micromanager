export function parseUtcDate(value: string): Date {
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  return new Date(Date.UTC(year, month - 1, day));
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function formatUtcDate(date: Date): string {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

export function getTodayUtc(): Date {
  return startOfUtcDay(new Date());
}

export function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function endOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

export function addUtcMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

export function startOfUtcWeek(date: Date): Date {
  const normalizedDate = startOfUtcDay(date);
  normalizedDate.setUTCDate(normalizedDate.getUTCDate() - normalizedDate.getUTCDay());

  return normalizedDate;
}

export function endOfUtcWeek(date: Date): Date {
  const normalizedDate = startOfUtcDay(date);
  normalizedDate.setUTCDate(normalizedDate.getUTCDate() + (6 - normalizedDate.getUTCDay()));

  return normalizedDate;
}

export function isSameUtcDay(left: Date, right: Date): boolean {
  return startOfUtcDay(left).getTime() === startOfUtcDay(right).getTime();
}

export function isSameUtcMonth(left: Date, right: Date): boolean {
  return left.getUTCFullYear() === right.getUTCFullYear() && left.getUTCMonth() === right.getUTCMonth();
}

export interface CalendarRange {
  start: Date;
  end: Date;
}

export function getCalendarRange(currentMonth: Date): CalendarRange {
  return {
    start: startOfUtcMonth(addUtcMonths(currentMonth, -1)),
    end: endOfUtcMonth(addUtcMonths(currentMonth, 1)),
  };
}

export function isUtcDateInRange(date: Date, start: Date, end: Date): boolean {
  const normalizedDate = startOfUtcDay(date).getTime();
  const normalizedStart = startOfUtcDay(start).getTime();
  const normalizedEnd = startOfUtcDay(end).getTime();

  return normalizedDate >= normalizedStart && normalizedDate <= normalizedEnd;
}

export function listUtcDaysInRange(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const current = startOfUtcDay(start);
  const normalizedEnd = startOfUtcDay(end).getTime();

  while (current.getTime() <= normalizedEnd) {
    days.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return days;
}

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { WEEK_DAYS } from '@/types';
import type { WeekDay } from '@/types';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function sortWorkingDays(days: WeekDay[]): WeekDay[] {
  return WEEK_DAYS.filter((day) => days.includes(day));
}
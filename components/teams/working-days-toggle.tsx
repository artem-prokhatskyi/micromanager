'use client';

import type { ReactElement } from 'react';

import { WEEK_DAYS } from '@/types';
import type { WeekDay } from '@/types';
import { cn, sortWorkingDays } from '@/lib/utils';

interface WorkingDaysToggleProps {
  value: WeekDay[];
  onChange: (days: WeekDay[]) => void;
  error?: string;
}

export function WorkingDaysToggle({ error, onChange, value }: WorkingDaysToggleProps): ReactElement {
  function toggleDay(day: WeekDay): void {
    if (value.includes(day)) {
      onChange(sortWorkingDays(value.filter((currentDay) => currentDay !== day)));
      return;
    }

    onChange(sortWorkingDays([...value, day]));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {WEEK_DAYS.map((day) => {
          const selected = value.includes(day);

          return (
            <button
              className={cn(
                'inline-flex h-10 min-w-12 items-center justify-center rounded-xl px-3 text-sm font-medium transition-colors',
                selected
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground',
              )}
              key={day}
              onClick={() => toggleDay(day)}
              type="button"
            >
              {day}
            </button>
          );
        })}
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
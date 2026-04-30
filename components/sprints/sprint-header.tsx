import type { ReactElement } from 'react';

import { differenceInCalendarDays, format } from 'date-fns';

import { Badge } from '@/components/ui/badge';

interface SprintHeaderProps {
  name: string;
  plannedStart: string;
  plannedEnd: string;
  actualEnd: string | null;
  isOverdue: boolean;
}

export function SprintHeader({ actualEnd, isOverdue, name, plannedEnd, plannedStart }: SprintHeaderProps): ReactElement {
  const plannedStartDate = new Date(plannedStart);
  const plannedEndDate = new Date(plannedEnd);
  const actualEndDate = actualEnd ? new Date(actualEnd) : null;
  const showActualEnd = actualEndDate !== null && actualEndDate.getTime() !== plannedEndDate.getTime();
  const overdueDays = actualEndDate ? differenceInCalendarDays(actualEndDate, plannedEndDate) : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{name}</h1>
        {isOverdue ? <Badge variant="destructive">Overdue</Badge> : null}
      </div>
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>{format(plannedStartDate, 'MMM d, yyyy')} - {format(plannedEndDate, 'MMM d, yyyy')}</p>
        {showActualEnd ? (
          <p>
            Actual end: {format(actualEndDate, 'MMM d, yyyy')} ({overdueDays > 0 ? `+${overdueDays}` : overdueDays} days)
          </p>
        ) : null}
      </div>
    </div>
  );
}
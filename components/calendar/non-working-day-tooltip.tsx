import type { ReactElement, ReactNode } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CalendarNonWorkingDayRecord } from '@/types';

interface NonWorkingDayTooltipProps {
  children: ReactNode;
  records: CalendarNonWorkingDayRecord[];
}

function formatType(type: CalendarNonWorkingDayRecord['type']): string {
  return type.slice(0, 1).toUpperCase() + type.slice(1);
}

export function NonWorkingDayTooltip({ children, records }: NonWorkingDayTooltipProps): ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger>{children}</TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1">
          {records.map((record) => (
            <p key={record.id} className="leading-5 text-foreground">
              <span className="font-medium">{record.memberName}</span>
              <span className="text-muted-foreground">{' - '}</span>
              <span>{formatType(record.type)}</span>
              {record.halfDay ? <span className="text-muted-foreground"> (half day)</span> : null}
            </p>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
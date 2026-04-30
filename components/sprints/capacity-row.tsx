import type { ReactElement } from 'react';

import { FocusFactorInput } from '@/components/sprints/focus-factor-input';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import type { MemberCapacityData } from '@/types';

interface CapacityRowProps {
  member: MemberCapacityData;
  isOverdue: boolean;
  onCommitFocusFactor: (memberId: string, nextValue: number, previousValue: number) => Promise<void>;
}

function formatSpecialization(specialization: MemberCapacityData['specialization']): string | null {
  if (!specialization) {
    return null;
  }

  if (specialization === 'both') {
    return 'FE + BE';
  }

  return specialization === 'frontend' ? 'FE' : 'BE';
}

function formatAbsenceSummary(member: MemberCapacityData): string | null {
  const parts = [
    member.absenceSummary.holiday > 0 ? `Holiday ${member.absenceSummary.holiday}` : null,
    member.absenceSummary.vacation > 0 ? `Vacation ${member.absenceSummary.vacation}` : null,
    member.absenceSummary.sickleave > 0 ? `Sick ${member.absenceSummary.sickleave}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' | ') : null;
}

export function CapacityRow({ isOverdue, member, onCommitFocusFactor }: CapacityRowProps): ReactElement {
  const specialization = formatSpecialization(member.specialization);
  const absenceSummary = formatAbsenceSummary(member);

  return (
    <TableRow>
      <TableCell>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{member.name}</span>
            {specialization ? <Badge variant="outline">{specialization}</Badge> : null}
          </div>
          {absenceSummary ? <p className="text-xs text-muted-foreground">{absenceSummary}</p> : null}
        </div>
      </TableCell>
      <TableCell className="text-foreground">{member.plannedWorkingDays.toFixed(1)}</TableCell>
      <TableCell>
        <FocusFactorInput
          memberId={member.memberId}
          onCommit={onCommitFocusFactor}
          value={member.focusFactor}
        />
      </TableCell>
      <TableCell className="font-medium text-foreground">{member.plannedCapacity.toFixed(1)}</TableCell>
      {isOverdue ? (
        <>
          <TableCell className="text-foreground">{(member.actualWorkingDays ?? 0).toFixed(1)}</TableCell>
          <TableCell className="font-medium text-foreground">{(member.actualCapacity ?? 0).toFixed(1)}</TableCell>
        </>
      ) : null}
    </TableRow>
  );
}
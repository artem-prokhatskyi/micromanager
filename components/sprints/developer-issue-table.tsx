import type { ReactElement } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { IssueTableRow } from '@/components/sprints/issue-table-row';
import type { DeveloperIssueGroup, MemberCapacityData } from '@/types';

interface DeveloperIssueTableProps {
  group: DeveloperIssueGroup;
  member: MemberCapacityData;
}

function formatAbsenceSummary(member: MemberCapacityData): string {
  return `${member.absenceSummary.holiday} holiday · ${member.absenceSummary.vacation} vacation · ${member.absenceSummary.sickleave} sickleave`;
}

export function DeveloperIssueTable({ group, member }: DeveloperIssueTableProps): ReactElement {
  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>{group.member.name}</CardTitle>
          <p className="text-sm font-medium text-foreground">
            {group.totalStoryPoints} SP / {(member.actualCapacity ?? member.plannedCapacity).toFixed(1)} SP
          </p>
        </div>
        <p className="text-sm text-muted-foreground">{formatAbsenceSummary(member)}</p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Story points</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {group.issues.map((issue) => (
              <IssueTableRow issue={issue} key={issue.key} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
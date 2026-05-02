'use client';

import type { ReactElement } from 'react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { IssueTableRow } from '@/components/sprints/issue-table-row';
import type { DeveloperIssueGroup, MemberCapacityData, ProcessedIssue } from '@/types';

interface DeveloperIssueTableProps {
  group: DeveloperIssueGroup;
  member: MemberCapacityData;
}

function formatAbsenceSummary(member: MemberCapacityData): string {
  return `${member.absenceSummary.holiday} holiday · ${member.absenceSummary.vacation} vacation · ${member.absenceSummary.sickleave} sickleave`;
}

function ChevronIcon({ collapsed }: { collapsed: boolean }): ReactElement {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d={collapsed ? 'm9 6 6 6-6 6' : 'm6 9 6 6 6-6'} />
    </svg>
  );
}

function IssueGroupTable({ issues, title }: { issues: ProcessedIssue[]; title: string }): ReactElement {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{issues.length} tickets</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Story points</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.map((issue) => (
            <IssueTableRow issue={issue} key={issue.key} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function DeveloperIssueTable({ group, member }: DeveloperIssueTableProps): ReactElement {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const plannedIssues = group.issues.filter((issue) => issue.label === 'planned');
  const unplannedIssues = group.issues.filter((issue) => issue.label === 'unplanned');

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              aria-expanded={!collapsed}
              className="h-9 rounded-full px-3"
              onClick={() => setCollapsed((current) => !current)}
              type="button"
              variant="outline"
            >
              <ChevronIcon collapsed={collapsed} />
              {collapsed ? 'Show tickets' : 'Hide tickets'}
            </Button>
            <div>
              <CardTitle>{group.member.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{group.issues.length} tickets</p>
            </div>
          </div>
          <p className="text-sm font-medium text-foreground">
            {group.totalStoryPoints} SP / {(member.actualCapacity ?? member.plannedCapacity).toFixed(1)} SP
          </p>
        </div>
        <p className="text-sm text-muted-foreground">{formatAbsenceSummary(member)}</p>
      </CardHeader>
      {collapsed ? null : (
        <CardContent className="space-y-6">
          {plannedIssues.length > 0 ? <IssueGroupTable issues={plannedIssues} title="Planned issues" /> : null}
          {unplannedIssues.length > 0 ? <IssueGroupTable issues={unplannedIssues} title="Unplanned issues" /> : null}
        </CardContent>
      )}
    </Card>
  );
}
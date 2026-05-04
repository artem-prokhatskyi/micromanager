'use client';

import type { ReactElement } from 'react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { IssueTableRow } from '@/components/sprints/issue-table-row';
import { SPECIALIZATION_SHORT_LABELS } from '@/types';
import type { DeveloperIssueGroup, MemberCapacityData, ProcessedIssue } from '@/types';

interface DeveloperIssueTableProps {
  group: DeveloperIssueGroup;
  member: MemberCapacityData;
  showCapacitySummary?: boolean;
  showStoryPoints?: boolean;
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

function IssueGroupTable({ issues, showStoryPoints = true, title }: { issues: ProcessedIssue[]; showStoryPoints?: boolean; title: string }): ReactElement {
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
            <TableHead>Type</TableHead>
            {showStoryPoints ? <TableHead>SP</TableHead> : null}
            <TableHead>Priority</TableHead>
            <TableHead>Sprint status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.map((issue) => (
            <IssueTableRow issue={issue} key={issue.key} showStoryPoints={showStoryPoints} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function formatSpecializationLabels(values: DeveloperIssueGroup['member']['specialization']): string[] {
  return values.map((value) => SPECIALIZATION_SHORT_LABELS[value]);
}

export function DeveloperIssueTable({ group, member, showCapacitySummary = true, showStoryPoints = true }: DeveloperIssueTableProps): ReactElement {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const externalInProgressIssues = group.externalInProgressIssues;
  const plannedIssues = group.issues.filter((issue) => issue.label === 'planned');
  const unplannedIssues = group.issues.filter((issue) => issue.label === 'unplanned');
  const specializationLabels = formatSpecializationLabels(group.member.specialization);

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
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{group.member.name}</CardTitle>
                {specializationLabels.map((specializationLabel) => (
                  <Badge className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em]" key={specializationLabel} variant="secondary">
                    {specializationLabel}
                  </Badge>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">{group.issues.length} tickets</p>
            </div>
          </div>
          {showCapacitySummary ? (
            <p className="text-sm font-medium text-foreground">
              {group.totalStoryPoints} SP / {(member.actualCapacity ?? member.plannedCapacity).toFixed(1)} SP
            </p>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">{formatAbsenceSummary(member)}</p>
      </CardHeader>
      {collapsed ? null : (
        <CardContent className="space-y-6">
          {plannedIssues.length > 0 ? <IssueGroupTable issues={plannedIssues} showStoryPoints={showStoryPoints} title="Planned issues" /> : null}
          {unplannedIssues.length > 0 ? <IssueGroupTable issues={unplannedIssues} showStoryPoints={showStoryPoints} title="Unplanned issues" /> : null}
          {externalInProgressIssues.length > 0 ? <IssueGroupTable issues={externalInProgressIssues} showStoryPoints={showStoryPoints} title="External in-progress issues" /> : null}
        </CardContent>
      )}
    </Card>
  );
}
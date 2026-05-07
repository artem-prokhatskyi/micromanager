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
  showDevTime?: boolean;
  showTotalDevTime?: boolean;
  showTotalQaTime?: boolean;
  showDevQaRatio?: boolean;
  showStoryPoints?: boolean;
  storyPointsLabel?: string;
  showTestingTime?: boolean;
}

function formatAbsenceSummary(member: MemberCapacityData): string {
  return `${member.absenceSummary.holiday} holiday · ${member.absenceSummary.vacation} vacation · ${member.absenceSummary.sickleave} sickleave`;
}

function formatReviewTime(hours: number | null): string {
  if (hours === null) {
    return '';
  }

  if (hours >= 24) {
    return `Avg review ${(hours / 24).toFixed(1)}d`;
  }

  return `Avg review ${hours.toFixed(1)}h`;
}

function formatAverageComments(value: number | null): string {
  if (value === null) {
    return '';
  }

  return `Avg comments ${value.toFixed(1)}`;
}

function formatGithubMetrics(member: MemberCapacityData): string | null {
  if (!member.githubMetrics) {
    return null;
  }

  return `Github: ${member.githubMetrics.openedPullRequests} opened PR · ${member.githubMetrics.mergedPullRequests} merged PR · ${member.githubMetrics.submittedReviews} reviews · ${member.githubMetrics.approvedPullRequests} approvals · ${formatReviewTime(member.githubMetrics.averageReviewTimeHours)}`;
}

function formatDuration(hours: number | null, prefix: string): string | null {
  if (hours === null) {
    return null;
  }

  if (hours >= 24) {
    return `${prefix} ${(hours / 24).toFixed(1)}d`;
  }

  return `${prefix} ${hours.toFixed(1)}h`;
}

function formatAverageDevQaRatio(value: number | null): string | null {
  if (value === null) {
    return null;
  }

  return `Avg Dev/QA ${value.toFixed(2)}`;
}

function getQaHeaderMetrics(group: DeveloperIssueGroup): { averageDevQaRatio: number | null; sprintQaTimeHours: number | null } {
  const issues = [...group.issues, ...group.externalInProgressIssues];
  const sprintQaTimeHours = issues.reduce<number>((total, issue) => total + (issue.testingTimeHours ?? 0), 0);
  const devQaRatios = issues
    .map((issue) => issue.devQaRatio)
    .filter((value): value is number => value !== null);
  const averageDevQaRatio = devQaRatios.length > 0
    ? devQaRatios.reduce((total, value) => total + value, 0) / devQaRatios.length
    : null;

  return {
    averageDevQaRatio,
    sprintQaTimeHours: sprintQaTimeHours > 0 ? Math.round(sprintQaTimeHours * 10) / 10 : null,
  };
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

function IssueGroupTable({ issues, showDevTime = false, showTotalDevTime = false, showTotalQaTime = false, showDevQaRatio = false, showStoryPoints = true, showTestingTime = false, storyPointsLabel = 'SP', title }: { issues: ProcessedIssue[]; showDevTime?: boolean; showTotalDevTime?: boolean; showTotalQaTime?: boolean; showDevQaRatio?: boolean; showStoryPoints?: boolean; showTestingTime?: boolean; storyPointsLabel?: string; title: string }): ReactElement {
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
            {showStoryPoints ? <TableHead>{storyPointsLabel}</TableHead> : null}
            {showDevTime ? <TableHead>Sprint Dev Time</TableHead> : null}
            {showTestingTime ? <TableHead>Sprint QA time</TableHead> : null}
            {showTotalDevTime ? <TableHead>Total Dev time</TableHead> : null}
            {showTotalQaTime ? <TableHead>Total QA time</TableHead> : null}
            {showDevQaRatio ? <TableHead>Dev/QA</TableHead> : null}
            <TableHead>Priority</TableHead>
            <TableHead>Sprint status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {issues.map((issue) => (
            <IssueTableRow issue={issue} key={issue.key} showDevQaRatio={showDevQaRatio} showDevTime={showDevTime} showStoryPoints={showStoryPoints} showTestingTime={showTestingTime} showTotalDevTime={showTotalDevTime} showTotalQaTime={showTotalQaTime} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function formatSpecializationLabels(values: DeveloperIssueGroup['member']['specialization']): string[] {
  return values.map((value) => SPECIALIZATION_SHORT_LABELS[value]);
}

export function DeveloperIssueTable({ group, member, showCapacitySummary = true, showDevTime = false, showTotalDevTime = false, showTotalQaTime = false, showDevQaRatio = false, showStoryPoints = true, storyPointsLabel = 'SP', showTestingTime = false }: DeveloperIssueTableProps): ReactElement {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const externalInProgressIssues = group.externalInProgressIssues;
  const plannedIssues = group.issues.filter((issue) => issue.label === 'planned');
  const unplannedIssues = group.issues.filter((issue) => issue.label === 'unplanned');
  const specializationLabels = formatSpecializationLabels(group.member.specialization);
  const githubSummary = formatGithubMetrics(member);
  const qaHeaderMetrics = !showCapacitySummary ? getQaHeaderMetrics(group) : null;
  const sprintQaSummary = qaHeaderMetrics ? formatDuration(qaHeaderMetrics.sprintQaTimeHours, 'Sprint QA') : null;
  const averageDevQaSummary = qaHeaderMetrics ? formatAverageDevQaRatio(qaHeaderMetrics.averageDevQaRatio) : null;

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
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <p>{formatAbsenceSummary(member)}</p>
          {sprintQaSummary ? <p>{sprintQaSummary}</p> : null}
          {averageDevQaSummary ? <p>{averageDevQaSummary}</p> : null}
          {githubSummary ? <p>{githubSummary}</p> : null}
        </div>
      </CardHeader>
      {collapsed ? null : (
        <CardContent className="space-y-6">
          {plannedIssues.length > 0 ? <IssueGroupTable issues={plannedIssues} showDevQaRatio={showDevQaRatio} showDevTime={showDevTime} showStoryPoints={showStoryPoints} showTestingTime={showTestingTime} showTotalDevTime={showTotalDevTime} showTotalQaTime={showTotalQaTime} storyPointsLabel={storyPointsLabel} title="Planned issues" /> : null}
          {unplannedIssues.length > 0 ? <IssueGroupTable issues={unplannedIssues} showDevQaRatio={showDevQaRatio} showDevTime={showDevTime} showStoryPoints={showStoryPoints} showTestingTime={showTestingTime} showTotalDevTime={showTotalDevTime} showTotalQaTime={showTotalQaTime} storyPointsLabel={storyPointsLabel} title="Unplanned issues" /> : null}
          {externalInProgressIssues.length > 0 ? <IssueGroupTable issues={externalInProgressIssues} showDevQaRatio={showDevQaRatio} showDevTime={showDevTime} showStoryPoints={showStoryPoints} showTestingTime={showTestingTime} showTotalDevTime={showTotalDevTime} showTotalQaTime={showTotalQaTime} storyPointsLabel={storyPointsLabel} title="External in-progress issues" /> : null}
        </CardContent>
      )}
    </Card>
  );
}
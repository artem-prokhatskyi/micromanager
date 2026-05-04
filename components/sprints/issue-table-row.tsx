import type { ReactElement } from 'react';

import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import type { ProcessedIssue } from '@/types';

interface IssueTableRowProps {
  issue: ProcessedIssue;
  showStoryPoints?: boolean;
}

function getStatusBadgeClassName(status: string): string {
  const normalizedStatus = status.trim().toLowerCase();

  if (normalizedStatus.includes('not created')) {
    return 'border-slate-400/40 bg-slate-500/15 text-slate-200 ring-1 ring-inset ring-slate-500/35';
  }

  if (
    normalizedStatus.includes('block')
    || normalizedStatus.includes('stuck')
    || normalizedStatus.includes('impediment')
    || normalizedStatus.includes('waiting')
  ) {
    return 'border-red-400/40 bg-red-500/15 text-red-200 ring-1 ring-inset ring-red-500/35';
  }

  if (normalizedStatus.includes('done') || normalizedStatus.includes('closed') || normalizedStatus.includes('resolved')) {
    return 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200 ring-1 ring-inset ring-emerald-500/35';
  }

  if (
    normalizedStatus.includes('review')
    || normalizedStatus.includes('qa')
    || normalizedStatus.includes('test')
    || normalizedStatus.includes('verify')
    || normalizedStatus.includes('acceptance')
  ) {
    return 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200 ring-1 ring-inset ring-cyan-500/35';
  }

  if (
    normalizedStatus.includes('progress')
    || normalizedStatus.includes('develop')
    || normalizedStatus.includes('implement')
    || normalizedStatus.includes('coding')
    || normalizedStatus.includes('working')
  ) {
    return 'border-amber-400/40 bg-amber-500/15 text-amber-200 ring-1 ring-inset ring-amber-500/35';
  }

  if (
    normalizedStatus.includes('todo')
    || normalizedStatus.includes('to do')
    || normalizedStatus.includes('open')
    || normalizedStatus.includes('backlog')
    || normalizedStatus.includes('selected')
    || normalizedStatus.includes('groom')
    || normalizedStatus.includes('refine')
  ) {
    return 'border-slate-400/40 bg-slate-500/15 text-slate-200 ring-1 ring-inset ring-slate-500/35';
  }

  if (
    normalizedStatus.includes('ready')
    || normalizedStatus.includes('next')
    || normalizedStatus.includes('queued')
  ) {
    return 'border-indigo-400/40 bg-indigo-500/15 text-indigo-200 ring-1 ring-inset ring-indigo-500/35';
  }

  return 'border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-200 ring-1 ring-inset ring-fuchsia-500/35';
}

function getPriorityBadgeClassName(priority: NonNullable<ProcessedIssue['priority']>): string {
  switch (priority) {
    case 'David Jackson':
      return 'animate-pulse border-red-500/60 bg-red-500/20 text-red-100 ring-1 ring-inset ring-red-500/45';
    case 'Critical':
      return 'border-red-400/40 bg-red-500/15 text-red-200 ring-1 ring-inset ring-red-500/35';
    case 'High':
      return 'border-orange-400/40 bg-orange-500/15 text-orange-200 ring-1 ring-inset ring-orange-500/35';
    case 'Medium':
      return 'border-amber-400/40 bg-amber-500/15 text-amber-200 ring-1 ring-inset ring-amber-500/35';
    case 'Low':
      return 'border-sky-400/40 bg-sky-500/15 text-sky-200 ring-1 ring-inset ring-sky-500/35';
    case 'Lowest':
      return 'border-slate-400/40 bg-slate-500/15 text-slate-200 ring-1 ring-inset ring-slate-500/35';
    default:
      return 'border-border bg-transparent text-foreground';
  }
}

export function IssueTableRow({ issue, showStoryPoints = true }: IssueTableRowProps): ReactElement {
  const badgeClassName = issue.label === 'planned'
    ? undefined
    : issue.label === 'unplanned'
      ? 'bg-amber-500/15 text-amber-200 ring-1 ring-inset ring-amber-500/40'
      : undefined;
  const statusAtSprintStartBadgeClassName = getStatusBadgeClassName(issue.statusAtSprintStart);
  const statusAtSprintEndBadgeClassName = getStatusBadgeClassName(issue.statusAtSprintEnd);
  const priorityBadgeClassName = issue.priority ? getPriorityBadgeClassName(issue.priority) : null;

  return (
    <TableRow>
      <TableCell className="font-medium text-foreground text-nowrap">
        <a href={issue.url} rel="noopener noreferrer" target="_blank">
          {issue.key}
        </a>
      </TableCell>
      <TableCell width={600}>
        <div className="flex flex-wrap items-center gap-2">
          <a className="font-medium text-foreground" href={issue.url} rel="noopener noreferrer" target="_blank">
            {issue.title}
          </a>
          {issue.label === 'external' ? null : (
            <Badge className={badgeClassName} variant={issue.label === 'planned' ? 'secondary' : 'outline'}>{issue.label}</Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-foreground">{issue.issueType ?? '—'}</TableCell>
      {showStoryPoints ? <TableCell className="text-foreground">{issue.storyPoints ?? '—'}</TableCell> : null}
      <TableCell>
        {issue.priority ? (
          <Badge className={priorityBadgeClassName ?? undefined} variant="outline">{issue.priority}</Badge>
        ) : '—'}
      </TableCell>
      <TableCell>
        <div className="flex min-w-[180px] flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Begin</span>
            <Badge className={statusAtSprintStartBadgeClassName} variant="outline">{issue.statusAtSprintStart}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">End</span>
            <Badge className={statusAtSprintEndBadgeClassName} variant="outline">{issue.statusAtSprintEnd}</Badge>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}
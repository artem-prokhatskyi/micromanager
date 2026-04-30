import type { ReactElement } from 'react';

import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import type { ProcessedIssue } from '@/types';

interface IssueTableRowProps {
  issue: ProcessedIssue;
}

function getStatusBadgeClassName(status: string): string {
  const normalizedStatus = status.trim().toLowerCase();

  if (normalizedStatus.includes('done') || normalizedStatus.includes('closed') || normalizedStatus.includes('resolved')) {
    return 'bg-emerald-500/15 text-emerald-200 ring-1 ring-inset ring-emerald-500/40';
  }

  if (normalizedStatus.includes('review') || normalizedStatus.includes('qa') || normalizedStatus.includes('test')) {
    return 'bg-sky-500/15 text-sky-200 ring-1 ring-inset ring-sky-500/40';
  }

  if (normalizedStatus.includes('progress') || normalizedStatus.includes('develop') || normalizedStatus.includes('implement')) {
    return 'bg-amber-500/15 text-amber-200 ring-1 ring-inset ring-amber-500/40';
  }

  if (normalizedStatus.includes('todo') || normalizedStatus.includes('open') || normalizedStatus.includes('backlog') || normalizedStatus.includes('selected')) {
    return 'bg-slate-500/15 text-slate-200 ring-1 ring-inset ring-slate-500/40';
  }

  if (normalizedStatus.includes('block')) {
    return 'bg-red-500/15 text-red-200 ring-1 ring-inset ring-red-500/40';
  }

  return 'bg-violet-500/15 text-violet-200 ring-1 ring-inset ring-violet-500/40';
}

export function IssueTableRow({ issue }: IssueTableRowProps): ReactElement {
  const badgeClassName = issue.label === 'planned'
    ? undefined
    : 'bg-amber-500/15 text-amber-200 ring-1 ring-inset ring-amber-500/40';
  const statusBadgeClassName = getStatusBadgeClassName(issue.status);

  return (
    <TableRow>
      <TableCell className="font-medium text-foreground">
        <a href={issue.url} rel="noopener noreferrer" target="_blank">
          {issue.key}
        </a>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-2">
          <a className="font-medium text-foreground" href={issue.url} rel="noopener noreferrer" target="_blank">
            {issue.title}
          </a>
          <Badge className={badgeClassName} variant={issue.label === 'planned' ? 'secondary' : 'outline'}>{issue.label}</Badge>
        </div>
      </TableCell>
      <TableCell className="text-foreground">{issue.storyPoints ?? '—'}</TableCell>
      <TableCell>
        <Badge className={statusBadgeClassName} variant="outline">{issue.status}</Badge>
      </TableCell>
    </TableRow>
  );
}
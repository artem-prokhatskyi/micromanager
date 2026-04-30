import type { ReactElement } from 'react';

import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import type { ProcessedIssue } from '@/types';

interface IssueTableRowProps {
  issue: ProcessedIssue;
}

export function IssueTableRow({ issue }: IssueTableRowProps): ReactElement {
  const badgeClassName = issue.label === 'planned'
    ? undefined
    : 'bg-amber-500/15 text-amber-200 ring-1 ring-inset ring-amber-500/40';

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
      <TableCell className="text-foreground">{issue.status}</TableCell>
    </TableRow>
  );
}
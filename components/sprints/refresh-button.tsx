import type { ReactElement } from 'react';

import { Button } from '@/components/ui/button';

interface RefreshButtonProps {
  isRefreshing: boolean;
  lastRefreshedAt: string | null;
  onRefresh: () => void;
}

function formatLastRefreshedAt(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(date);
}

export function RefreshButton({ isRefreshing, lastRefreshedAt, onRefresh }: RefreshButtonProps): ReactElement {
  const formattedLastRefreshedAt = formatLastRefreshedAt(lastRefreshedAt);

  return (
    <Button disabled={isRefreshing} onClick={onRefresh} type="button" variant="outline">
      {formattedLastRefreshedAt ? <span className="text-xs text-muted-foreground">{formattedLastRefreshedAt}</span> : null}
      {isRefreshing ? 'Refreshing...' : 'Refresh issues'}
    </Button>
  );
}
import type { ReactElement } from 'react';

import { Button } from '@/components/ui/button';

interface JiraErrorBannerProps {
  cachedAt?: string | null;
  message?: string;
  onRetry: () => void;
  type: 'stale' | 'error';
}

function formatCachedAt(cachedAt: string | null | undefined): string {
  if (!cachedAt) {
    return 'an earlier time';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(cachedAt));
}

export function JiraErrorBanner({ cachedAt, message, onRetry, type }: JiraErrorBannerProps): ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
      <p>
        {type === 'stale'
          ? `Showing cached data from ${formatCachedAt(cachedAt)}.`
          : `Could not load issues from Jira.${message ? ` ${message}` : ''}`}
      </p>
      <Button onClick={onRetry} type="button" variant="outline">
        Retry
      </Button>
    </div>
  );
}
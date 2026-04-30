import type { ReactElement } from 'react';

import { Button } from '@/components/ui/button';

interface RefreshButtonProps {
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function RefreshButton({ isRefreshing, onRefresh }: RefreshButtonProps): ReactElement {
  return (
    <Button disabled={isRefreshing} onClick={onRefresh} type="button" variant="outline">
      {isRefreshing ? 'Refreshing...' : 'Refresh issues'}
    </Button>
  );
}
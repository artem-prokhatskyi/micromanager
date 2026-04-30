import type { ReactElement } from 'react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function SprintDashboardLoading(): ReactElement {
  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex justify-between gap-4">
          <Skeleton className="h-10 w-64" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-5 w-72" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </CardContent>
    </Card>
  );
}
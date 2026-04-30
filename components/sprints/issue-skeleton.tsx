import type { ReactElement } from 'react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function IssueSkeleton(): ReactElement {
  return (
    <div className="space-y-4">
      {Array.from({ length: 2 }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="gap-3">
            <Skeleton className="h-7 w-52" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
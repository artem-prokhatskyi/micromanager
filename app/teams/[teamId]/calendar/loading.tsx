import type { ReactElement } from 'react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading(): ReactElement {
  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-5 w-full max-w-2xl" />
      </div>
      <Card>
        <CardHeader className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-10 w-10" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-[20rem] w-full" />
            <Skeleton className="h-[20rem] w-full" />
            <Skeleton className="h-[20rem] w-full" />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
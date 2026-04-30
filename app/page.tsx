import type { ReactElement } from 'react';

import { redirect } from 'next/navigation';

import { EmptyState } from '@/components/shared/empty-state';
import { getFirstTeam } from '@/lib/data/team';

export const dynamic = 'force-dynamic';

export default async function HomePage(): Promise<ReactElement> {
  const firstTeam = await getFirstTeam();

  if (firstTeam) {
    redirect(`/teams/${firstTeam.id}/sprints`);
  }

  return (
    <EmptyState
      eyebrow="First Run"
      title="Welcome to Team Sprint Monitor"
      description="Configure your Jira connection to unlock team creation, sprint navigation, and the shared planning shell."
      actionLabel="Go to Settings"
      actionHref="/settings"
    />
  );
}
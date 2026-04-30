import type { ReactElement } from 'react';

import { redirect } from 'next/navigation';

import { EmptyState } from '@/components/shared/empty-state';
import { getLatestSprint } from '@/lib/data/sprint';
import { getTeamDetail } from '@/lib/data/team';

interface TeamSprintsPageProps {
  params: Promise<{
    teamId: string;
  }>;
}

export default async function TeamSprintsPage({ params }: TeamSprintsPageProps): Promise<ReactElement> {
  const { teamId } = await params;
  const [latestSprint, team] = await Promise.all([
    getLatestSprint(teamId),
    getTeamDetail(teamId),
  ]);

  if (latestSprint) {
    redirect(`/teams/${teamId}/sprints/${latestSprint.id}`);
  }

  return (
    <EmptyState
      actionHref={`/teams/${teamId}/sprints/new`}
      actionLabel="Add sprint"
      description="Add your first sprint to start tracking capacity."
      eyebrow={team?.name}
      title="No sprints yet"
    />
  );
}
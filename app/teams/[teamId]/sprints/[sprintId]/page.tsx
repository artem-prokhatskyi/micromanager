import type { ReactElement } from 'react';

import { redirect } from 'next/navigation';

import { SprintCapacityTable } from '@/components/sprints/sprint-capacity-table';
import { SprintIssueSection } from '@/components/sprints/sprint-issue-section';
import { getLatestSprint, getSprintDashboardData } from '@/lib/data/sprint';

interface SprintDashboardPageProps {
  params: Promise<{
    teamId: string;
    sprintId: string;
  }>;
}

export default async function SprintDashboardPage({ params }: SprintDashboardPageProps): Promise<ReactElement> {
  const { sprintId, teamId } = await params;
  const dashboardData = await getSprintDashboardData(teamId, sprintId);

  if (!dashboardData) {
    const latestSprint = await getLatestSprint(teamId);

    if (latestSprint) {
      redirect(`/teams/${teamId}/sprints/${latestSprint.id}`);
    }

    redirect(`/teams/${teamId}/sprints`);
  }

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">{dashboardData.team.name}</p>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Review planned and actual capacity for the sprint, then tune per-member focus factors without affecting their defaults.
        </p>
      </div>
      <SprintCapacityTable
        members={dashboardData.members}
        sprint={{
          id: dashboardData.sprint.id,
          name: dashboardData.sprint.name,
          plannedStart: dashboardData.sprint.plannedStart.toISOString(),
          plannedEnd: dashboardData.sprint.plannedEnd.toISOString(),
          actualEnd: dashboardData.sprint.actualEnd?.toISOString() ?? null,
          isOverdue: dashboardData.sprint.isOverdue,
        }}
        sprints={dashboardData.sprints}
        teamId={teamId}
      />
      <SprintIssueSection members={dashboardData.members} sprintId={dashboardData.sprint.id} teamId={teamId} />
    </section>
  );
}
import type { ReactElement } from 'react';

import { redirect } from 'next/navigation';

import { AddSprintForm } from '@/components/sprints/add-sprint-form';
import { getFirstTeam, getTeamById, getTeamOptions } from '@/lib/data/team';

interface NewSprintPageProps {
  params: Promise<{
    teamId: string;
  }>;
}

export default async function NewSprintPage({ params }: NewSprintPageProps): Promise<ReactElement> {
  const { teamId } = await params;
  const team = await getTeamById(teamId);

  if (!team) {
    const firstTeam = await getFirstTeam();

    if (firstTeam) {
      redirect(`/teams/${firstTeam.id}/sprints/new`);
    }

    redirect('/teams/new');
  }

  const teams = await getTeamOptions();

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">RFC-005</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Add Sprint</h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Find the sprint in Jira, attach it to the team, and use its dates as the source of truth for capacity planning.
        </p>
      </div>
      <AddSprintForm teamId={teamId} teams={teams} />
    </section>
  );
}
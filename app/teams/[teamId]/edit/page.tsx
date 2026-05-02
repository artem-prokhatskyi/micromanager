import type { ReactElement } from 'react';

import { redirect } from 'next/navigation';

import { CreateTeamForm } from '@/components/teams/create-team-form';
import { getFirstTeam, getTeamDetail } from '@/lib/data/team';

interface EditTeamPageProps {
  params: Promise<{
    teamId: string;
  }>;
}

export default async function EditTeamPage({ params }: EditTeamPageProps): Promise<ReactElement> {
  const { teamId } = await params;
  const team = await getTeamDetail(teamId);

  if (!team) {
    const firstTeam = await getFirstTeam();

    if (firstTeam) {
      redirect(`/teams/${firstTeam.id}/edit`);
    }

    redirect('/teams/new');
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">{team.name}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Edit Team</h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Update the Jira project key and repository mapping used by sprint imports, issue grouping, and capacity planning.
        </p>
      </div>
      <CreateTeamForm initialValues={team} mode="edit" />
    </section>
  );
}
import type { ReactElement } from 'react';

import { redirect } from 'next/navigation';

import { TeamMemberForm } from '@/components/teams/team-member-form';
import { getFirstTeam, getTeamById, getTeamOptions } from '@/lib/data/team';

interface NewTeamMemberPageProps {
  params: Promise<{
    teamId: string;
  }>;
}

export default async function NewTeamMemberPage({ params }: NewTeamMemberPageProps): Promise<ReactElement> {
  const { teamId } = await params;
  const team = await getTeamById(teamId);

  if (!team) {
    const firstTeam = await getFirstTeam();

    if (firstTeam) {
      redirect(`/teams/${firstTeam.id}/members/new`);
    }

    redirect('/teams/new');
  }

  const teams = await getTeamOptions();

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">RFC-004</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Add Team Member</h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Capture each developer&apos;s Jira identity, working week, and focus factor so the team can be used by future sprint capacity and issue views.
        </p>
      </div>
      <TeamMemberForm mode="create" teamId={teamId} teams={teams} />
    </section>
  );
}
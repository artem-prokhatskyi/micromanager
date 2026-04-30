import type { ReactElement } from 'react';

import { redirect } from 'next/navigation';

import { TeamMemberForm } from '@/components/teams/team-member-form';
import { getFirstTeam, getTeamById, getTeamMember, getTeamOptions } from '@/lib/data/team';

interface EditTeamMemberPageProps {
  params: Promise<{
    teamId: string;
    memberId: string;
  }>;
}

export default async function EditTeamMemberPage({ params }: EditTeamMemberPageProps): Promise<ReactElement> {
  const { memberId, teamId } = await params;
  const team = await getTeamById(teamId);

  if (!team) {
    const firstTeam = await getFirstTeam();

    if (firstTeam) {
      redirect(`/teams/${firstTeam.id}/members`);
    }

    redirect('/teams/new');
  }

  const member = await getTeamMember(teamId, memberId);

  if (!member) {
    redirect(`/teams/${teamId}/members`);
  }

  const teams = await getTeamOptions();

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">RFC-004</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Edit Team Member</h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Update the member configuration used by capacity calculations and Jira assignee matching.
        </p>
      </div>
      <TeamMemberForm initialValues={member} mode="edit" teamId={teamId} teams={teams} />
    </section>
  );
}
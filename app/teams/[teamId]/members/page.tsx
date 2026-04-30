import type { ReactElement } from 'react';

import { redirect } from 'next/navigation';

import { EmptyState } from '@/components/shared/empty-state';
import { TeamMemberList } from '@/components/teams/team-member-list';
import { getFirstTeam, getTeamDetail, getTeamMembers } from '@/lib/data/team';

interface TeamMembersPageProps {
  params: Promise<{
    teamId: string;
  }>;
}

export default async function TeamMembersPage({ params }: TeamMembersPageProps): Promise<ReactElement> {
  const { teamId } = await params;
  const team = await getTeamDetail(teamId);

  if (!team) {
    const firstTeam = await getFirstTeam();

    if (firstTeam) {
      redirect(`/teams/${firstTeam.id}/members`);
    }

    redirect('/teams/new');
  }

  const members = await getTeamMembers(teamId);

  if (members.length === 0) {
    return (
      <EmptyState
        actionHref={`/teams/${teamId}/members/new`}
        actionLabel="Add first member"
        description="Add team members to start tracking sprint capacity."
        eyebrow={team.name}
        title="No team members yet"
      />
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">{team.name}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Team Members</h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Review and maintain the people whose schedules and Jira accounts drive future sprint calculations.
        </p>
      </div>
      <TeamMemberList members={members} />
    </section>
  );
}
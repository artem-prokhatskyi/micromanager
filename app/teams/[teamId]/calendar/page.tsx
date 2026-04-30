import type { ReactElement } from 'react';

import { redirect } from 'next/navigation';

import { TeamCalendar } from '@/components/calendar/team-calendar';
import { EmptyState } from '@/components/shared/empty-state';
import { getCalendarRange, getTodayUtc } from '@/lib/date';
import { getTeamCalendarData } from '@/lib/data/calendar';
import { getFirstTeam, getTeamDetail } from '@/lib/data/team';

interface TeamCalendarPageProps {
  params: Promise<{
    teamId: string;
  }>;
}

export default async function TeamCalendarPage({ params }: TeamCalendarPageProps): Promise<ReactElement> {
  const { teamId } = await params;
  const team = await getTeamDetail(teamId);

  if (!team) {
    const firstTeam = await getFirstTeam();

    if (firstTeam) {
      redirect(`/teams/${firstTeam.id}/calendar`);
    }

    redirect('/teams/new');
  }

  const currentMonth = getTodayUtc();
  const data = await getTeamCalendarData(teamId, getCalendarRange(currentMonth));

  if (!data) {
    redirect('/');
  }

  if (data.members.length === 0) {
    return (
      <EmptyState
        actionHref={`/teams/${teamId}/members/new`}
        actionLabel="Add first member"
        description="Add team members before tracking vacations, sick leave, or holidays on the calendar."
        eyebrow={data.team.name}
        title="No team members yet"
      />
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Team Calendar</h1>
      </div>
      <TeamCalendar initialData={data} initialMonth={currentMonth.toISOString()} teamId={teamId} />
    </section>
  );
}
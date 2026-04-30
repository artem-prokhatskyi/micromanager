import type { ReactElement, ReactNode } from 'react';

import { redirect } from 'next/navigation';

import { TeamDashboardActions } from '@/components/layout/team-dashboard-actions';
import { getTeamById } from '@/lib/data/team';

export const dynamic = 'force-dynamic';

interface TeamLayoutProps {
  children: ReactNode;
  params: Promise<{
    teamId: string;
  }>;
}

export default async function TeamLayout({ children, params }: TeamLayoutProps): Promise<ReactElement> {
  const { teamId } = await params;
  const team = await getTeamById(teamId);

  if (!team) {
    redirect('/');
  }

  return (
    <>
      <TeamDashboardActions teamId={teamId} />
      {children}
    </>
  );
}
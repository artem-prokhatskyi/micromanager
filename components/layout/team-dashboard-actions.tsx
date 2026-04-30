import type { ReactElement } from 'react';

import { ButtonLink } from '@/components/ui/button';

interface TeamDashboardActionsProps {
  teamId: string;
}

export function TeamDashboardActions({ teamId }: TeamDashboardActionsProps): ReactElement {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-3xl border border-border/80 bg-card/60 p-4 shadow-2xl shadow-black/10 backdrop-blur">
      <ButtonLink href={`/teams/${teamId}/members`} variant="outline">
        Manage the team
      </ButtonLink>
      <ButtonLink href={`/teams/${teamId}/sprints/new`} variant="outline">
        Add sprint
      </ButtonLink>
      <ButtonLink href={`/teams/${teamId}/calendar`} variant="outline">
        Calendar
      </ButtonLink>
    </div>
  );
}
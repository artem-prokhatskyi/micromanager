import type { ReactElement } from 'react';

import { CreateTeamForm } from '@/components/teams/create-team-form';

export default function NewTeamPage(): ReactElement {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Create Team</h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Register the team name and Jira space that future sprint imports and member-level capacity calculations will use.
        </p>
      </div>
      <CreateTeamForm />
    </section>
  );
}
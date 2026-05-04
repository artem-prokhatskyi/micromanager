import type { ReactElement } from 'react';

import { ChangePasswordCard } from '@/components/auth/change-password-card';
import { SettingsForm } from '@/components/settings/settings-form';
import { requireAuthenticatedUser } from '@/lib/auth';
import { getSettingsPageData } from '@/lib/data/settings';

export default async function SettingsPage(): Promise<ReactElement> {
  const currentUser = await requireAuthenticatedUser();
  const initialValues = currentUser.role === 'admin' ? await getSettingsPageData() : null;

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Manage your account password and, if you are an admin, the global Jira connection used by sprint imports and issue synchronization.
        </p>
      </div>
      {initialValues ? <SettingsForm initialValues={initialValues} /> : null}
      <ChangePasswordCard />
    </section>
  );
}
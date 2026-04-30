import type { ReactElement } from 'react';

import { SettingsForm } from '@/components/settings/settings-form';
import { getSettingsPageData } from '@/lib/data/settings';

export default async function SettingsPage(): Promise<ReactElement> {
  const initialValues = await getSettingsPageData();

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Configure the global Jira connection used by sprint imports and issue synchronization. Credentials are stored on the server and validated on every save.
        </p>
      </div>
      <SettingsForm initialValues={initialValues} />
    </section>
  );
}
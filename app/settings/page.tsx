import type { ReactElement } from 'react';

import { PagePlaceholder } from '@/components/shared/page-placeholder';

export default function SettingsPage(): ReactElement {
  return (
    <PagePlaceholder
      badge="RFC-003"
      description="Global settings will live here next, including the Jira connection form and encrypted credential storage. RFC-002 wires the route into the shell so first-run onboarding already has a real destination."
      title="Settings"
    />
  );
}
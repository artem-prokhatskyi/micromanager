import type { ReactElement } from 'react';

import { PagePlaceholder } from '@/components/shared/page-placeholder';

export default function NewSprintPage(): ReactElement {
  return (
    <PagePlaceholder
      badge="RFC-005"
      description="Sprint import and metadata lookup from Jira will be implemented here. The route exists now so the shell can navigate to a consistent sprint creation entry point."
      title="Add Sprint"
    />
  );
}
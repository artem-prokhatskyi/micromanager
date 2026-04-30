import type { ReactElement } from 'react';

import { PagePlaceholder } from '@/components/shared/page-placeholder';

export default function TeamSprintsPage(): ReactElement {
  return (
    <PagePlaceholder
      badge="RFC-005"
      description="Sprint selection and dashboard content will be implemented here. RFC-002 establishes this route as the team landing page for the sidebar and root redirect flow."
      title="Team Sprints"
    />
  );
}
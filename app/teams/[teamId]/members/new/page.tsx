import type { ReactElement } from 'react';

import { PagePlaceholder } from '@/components/shared/page-placeholder';

export default function NewTeamMemberPage(): ReactElement {
  return (
    <PagePlaceholder
      badge="RFC-004"
      description="This route is reserved for team member creation. RFC-002 brings it into the shell so sidebar actions have a stable, team-scoped target."
      title="Add Team Member"
    />
  );
}
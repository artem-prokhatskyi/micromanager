import type { ReactElement } from 'react';

import { PagePlaceholder } from '@/components/shared/page-placeholder';

export default function NewTeamPage(): ReactElement {
  return (
    <PagePlaceholder
      badge="RFC-004"
      description="Team creation will be implemented here. For now, this route exists so the shell and sidebar can navigate to a stable location without broken links."
      title="Create Team"
    />
  );
}
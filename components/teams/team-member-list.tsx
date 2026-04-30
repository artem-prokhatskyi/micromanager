import type { ReactElement } from 'react';

import { TeamMemberCard } from '@/components/teams/team-member-card';
import type { TeamMemberRecord } from '@/types';

interface TeamMemberListProps {
  members: TeamMemberRecord[];
}

export function TeamMemberList({ members }: TeamMemberListProps): ReactElement {
  return (
    <div className="grid gap-4">
      {members.map((member) => (
        <TeamMemberCard key={member.id} member={member} />
      ))}
    </div>
  );
}
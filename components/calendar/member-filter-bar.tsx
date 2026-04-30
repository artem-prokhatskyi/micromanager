'use client';

import type { ReactElement } from 'react';

import { Button } from '@/components/ui/button';

interface MemberFilterBarProps {
  members: Array<{ id: string; name: string }>;
  onToggle: (memberId: string) => void;
  selectedIds: string[];
}

export function MemberFilterBar({ members, onToggle, selectedIds }: MemberFilterBarProps): ReactElement {
  return (
    <div className="flex flex-wrap gap-2">
      {members.map((member) => {
        const isSelected = selectedIds.includes(member.id);

        return (
          <Button
            className="rounded-full"
            key={member.id}
            onClick={() => onToggle(member.id)}
            type="button"
            variant={isSelected ? 'default' : 'outline'}
          >
            {member.name}
          </Button>
        );
      })}
    </div>
  );
}
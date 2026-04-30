'use client';

import type { ReactElement } from 'react';

import { useRouter } from 'next/navigation';

import { Select } from '@/components/ui/select';
import type { SprintOption } from '@/types';

interface SprintSelectorProps {
  currentSprintId: string;
  sprints: SprintOption[];
  teamId: string;
}

export function SprintSelector({ currentSprintId, sprints, teamId }: SprintSelectorProps): ReactElement {
  const router = useRouter();

  return (
    <Select
      aria-label="Select sprint"
      className="min-w-64"
      onChange={(event) => {
        router.push(`/teams/${teamId}/sprints/${event.target.value}`);
      }}
      value={currentSprintId}
    >
      {sprints.map((sprint) => (
        <option key={sprint.id} value={sprint.id}>
          {sprint.name}
        </option>
      ))}
    </Select>
  );
}
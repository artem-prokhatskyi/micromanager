'use client';

import type { ReactElement } from 'react';

import Link from 'next/link';

import type { ShellTeam } from '@/lib/data/team';
import { cn } from '@/lib/utils';

interface SidebarTeamListProps {
  activeTeamId: string | null;
  collapsed: boolean;
  teams: ShellTeam[];
}

function TeamBadge({ name }: { name: string }): ReactElement {
  const initial = name.slice(0, 1).toUpperCase() || '?';

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background/80 text-xs font-semibold uppercase tracking-[0.18em] text-foreground/90">
      {initial}
    </span>
  );
}

export function SidebarTeamList({ activeTeamId, collapsed, teams }: SidebarTeamListProps): ReactElement {
  if (teams.length === 0) {
    return (
      <div className={cn('rounded-2xl border border-dashed border-border/80 bg-background/60 p-3 text-muted-foreground', collapsed ? 'text-center text-xs' : 'text-sm')}>
        {collapsed ? '0' : 'No teams yet'}
      </div>
    );
  }

  return (
    <nav aria-label="Teams" className="space-y-2">
      {teams.map((team) => {
        const isActive = activeTeamId === team.id;

        return (
          <Link
            className={cn(
              'group flex items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 transition-colors duration-200',
              isActive
                ? 'border-border/80 bg-accent text-accent-foreground shadow-lg shadow-black/10'
                : 'text-muted-foreground hover:border-border/60 hover:bg-card/70 hover:text-foreground',
              collapsed ? 'justify-center px-2' : 'justify-start',
            )}
            href={`/teams/${team.id}/sprints`}
            key={team.id}
            title={team.name}
          >
            <TeamBadge name={team.name} />
            {collapsed ? null : (
              <span className="truncate text-sm font-medium tracking-tight">{team.name}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
'use client';

import type { ReactElement } from 'react';

import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import type { ShellTeam } from '@/lib/data/team';
import { cn } from '@/lib/utils';

interface SidebarTeamListProps {
  activeTeamId: string | null;
  collapsed: boolean;
  teams: ShellTeam[];
}

function SettingsIcon(): ReactElement {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path
        d="M10.325 4.317C10.751 2.561 13.249 2.561 13.675 4.317C13.95 5.451 15.239 5.988 16.245 5.428C17.805 4.559 19.571 6.325 18.702 7.885C18.142 8.891 18.679 10.18 19.813 10.455C21.569 10.881 21.569 13.379 19.813 13.805C18.679 14.08 18.142 15.369 18.702 16.375C19.571 17.935 17.805 19.701 16.245 18.832C15.239 18.272 13.95 18.809 13.675 19.943C13.249 21.699 10.751 21.699 10.325 19.943C10.05 18.809 8.761 18.272 7.755 18.832C6.195 19.701 4.429 17.935 5.298 16.375C5.858 15.369 5.321 14.08 4.187 13.805C2.431 13.379 2.431 10.881 4.187 10.455C5.321 10.18 5.858 8.891 5.298 7.885C4.429 6.325 6.195 4.559 7.755 5.428C8.761 5.988 10.05 5.451 10.325 4.317Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 15.5C13.933 15.5 15.5 13.933 15.5 12C15.5 10.067 13.933 8.5 12 8.5C10.067 8.5 8.5 10.067 8.5 12C8.5 13.933 10.067 15.5 12 15.5Z" />
    </svg>
  );
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
          <div className={cn('flex items-center gap-2', collapsed && 'flex-col')} key={team.id}>
            <div
              className={cn(
                'group flex min-w-0 items-center gap-3 justify-between rounded-2xl border border-transparent px-3  transition-colors duration-200',
                isActive
                  ? 'border-border/80 bg-accent text-accent-foreground shadow-lg shadow-black/10'
                  : 'text-muted-foreground hover:border-border/60 hover:bg-card/70 hover:text-foreground',
                collapsed ? 'px-2' : 'flex-1',
              )}
            >
            <Link  
              className={cn(
                'group flex min-w-0 items-center gap-3 grow-[2] py-2.5',
              )}            
              href={`/teams/${team.id}/sprints`}
              title={team.name}
            >
              <TeamBadge name={team.name} />
              {collapsed ? null : (
                <span className="truncate text-sm font-medium tracking-tight">{team.name}</span>
              )}
            </Link>
            {collapsed ? null : (
              <Link
                className={cn(
                  'group flex min-w-0 items-center gap-3',
                )}   
                aria-label={`Edit ${team.name}`}
                href={`/teams/${team.id}/edit`}
                title={`Edit ${team.name}`}
              >
                <SettingsIcon />
              </Link>
            )}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
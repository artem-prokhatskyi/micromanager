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

function TeamBadge({ name }: { name: string }): ReactElement {
  const initial = name.slice(0, 1).toUpperCase() || '?';

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background/80 text-xs font-semibold uppercase tracking-[0.18em] text-foreground/90">
      {initial}
    </span>
  );
}

function GearIcon(): ReactElement {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
      <path
        d="M10.325 4.317a1 1 0 0 1 1.95 0l.246 1.313a1 1 0 0 0 .95.812 5.985 5.985 0 0 1 1.87.776 1 1 0 0 0 1.246-.138l.955-.936a1 1 0 0 1 1.379 0l1.379 1.379a1 1 0 0 1 0 1.379l-.936.955a1 1 0 0 0-.138 1.246c.36.585.621 1.212.776 1.87a1 1 0 0 0 .812.95l1.313.246a1 1 0 0 1 0 1.95l-1.313.246a1 1 0 0 0-.812.95 5.985 5.985 0 0 1-.776 1.87 1 1 0 0 0 .138 1.246l.936.955a1 1 0 0 1 0 1.379l-1.379 1.379a1 1 0 0 1-1.379 0l-.955-.936a1 1 0 0 0-1.246-.138 5.985 5.985 0 0 1-1.87.776 1 1 0 0 0-.95.812l-.246 1.313a1 1 0 0 1-1.95 0l-.246-1.313a1 1 0 0 0-.95-.812 5.985 5.985 0 0 1-1.87-.776 1 1 0 0 0-1.246.138l-.955.936a1 1 0 0 1-1.379 0l-1.379-1.379a1 1 0 0 1 0-1.379l.936-.955a1 1 0 0 0 .138-1.246 5.985 5.985 0 0 1-.776-1.87 1 1 0 0 0-.812-.95l-1.313-.246a1 1 0 0 1 0-1.95l1.313-.246a1 1 0 0 0 .812-.95 5.985 5.985 0 0 1 .776-1.87 1 1 0 0 0-.138-1.246l-.936-.955a1 1 0 0 1 0-1.379l1.379-1.379a1 1 0 0 1 1.379 0l.955.936a1 1 0 0 0 1.246.138 5.985 5.985 0 0 1 1.87-.776 1 1 0 0 0 .95-.812l.246-1.313Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
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
            <Link
              className={cn(
                'group flex min-w-0 items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 transition-colors duration-200',
                isActive
                  ? 'border-border/80 bg-accent text-accent-foreground shadow-lg shadow-black/10'
                  : 'text-muted-foreground hover:border-border/60 hover:bg-card/70 hover:text-foreground',
                collapsed ? 'justify-center px-2' : 'flex-1 justify-start',
              )}
              href={`/teams/${team.id}/sprints`}
              title={team.name}
            >
              <TeamBadge name={team.name} />
              {collapsed ? null : (
                <span className="truncate text-sm font-medium tracking-tight">{team.name}</span>
              )}
            </Link>
            <Link
              aria-label={`Edit ${team.name}`}
              className={cn(
                buttonVariants({ size: 'icon', variant: 'ghost' }),
                'h-9 w-9 shrink-0 rounded-xl text-muted-foreground hover:text-foreground',
                isActive && 'bg-accent/80 text-accent-foreground hover:bg-accent',
              )}
              href={`/teams/${team.id}/edit`}
              title={`Edit ${team.name}`}
            >
              <GearIcon />
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
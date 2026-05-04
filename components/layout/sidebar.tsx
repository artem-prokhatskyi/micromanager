'use client';

import type { ReactElement } from 'react';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';

import { SidebarNavLinks } from '@/components/layout/sidebar-nav-links';
import { SidebarTeamList } from '@/components/layout/sidebar-team-list';
import { SidebarToggle } from '@/components/layout/sidebar-toggle';
import { UserSessionPanel } from '@/components/layout/user-session-panel';
import { Separator } from '@/components/ui/separator';
import type { ShellTeam } from '@/lib/data/team';
import { cn } from '@/lib/utils';
import type { AuthenticatedUserRecord } from '@/types';

interface SidebarProps {
  collapsed: boolean;
  currentUser: AuthenticatedUserRecord;
  onToggle: () => void;
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

export function Sidebar({ collapsed, currentUser, onToggle, teams }: SidebarProps): ReactElement {
  const pathname = usePathname();
  const params = useParams<{ teamId?: string }>();
  const activeTeamId = typeof params.teamId === 'string' ? params.teamId : null;
  const settingsIsActive = pathname === '/settings';

  return (
    <aside
      className={cn(
        'flex min-h-screen shrink-0 flex-col border-r border-border/80 bg-card/70 px-3 py-4 shadow-2xl shadow-black/10 backdrop-blur transition-all duration-200',
        collapsed ? 'w-20' : 'w-72',
      )}
    >
      <div className={cn('mb-6 flex items-center', collapsed ? 'justify-center' : 'justify-between gap-3 px-1')}>
        {collapsed ? null : (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">Monitor</p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">Sprint Shell</h2>
          </div>
        )}
        <SidebarToggle collapsed={collapsed} onToggle={onToggle} />
      </div>

      <div className="space-y-4">
        <section className="space-y-3">
          {collapsed ? null : (
            <div className="px-2">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">Teams</p>
            </div>
          )}
          <SidebarTeamList activeTeamId={activeTeamId} collapsed={collapsed} teams={teams} />
        </section>

        <Separator />

        <SidebarNavLinks collapsed={collapsed} isAdmin={currentUser.role === 'admin'} />
      </div>

      <div className="flex-1" />

      <Separator className="my-4" />

      <UserSessionPanel collapsed={collapsed} currentUser={currentUser} />

      <Separator className="my-4" />

      <Link
        className={cn(
          'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors duration-200',
          settingsIsActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-card/70 hover:text-foreground',
          collapsed ? 'justify-center px-2' : 'justify-start',
        )}
        href="/settings"
        title="Settings"
      >
        <SettingsIcon />
        {collapsed ? null : <span>Settings</span>}
      </Link>
    </aside>
  );
}
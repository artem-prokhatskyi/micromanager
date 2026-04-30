'use client';

import type { ReactElement, ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { Sidebar } from '@/components/layout/sidebar';
import type { ShellTeam } from '@/lib/data/team';
import { cn } from '@/lib/utils';

const SIDEBAR_STORAGE_KEY = 'app-shell:sidebar-collapsed';

interface AppShellProps {
  children: ReactNode;
  teams: ShellTeam[];
}

export function AppShell({ children, teams }: AppShellProps): ReactElement {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  useEffect(() => {
    const storedValue = sessionStorage.getItem(SIDEBAR_STORAGE_KEY);

    if (storedValue === 'true') {
      setCollapsed(true);
    }

    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    sessionStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  }, [collapsed, isHydrated]);

  return (
    <div className="flex min-h-screen">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((current) => !current)} teams={teams} />
      <main className={cn('flex-1 overflow-y-auto transition-all duration-200', collapsed ? 'px-6 py-6 md:px-8' : 'px-6 py-6 md:px-10')}>
        <div className="mx-auto min-h-[calc(100vh-3rem)] max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
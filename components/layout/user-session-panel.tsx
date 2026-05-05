'use client';

import type { ReactElement } from 'react';
import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import type { AuthenticatedUserRecord } from '@/types';

interface UserSessionPanelProps {
  collapsed: boolean;
  currentUser: AuthenticatedUserRecord;
}

export function UserSessionPanel({ collapsed, currentUser }: UserSessionPanelProps): ReactElement {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState<boolean>(false);

  async function handleSignOut(): Promise<void> {
    setIsSigningOut(true);

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
    } finally {
      router.replace('/login');
      router.refresh();
      setIsSigningOut(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border/80 bg-card/40 p-3">
      {collapsed ? (
        <div className="truncate text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {currentUser.email}
        </div>
      ) : (
        <>
          <div className="space-y-1">
            <p className="truncate text-sm font-medium text-foreground">{currentUser.email}</p>
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{currentUser.role}</p>
          </div>
          <Button className="w-full" disabled={isSigningOut} onClick={handleSignOut} type="button" variant="outline">
            {isSigningOut ? 'Signing out...' : 'Sign out'}
          </Button>
        </>
      )}
    </div>
  );
}
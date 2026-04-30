'use client';

import type { ReactElement } from 'react';

import { Button } from '@/components/ui/button';

interface SidebarToggleProps {
  collapsed: boolean;
  onToggle: () => void;
}

function PanelIcon({ collapsed }: { collapsed: boolean }): ReactElement {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d={collapsed ? 'M9 4V20M13 12H18' : 'M15 4V20M6 12H11'} />
    </svg>
  );
}

export function SidebarToggle({ collapsed, onToggle }: SidebarToggleProps): ReactElement {
  return (
    <Button
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      onClick={onToggle}
      size="icon"
      type="button"
      variant="ghost"
    >
      <PanelIcon collapsed={collapsed} />
    </Button>
  );
}
'use client';

import type { ReactElement } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

interface SidebarNavLinksProps {
  activeTeamId: string | null;
  collapsed: boolean;
}

interface NavItem {
  disabled?: boolean;
  href: string;
  icon: ReactElement;
  label: string;
  title: string;
}

function LinkIcon({ path }: { path: string }): ReactElement {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d={path} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function renderNavItem(collapsed: boolean, item: NavItem, pathname: string): ReactElement {
  const isActive = pathname === item.href;
  const className = cn(
    'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors duration-200',
    isActive
      ? 'bg-accent text-accent-foreground'
      : 'text-muted-foreground hover:bg-card/70 hover:text-foreground',
    item.disabled && 'pointer-events-none opacity-40',
    collapsed && 'justify-center px-2',
  );

  if (item.disabled) {
    return (
      <span className={className} key={item.label} title={item.title}>
        <span className="shrink-0">{item.icon}</span>
        {collapsed ? null : <span>{item.label}</span>}
      </span>
    );
  }

  return (
    <Link className={className} href={item.href} key={item.label} title={item.title}>
      <span className="shrink-0">{item.icon}</span>
      {collapsed ? null : <span>{item.label}</span>}
    </Link>
  );
}

export function SidebarNavLinks({ activeTeamId, collapsed }: SidebarNavLinksProps): ReactElement {
  const pathname = usePathname();
  const scopedDisabled = activeTeamId === null;

  const navItems: NavItem[] = [
    {
      href: '/teams/new',
      icon: <LinkIcon path="M12 5V19M5 12H19" />,
      label: 'Add team',
      title: 'Create a new team',
    },
    {
      disabled: scopedDisabled,
      href: activeTeamId ? `/teams/${activeTeamId}/members/new` : '#',
      icon: <LinkIcon path="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11ZM5 21C5 17.6863 8.13401 15 12 15C15.866 15 19 17.6863 19 21" />,
      label: 'Add team member',
      title: scopedDisabled ? 'Select a team first' : 'Add a team member',
    },
    {
      disabled: scopedDisabled,
      href: activeTeamId ? `/teams/${activeTeamId}/sprints/new` : '#',
      icon: <LinkIcon path="M7 4V2M17 4V2M4 9H20M6 5H18C19.1046 5 20 5.89543 20 7V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V7C4 5.89543 4.89543 5 6 5ZM12 12V16M10 14H14" />,
      label: 'Add sprint',
      title: scopedDisabled ? 'Select a team first' : 'Add a sprint',
    },
    {
      disabled: scopedDisabled,
      href: activeTeamId ? `/teams/${activeTeamId}/calendar` : '#',
      icon: <LinkIcon path="M8 2V5M16 2V5M3 9H21M5 4H19C20.1046 4 21 4.89543 21 6V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V6C3 4.89543 3.89543 4 5 4ZM7 13H11V17H7V13Z" />,
      label: 'Calendar',
      title: scopedDisabled ? 'Select a team first' : 'Open the team calendar',
    },
  ];

  return <div className="space-y-1">{navItems.map((item) => renderNavItem(collapsed, item, pathname))}</div>;
}
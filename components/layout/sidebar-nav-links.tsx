'use client';

import type { ReactElement } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

interface SidebarNavLinksProps {
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

export function SidebarNavLinks({ collapsed }: SidebarNavLinksProps): ReactElement {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    {
      href: '/teams/new',
      icon: <LinkIcon path="M12 5V19M5 12H19" />,
      label: 'Add team',
      title: 'Create a new team',
    },
  ];

  return <div className="space-y-1">{navItems.map((item) => renderNavItem(collapsed, item, pathname))}</div>;
}
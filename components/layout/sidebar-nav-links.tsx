'use client';

import type { ReactElement } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

interface SidebarNavLinksProps {
  collapsed: boolean;
  isAdmin: boolean;
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

export function SidebarNavLinks({ collapsed, isAdmin }: SidebarNavLinksProps): ReactElement {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    {
      href: '/teams/new',
      icon: <LinkIcon path="M12 5V19M5 12H19" />,
      label: 'Add team',
      title: 'Create a new team',
    },
    ...(isAdmin
      ? [
          {
            href: '/users',
            icon: <LinkIcon path="M16 21V19C16 17.343 14.657 16 13 16H7C5.343 16 4 17.343 4 19V21M18 8C19.657 8 21 9.343 21 11C21 12.657 19.657 14 18 14C16.343 14 15 12.657 15 11C15 9.343 16.343 8 18 8ZM10 5C12.209 5 14 6.791 14 9C14 11.209 12.209 13 10 13C7.791 13 6 11.209 6 9C6 6.791 7.791 5 10 5Z" />,
            label: 'Users',
            title: 'Manage users and invites',
          },
        ]
      : []),
  ];

  return <div className="space-y-1">{navItems.map((item) => renderNavItem(collapsed, item, pathname))}</div>;
}
import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';

import { AppShell } from '@/components/layout/app-shell';
import { getTeams } from '@/lib/data/team';

import './globals.css';

export const metadata: Metadata = {
  title: 'Team Sprint Monitor',
  description: 'Sprint planning shell for Team Sprint Monitor.',
};

export const dynamic = 'force-dynamic';

interface RootLayoutProps {
  children: ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps): Promise<ReactElement> {
  const teams = await getTeams();

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <AppShell teams={teams}>{children}</AppShell>
      </body>
    </html>
  );
}
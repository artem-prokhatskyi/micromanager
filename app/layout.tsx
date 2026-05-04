import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { getCurrentUserOrNull } from '@/lib/auth';
import { AppShell } from '@/components/layout/app-shell';
import { Toaster } from '@/components/ui/toaster';
import { ToastProvider } from '@/hooks/use-toast';
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
  const headerList = await headers();
  const pathname = headerList.get('x-pathname') ?? '/';
  const currentUser = await getCurrentUserOrNull();
  const isAuthPage = pathname === '/login' || pathname === '/register';

  if (!currentUser && !isAuthPage) {
    redirect('/login');
  }

  if (currentUser && isAuthPage) {
    redirect('/');
  }

  const teams = currentUser ? await getTeams() : [];

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ToastProvider>
          {currentUser ? (
            <AppShell
              currentUser={{
                email: currentUser.email,
                id: currentUser.id,
                invitedByEmail: currentUser.invitedByEmail,
                mustChangePassword: currentUser.mustChangePassword,
                role: currentUser.role,
                status: currentUser.status,
              }}
              teams={teams}
            >
              {children}
            </AppShell>
          ) : children}
          <Toaster />
        </ToastProvider>
      </body>
    </html>
  );
}
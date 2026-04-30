import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'Team Sprint Monitor',
  description: 'Foundation scaffold for Team Sprint Monitor.',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps): ReactElement {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
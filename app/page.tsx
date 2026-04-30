import type { ReactElement } from 'react';

export default function HomePage(): ReactElement {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-24">
      <section className="w-full max-w-2xl rounded-2xl border border-border bg-muted/20 p-10 shadow-sm">
        <div className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
            RFC-001
          </p>
          <h1 className="text-4xl font-semibold tracking-tight">Team Sprint Monitor</h1>
          <p className="max-w-xl text-base text-muted-foreground">
            The foundation scaffold is in place. Application shell, navigation, and feature pages are
            implemented in later RFCs.
          </p>
        </div>
      </section>
    </main>
  );
}
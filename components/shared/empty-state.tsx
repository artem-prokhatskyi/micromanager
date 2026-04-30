import type { ReactElement } from 'react';

import { ButtonLink } from '@/components/ui/button';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  eyebrow?: string;
}

function SparkIcon(): ReactElement {
  return (
    <svg aria-hidden="true" className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 2L14.8 9.2L22 12L14.8 14.8L12 22L9.2 14.8L2 12L9.2 9.2L12 2Z" />
    </svg>
  );
}

export function EmptyState({ actionHref, actionLabel, description, eyebrow, title }: EmptyStateProps): ReactElement {
  return (
    <main className="flex min-h-[calc(100vh-3rem)] items-center justify-center px-6 py-16">
      <section className="w-full max-w-3xl rounded-3xl border border-border/80 bg-card/70 p-8 shadow-2xl shadow-black/20 backdrop-blur">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-border/80 bg-accent/70 text-foreground/90">
            <SparkIcon />
          </div>
          {eyebrow ? (
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.32em] text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="mt-4 max-w-xl text-pretty text-base leading-7 text-muted-foreground">{description}</p>
          {actionHref && actionLabel ? (
            <div className="mt-8">
              <ButtonLink href={actionHref}>{actionLabel}</ButtonLink>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
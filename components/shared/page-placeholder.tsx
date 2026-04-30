import type { ReactElement } from 'react';

interface PagePlaceholderProps {
  title: string;
  description: string;
  badge?: string;
}

export function PagePlaceholder({ badge, description, title }: PagePlaceholderProps): ReactElement {
  return (
    <section className="space-y-6">
      <div className="space-y-3">
        {badge ? (
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">{badge}</p>
        ) : null}
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="max-w-3xl text-base leading-7 text-muted-foreground">{description}</p>
      </div>
      <div className="rounded-3xl border border-border/80 bg-card/70 p-8 shadow-2xl shadow-black/10 backdrop-blur">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border/80 bg-background/70 p-5">
            <p className="text-sm font-medium text-foreground">Shell Ready</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This route is wired into the application shell and ready for the feature implementation in its RFC.
            </p>
          </div>
          <div className="rounded-2xl border border-border/80 bg-background/70 p-5">
            <p className="text-sm font-medium text-foreground">Routing Ready</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              The sidebar can navigate here now, so later feature work will replace content rather than restructure routes.
            </p>
          </div>
          <div className="rounded-2xl border border-border/80 bg-background/70 p-5">
            <p className="text-sm font-medium text-foreground">Dark Theme Ready</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Styling tokens and layout conventions are in place and aligned with the project-wide dark theme rule.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
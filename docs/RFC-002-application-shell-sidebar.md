# RFC-002: Application Shell, Dark Theme, and Sidebar Navigation

**Status:** Ready for implementation  
**Complexity:** Low  
**Builds upon:** RFC-001  
**Required by:** RFC-003, RFC-004, RFC-005, RFC-006, RFC-007

---

## Summary

Creates the visual and navigational skeleton of the entire application: the root Next.js layout with dark theme enforcement, the collapsible sidebar with team switcher, and the routing structure. Also implements the first-run empty state and the root redirect. Every subsequent RFC will render its pages inside this shell.

---

## Features Covered

- F06 — Collapsible sidebar
- F07 — Active team context (URL-driven)
- F08 — First-run empty state
- F09 — Dark theme (global, enforced)

---

## File Structure to Create

```
app/
├── layout.tsx                    # Root layout — dark theme, sidebar wrapper
├── page.tsx                      # Root redirect logic
├── globals.css                   # Tailwind base + shadcn/ui CSS variables
├── teams/
│   └── [teamId]/
│       └── layout.tsx            # Team-scoped layout (validates teamId)
components/
├── layout/
│   ├── app-shell.tsx             # Outer shell: sidebar + main content area
│   ├── sidebar.tsx               # Full sidebar component
│   ├── sidebar-team-list.tsx     # Team switcher buttons section
│   ├── sidebar-nav-links.tsx     # Add team / Add member / Add sprint links
│   └── sidebar-toggle.tsx        # Collapse/expand button
└── shared/
    └── empty-state.tsx           # Reusable empty state component
hooks/
└── use-teams.ts                  # Client hook to fetch teams list for sidebar
```

---

## Technical Specifications

### app/layout.tsx

Root layout. Sets `class="dark"` on `<html>`. Wraps everything in `<AppShell>`. This is a Server Component — it fetches teams from the DB to pass to the sidebar.

```typescript
// app/layout.tsx
import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/app-shell';
import { prisma } from '@/lib/prisma';
import './globals.css';

export const metadata: Metadata = {
  title: 'Team Sprint Monitor',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const teams = await prisma.team.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground antialiased">
        <AppShell teams={teams}>{children}</AppShell>
      </body>
    </html>
  );
}
```

**Critical:** `class="dark"` is on `<html>` and must never be removed. No theme toggle anywhere.

### app/page.tsx — root redirect

```typescript
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { EmptyState } from '@/components/shared/empty-state';

export default async function RootPage() {
  const firstTeam = await prisma.team.findFirst({
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (firstTeam) {
    redirect(`/teams/${firstTeam.id}/sprints`);
  }

  // No teams exist — show first-run empty state
  return (
    <EmptyState
      title="Welcome to Team Sprint Monitor"
      description="Configure your Jira connection to get started."
      actionLabel="Go to Settings"
      actionHref="/settings"
    />
  );
}
```

### components/layout/app-shell.tsx

Client Component (needs `useState` for sidebar collapse state).

```typescript
'use client';

interface AppShellProps {
  teams: Array<{ id: string; name: string }>;
  children: React.ReactNode;
}

export function AppShell({ teams, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar teams={teams} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
```

### components/layout/sidebar.tsx

Sidebar structure. Uses `useParams()` to determine active team. Renders collapsed (icon-only, 64px wide) or expanded (240px wide) based on `collapsed` prop. Transition animated with Tailwind `transition-all duration-200`.

**Contents (top to bottom):**
1. `<SidebarToggle>` — collapse/expand button
2. Teams section header ("Teams" label, hidden when collapsed)
3. `<SidebarTeamList teams={teams} activeTeamId={activeTeamId} collapsed={collapsed} />`
4. Divider
5. `<SidebarNavLinks activeTeamId={activeTeamId} collapsed={collapsed} />`
6. Spacer (`flex-1`)
7. Settings link (gear icon + "Settings" label)

### components/layout/sidebar-team-list.tsx

Renders one button per team. Active team button uses `bg-accent` styling. Clicking a team navigates to `/teams/[teamId]/sprints` (sprint list for that team).

When collapsed: show only the first letter of team name (or icon) as avatar pill.

### components/layout/sidebar-nav-links.tsx

Three navigation links scoped to the active team:
- "Add team" → `/teams/new`
- "Add team member" → `/teams/[activeTeamId]/members/new`
- "Add sprint" → `/teams/[activeTeamId]/sprints/new`

When no active team (first run), "Add team member" and "Add sprint" are disabled/muted.

### components/shared/empty-state.tsx

Reusable empty state component used across multiple pages.

```typescript
interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}
```

Centered layout, muted icon (use a shadcn/ui icon or simple SVG), title in `text-foreground`, description in `text-muted-foreground`, optional CTA button linking to `actionHref`.

### globals.css

Standard shadcn/ui dark theme CSS variable setup. Only dark theme variables needed — no `:root` light theme block required since we enforce dark mode via `class="dark"` on `<html>`.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
    --radius: 0.5rem;
  }
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}
```

### Active team context

Active team is always derived from the URL param `teamId` via `useParams()`. Never stored in React state or a global store. The sidebar reads `teamId` from the URL to highlight the active team button.

### app/teams/[teamId]/layout.tsx

Server Component that validates the `teamId` param exists in the DB. Redirects to `/` if not found (prevents 500 errors from invalid IDs).

```typescript
export default async function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { teamId: string };
}) {
  const team = await prisma.team.findUnique({
    where: { id: params.teamId },
    select: { id: true },
  });

  if (!team) redirect('/');

  return <>{children}</>;
}
```

---

## shadcn/ui Components to Install

Run these before implementing:
```bash
npx shadcn@latest init
npx shadcn@latest add button separator tooltip
```

---

## Acceptance Criteria

- [ ] `class="dark"` is on `<html>` and no other theme class exists anywhere
- [ ] Sidebar is visible on all pages
- [ ] Sidebar collapses to icon-only mode; expands back to full labels
- [ ] Active team is highlighted in the sidebar team list based on URL `teamId`
- [ ] Switching teams in sidebar navigates to that team's sprint list
- [ ] Root `/` redirects to first team's sprints if teams exist
- [ ] Root `/` shows first-run empty state with Settings CTA if no teams exist
- [ ] Invalid `teamId` in URL redirects to `/` rather than crashing
- [ ] "Add team member" and "Add sprint" sidebar links are disabled when no active team
- [ ] Sidebar collapse state persists across page navigations within session
- [ ] No flash of light theme on any page load

---

## Edge Cases

- Teams list is empty: sidebar shows "Teams" section header with no buttons; nav links for member/sprint are disabled
- Very long team names: truncate with ellipsis in expanded mode; show full name in tooltip when collapsed
- More than 10 teams: sidebar section scrolls independently without affecting main content

---

## State Management Notes

- `collapsed` state lives in `AppShell` (client component) — persists for the session via React state
- No localStorage or cookie persistence needed for v1.0
- Active team ID is read-only from URL — never set via state

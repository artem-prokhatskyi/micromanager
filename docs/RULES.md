# RULES.md — Team Sprint Monitor

These rules govern all code written for this project. They apply to every file, every component, and every API route. When in doubt, follow the rule. When the rule doesn't cover a case, optimize for consistency with the existing codebase and simplicity.

---

## Table of Contents

1. [Tech Stack & Versions](#1-tech-stack--versions)
2. [Project Structure](#2-project-structure)
3. [TypeScript](#3-typescript)
4. [React & Components](#4-react--components)
5. [Styling & Theming](#5-styling--theming)
6. [Data Layer — Prisma & PostgreSQL](#6-data-layer--prisma--postgresql)
7. [API Routes — Next.js](#7-api-routes--nextjs)
8. [Jira Integration](#8-jira-integration)
9. [State Management](#9-state-management)
10. [Error Handling](#10-error-handling)
11. [Security](#11-security)
12. [Docker & Infrastructure](#12-docker--infrastructure)
13. [Business Logic Rules](#13-business-logic-rules)
14. [Code Quality](#14-code-quality)
15. [Implementation Priorities](#15-implementation-priorities)

---

## 1. Tech Stack & Versions

Use exactly these technologies. Do not introduce alternatives without explicit approval.

| Layer | Technology | Version |
|---|---|---|
| Language | TypeScript | 5.x (strict mode) |
| Framework | Next.js | 15.x (App Router only) |
| UI Library | React | 19.x |
| Styling | Tailwind CSS | 3.x |
| UI Components | shadcn/ui | latest (copy components into `components/ui/`) |
| Table | TanStack Table | 8.x |
| Calendar | react-day-picker | 9.x |
| ORM | Prisma | 6.x |
| Database | PostgreSQL | 16 (via Docker) |
| Runtime | Node.js | 20 LTS (Alpine in Docker) |
| Container | Docker + Docker Compose | v2 syntax (`docker compose`, not `docker-compose`) |
| Package manager | npm | — |

**Never use:**
- Pages Router (`/pages` directory) — App Router only
- Any CSS-in-JS library (styled-components, emotion)
- Redux or Zustand — use React state and URL state only (see Section 9)
- Axios — use native `fetch` only
- `moment.js` — use `date-fns` for all date operations

---

## 2. Project Structure

```
/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout — sets dark theme, sidebar
│   ├── page.tsx                  # Root redirect
│   ├── settings/
│   │   └── page.tsx
│   ├── teams/
│   │   ├── new/
│   │   │   └── page.tsx
│   │   └── [teamId]/
│   │       ├── members/
│   │       │   └── new/
│   │       │       └── page.tsx
│   │       ├── sprints/
│   │       │   ├── new/
│   │       │   │   └── page.tsx
│   │       │   └── [sprintId]/
│   │       │       └── page.tsx
│   │       └── calendar/
│   │           └── page.tsx
│   └── api/
│       ├── settings/
│       ├── teams/
│       ├── members/
│       ├── sprints/
│       ├── non-working-days/
│       └── jira/
├── components/
│   ├── ui/                       # shadcn/ui components (auto-generated, do not edit)
│   ├── layout/                   # Sidebar, shell, navigation
│   ├── teams/                    # Team-specific components
│   ├── sprints/                  # Sprint dashboard components
│   ├── calendar/                 # Calendar components
│   └── shared/                   # Reusable cross-feature components
├── lib/
│   ├── prisma.ts                 # Prisma client singleton
│   ├── jira.ts                   # Jira API client and helpers
│   ├── encryption.ts             # Jira API key encrypt/decrypt
│   ├── capacity.ts               # Capacity calculation functions
│   └── utils.ts                  # General utilities (cn, date helpers)
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── types/
│   └── index.ts                  # Shared TypeScript types and interfaces
├── hooks/                        # Custom React hooks
├── .env.example
├── .env                          # Never committed
├── docker-compose.yml
├── Dockerfile
└── README.md
```

**Rules:**
- One component per file. File name matches the component name in kebab-case: `sprint-capacity-table.tsx`.
- Page files (`page.tsx`) contain only layout and data-fetching logic. Extract all UI into components.
- Business logic (capacity calculations, changelog filtering) lives in `lib/`, never in components or API routes.
- Types shared across more than one file go in `types/index.ts`.

---

## 3. TypeScript

- **Strict mode is required.** `tsconfig.json` must have `"strict": true`. No exceptions.
- **No `any`.** Use `unknown` if the type is truly unknown, then narrow it. Using `any` is a bug.
- **No `as` type assertions** unless interfacing with an external API response that cannot be typed otherwise. Document why with a comment.
- **All function parameters and return types must be explicitly typed.** Do not rely on inference for public functions.
- **Interfaces for object shapes, `type` for unions and primitives.**

```typescript
// Correct
interface TeamMember {
  id: string;
  name: string;
  jiraEmail: string;
  workingDays: WeekDay[];
  defaultFocusFactor: number;
}

type WeekDay = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

// Wrong
const member: any = getMember();
const days = member.workingDays as string[];
```

- **Enums:** prefer `const` objects with `as const` over TypeScript enums.

```typescript
// Correct
export const NonWorkingDayType = {
  HOLIDAY: 'holiday',
  VACATION: 'vacation',
  SICKLEAVE: 'sickleave',
} as const;
export type NonWorkingDayType = typeof NonWorkingDayType[keyof typeof NonWorkingDayType];
```

- **Nullability:** use `null` (not `undefined`) for values that are intentionally absent in the database or API. Use `undefined` only for optional function parameters.

---

## 4. React & Components

### Component style

- **Functional components only.** No class components.
- **Named exports only.** No default exports except `page.tsx` and `layout.tsx` (Next.js requirement).

```typescript
// Correct
export function SprintCapacityTable({ sprint, members }: SprintCapacityTableProps) { ... }

// Wrong
export default function SprintCapacityTable() { ... }
```

### Props

- Every component must have an explicitly typed props interface named `[ComponentName]Props`.
- Do not spread unknown props onto DOM elements.
- Destructure props at the function signature level.

### Server vs. client components

- **Default to Server Components.** Only add `'use client'` when the component needs browser APIs, event handlers, or React hooks.
- Never fetch data in a Client Component directly. Data fetching belongs in Server Components or API route handlers called from client hooks.
- Keep `'use client'` components as leaf nodes — push them as far down the tree as possible.

### Hooks

- Custom hooks live in `hooks/`. File names prefixed with `use-`: `use-sprint-data.ts`.
- Hooks must have a single responsibility.
- Never call a hook conditionally.

### Loading and error states

- Every page that fetches data must implement a `loading.tsx` sibling (Next.js streaming) or an explicit loading skeleton component.
- Every async operation visible to the user must have an error state. Silent failures are bugs.
- Use skeleton components (from shadcn/ui) for loading states. Never use a spinner overlay that blocks the entire page.

---

## 5. Styling & Theming

### Dark theme — non-negotiable

- `class="dark"` is set on `<html>` in `app/layout.tsx` and **never removed**.
- There is no theme toggle. Do not build one. Do not import one from shadcn/ui.
- All colors must work correctly in dark mode. Test every new component in dark mode before considering it done.

### Tailwind

- Use Tailwind utility classes exclusively. No inline `style` attributes except for dynamic values that cannot be expressed as Tailwind classes (e.g. programmatically calculated widths).
- Use the `cn()` utility from `lib/utils.ts` (re-exported from `clsx` + `tailwind-merge`) for conditional class merging.

```typescript
import { cn } from '@/lib/utils';

<div className={cn('base-classes', isActive && 'active-classes', className)} />
```

- **Never hardcode colors as hex values in className.** Use Tailwind semantic tokens or shadcn/ui CSS variables (e.g. `bg-background`, `text-foreground`, `border-border`, `text-destructive`).
- Spacing, typography, and border-radius must use Tailwind scale values — not arbitrary values like `w-[437px]` unless no standard value fits.

### shadcn/ui

- Use shadcn/ui components as the foundation for all UI. Do not build a button, input, dialog, dropdown, table, badge, or tooltip from scratch.
- Components are copied into `components/ui/` — treat them as owned code. Modify them when needed rather than wrapping them unnecessarily.
- When composing shadcn/ui components, keep compositions in `components/shared/` or the relevant feature folder.

---

## 6. Data Layer — Prisma & PostgreSQL

### Schema rules

- All model names in `schema.prisma` use **PascalCase**. Field names use **camelCase**.
- Every model must have an `id String @id @default(cuid())` primary key. No integer auto-increment IDs.
- Every model must have `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`.
- Enforce uniqueness constraints at the database level, not just application level:
  - `NonWorkingDay`: `@@unique([memberId, date])`
  - `SprintFocusFactor`: `@@unique([sprintId, memberId])`
- All foreign keys must have explicit `onDelete` behavior defined. Default cascade behavior is not acceptable.

```prisma
model NonWorkingDay {
  id        String   @id @default(cuid())
  memberId  String
  teamId    String
  date      DateTime @db.Date
  type      NonWorkingDayType
  halfDay   Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  member    TeamMember @relation(fields: [memberId], references: [id], onDelete: Cascade)
  team      Team       @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([memberId, date])
}
```

### Prisma client

- Import the Prisma client from `lib/prisma.ts` only (singleton pattern to prevent connection exhaustion in development).
- Never instantiate `new PrismaClient()` outside of `lib/prisma.ts`.
- All database calls are `async`/`await`. No `.then()` chains.

### Migrations

- Never edit migration files after they have been committed.
- Every schema change requires a new migration: `npx prisma migrate dev --name describe-change`.
- Migrations run automatically on container startup via `prisma migrate deploy` in the Docker entrypoint.

### Data access pattern

- All database queries live in dedicated server-side functions in the relevant API route or a `lib/db/` helper file.
- Never query the database from a React component (even Server Components) directly — always go through a function in `lib/` or an API route handler.
- Use Prisma's `select` to fetch only the fields needed. Never use implicit `findMany()` that returns all fields of large models.

---

## 7. API Routes — Next.js

### Structure

- All API routes use the App Router convention: `app/api/[resource]/route.ts`.
- Use `GET`, `POST`, `PUT`, `PATCH`, `DELETE` handlers as named exports from `route.ts`.
- Route handlers return `NextResponse.json()`. Never return plain `Response` objects.

### Request / response contracts

- Every route handler validates its input. Use `zod` for schema validation on all `POST`/`PUT`/`PATCH` request bodies.
- Return consistent error response shapes:

```typescript
// Success
{ data: T }

// Error
{ error: { message: string; code?: string } }
```

- HTTP status codes must be semantically correct:
  - `200` — successful read or update
  - `201` — successful creation
  - `400` — validation error (bad input)
  - `404` — resource not found
  - `409` — conflict (e.g. duplicate non-working day)
  - `500` — unexpected server error (never expose stack traces)
  - `502` — Jira API upstream error

### Jira-facing routes

- All routes that call the Jira API must handle Jira being unavailable gracefully (return cached data + `502` status with a `stale: true` flag in the response).
- Jira API responses are cached in PostgreSQL. Cache is keyed by `sprintId`. Invalidated on manual refresh.

---

## 8. Jira Integration

### Client

- The Jira API client lives entirely in `lib/jira.ts`. No other file makes direct HTTP calls to Jira.
- Authentication: Basic auth using `btoa(email:apiKey)` in the `Authorization` header.
- Base URL constructed from `Settings.jiraDomain`: `https://{jiraDomain}/rest/`.
- The API key is decrypted from the database via `lib/encryption.ts` before each use. It is never stored in memory beyond the scope of a single request handler.

### Endpoints used

| Purpose | Endpoint |
|---|---|
| Validate connection | `GET /api/3/myself` |
| Find board for project | `GET /agile/1.0/board?projectKeyOrId={jiraSpace}` |
| List sprints | `GET /agile/1.0/board/{boardId}/sprint?maxResults=50` |
| Sprint metadata | `GET /agile/1.0/sprint/{sprintId}` |
| Sprint issues + changelog | `GET /agile/1.0/sprint/{sprintId}/issue?expand=changelog&fields=summary,assignee,priority,status,{storyPointsField}&maxResults=200` |

### Story points field

- The story points field ID is stored in `Settings.storyPointsFieldId` (default: `story_points`).
- When reading story points from a Jira issue, always use the configured field ID. If the field is absent on an issue, treat story points as `null` (display as `—` in UI, treat as `0` in sum calculations).

### Changelog processing

- All changelog processing logic lives in `lib/jira.ts` or `lib/capacity.ts`. Never inline it in components or route handlers.
- For closed sprints: filter changelog entries where `created > sprint.actualEnd` — these entries are discarded entirely.
- For active sprints: use the full changelog with no filtering.
- When extracting last assignee: find the most recent `assignee` field change in the (filtered) changelog. If no changelog entry exists for assignee, use the issue's current `assignee` field.
- When extracting planned/unplanned label: find the most recent changelog entry where `field === 'Sprint'` and the value transitioned to the current sprint. Compare its timestamp to `sprint.activatedAt`. If `activatedAt` is null, label all issues as `planned` and log a warning.

### Error mapping

Translate all Jira HTTP errors to user-facing messages in `lib/jira.ts`:

```typescript
const JIRA_ERROR_MESSAGES: Record<number, string> = {
  401: 'Invalid Jira credentials. Please check your API key in Settings.',
  403: 'Jira access denied. Ensure your account has the required permissions.',
  404: 'Resource not found in Jira.',
  429: 'Jira rate limit reached. Please wait a moment and try again.',
};

function getJiraErrorMessage(status: number): string {
  return JIRA_ERROR_MESSAGES[status] ?? 'Jira is currently unavailable.';
}
```

---

## 9. State Management

This project uses **no global state library**. State is managed through:

1. **URL state** — active team (`teamId`), active sprint (`sprintId`) live in the URL. Use Next.js `useParams()` and `useRouter()`.
2. **Server state** — data from the database is fetched in Server Components or via `fetch` calls in client hooks. Use React's built-in cache and Next.js `revalidatePath`/`revalidateTag` for invalidation.
3. **Local React state** — UI-only state (popup open/closed, filter selections, optimistic updates) uses `useState`.
4. **Form state** — use React controlled components with `useState`. No form library needed given the simplicity of forms.

**Rules:**
- Do not use `useEffect` to fetch data. Use Server Components or route handlers.
- The active team context is derived from the URL, not stored in React state.
- Calendar member filter state is local to the calendar page component — it does not need to persist across navigation.

---

## 10. Error Handling

### General principle

Every operation that can fail must have an explicit error path. There are no silent failures.

### API routes

```typescript
export async function GET(request: Request) {
  try {
    const data = await someDbOperation();
    return NextResponse.json({ data });
  } catch (error) {
    console.error('[API /teams GET]', error);
    return NextResponse.json(
      { error: { message: 'Failed to fetch teams.' } },
      { status: 500 }
    );
  }
}
```

- Log all caught errors with a prefix identifying the route: `[API /sprints/:id GET]`.
- Never expose raw error messages, stack traces, or database errors to the client.
- Validation errors (zod) return `400` with the specific field errors.

### Client-side

- Wrap all `fetch` calls in try/catch.
- Display errors using the shadcn/ui `toast` component (bottom-right, destructive variant for errors).
- For inline errors (form validation, popup conflicts), display adjacent to the relevant field.
- For page-level errors (Jira unavailable, sprint not found), display a full-width banner at the top of the content area — not a toast.

### Jira-specific

- If Jira is unavailable and cached data exists: render the cached data with a banner "Showing cached data from [timestamp]. [Retry]".
- If Jira is unavailable and no cache exists: render an error state component with a retry button. Do not render a blank section.
- The capacity table always renders (it does not depend on Jira). Only the issue tables section shows the Jira error state.

---

## 11. Security

### API key storage

- The Jira API key is encrypted with AES-256-GCM using `ENCRYPTION_KEY` from env before writing to the database.
- Decryption happens in `lib/encryption.ts` only. The decrypted key never leaves the server.
- `ENCRYPTION_KEY` must be exactly 32 bytes (64 hex characters). Validate at startup; throw if invalid.

```typescript
// lib/encryption.ts — pattern to follow
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

export function encrypt(plaintext: string): string { ... }
export function decrypt(ciphertext: string): string { ... }
```

### Environment variables

- Never import `process.env` directly in component files. Create typed accessor functions in `lib/config.ts`.
- Never log environment variable values, even in development.
- `.env` is in `.gitignore`. Only `.env.example` with placeholder values is committed.

### API surface

- This is an internal tool with no authentication. However:
  - Do not expose Prisma client to the browser.
  - Do not expose raw database IDs in URLs where they could be enumerated (use CUIDs which are non-sequential).
  - Validate all user-supplied IDs exist in the database before operating on them (return 404 if not found).

### No sensitive data in logs

- Never log: API keys, passwords, `ENCRYPTION_KEY`, decrypted values, full request bodies containing credentials.

---

## 12. Docker & Infrastructure

### Dockerfile

- Base image: `node:20-alpine`.
- Multi-stage build: `builder` stage installs deps and builds Next.js; `runner` stage copies only the output.
- Run as non-root user in the `runner` stage.
- `COPY --chown=node:node` for all files in the runner stage.

### docker-compose.yml

```yaml
# Required structure — do not deviate
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DATABASE}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
    environment:
      POSTGRES_URL: ${POSTGRES_URL}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
    command: sh -c "npx prisma migrate deploy && node server.js"

volumes:
  postgres_data:
```

### Startup entrypoint

- The `app` container runs `prisma migrate deploy` before starting Next.js.
- If migration fails, the container must exit with a non-zero code (do not start the app on a broken schema).

### Environment variables

Required in `.env`:

| Variable | Description |
|---|---|
| `POSTGRES_URL` | `postgresql://user:pass@db:5432/sprint_monitor` |
| `ENCRYPTION_KEY` | 64-character hex string (32 bytes) |
| `POSTGRES_USER` | PostgreSQL username |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `POSTGRES_DATABASE` | Database name |

---

## 13. Business Logic Rules

These rules are derived from the specification and must be implemented exactly as described. Do not interpret or simplify them.

### Working days calculation

```typescript
// lib/capacity.ts
function workingDaysInRange(member: TeamMember, start: Date, end: Date, nonWorkingDays: NonWorkingDay[]): number {
  // 1. Count all dates in [start, end] where date.getDay() maps to a day in member.workingDays
  // 2. For each NonWorkingDay record in [start, end] for this member:
  //    subtract 0.5 if halfDay === true, else subtract 1.0
  // Dates are compared by calendar date only (ignore time component)
}
```

### Capacity calculation

```
plannedCapacity = workingDaysInRange(member, sprint.plannedStart, sprint.plannedEnd) × focusFactor
actualCapacity  = workingDaysInRange(member, sprint.plannedStart, actualEndDate(sprint)) × focusFactor
focusFactor     = SprintFocusFactor.focusFactor ?? member.defaultFocusFactor
```

### Actual end date

```
actualEndDate(sprint):
  if sprint.actualEnd !== null → sprint.actualEnd
  elif today > sprint.plannedEnd → today
  else → sprint.plannedEnd
```

### Overdue detection

```
isOverdue(sprint):
  (sprint.actualEnd !== null && sprint.actualEnd > sprint.plannedEnd)
  || (sprint.actualEnd === null && today > sprint.plannedEnd)
```

### Changelog filtering

- For **closed** sprints (`sprint.actualEnd !== null`): discard all changelog entries where `created > sprint.actualEnd`.
- For **active** sprints: use all changelog entries without filtering.

### Issue pipeline (must execute in this exact order)

1. Fetch all sprint issues from Jira
2. Remove issues with no assignee
3. Apply changelog filter (above)
4. Extract per issue: `lastAssignee`, `lastStoryPoints`, `lastStatus`, `label`
5. Remove issues where `lastAssignee.emailAddress` does not match any `TeamMember.jiraEmail` (case-insensitive comparison)
6. Group by `lastAssignee`
7. Sort each group by priority: `Highest=0, High=1, Medium=2, Low=3, Lowest=4, none=5`

### Date handling

- All dates are stored and compared in **UTC**.
- `sprint.plannedStart`, `sprint.plannedEnd`, `sprint.actualEnd` are stored as UTC midnight of the relevant date.
- When comparing "today" to sprint dates, use `new Date()` in UTC (strip the time component).
- Display dates to the user in their browser's local timezone using `Intl.DateTimeFormat`.
- Use `date-fns` (not `moment.js`, not manual arithmetic) for all date calculations.

---

## 14. Code Quality

### General

- **No TODOs in committed code.** If something is deferred, document it in the relevant feature's section of `features.md` instead.
- **No commented-out code.** Delete it. Git history exists for a reason.
- **No `console.log` in committed code.** Use `console.error` for errors in API routes only, prefixed with the route name.
- Functions must do one thing. If a function name includes "and", split it.
- Maximum function length: 50 lines. If longer, extract helper functions.
- Maximum file length: 300 lines. If longer, split the file.

### Naming conventions

| Element | Convention | Example |
|---|---|---|
| Files (components) | kebab-case | `sprint-capacity-table.tsx` |
| Files (utilities) | kebab-case | `capacity.ts` |
| React components | PascalCase | `SprintCapacityTable` |
| Functions | camelCase | `calculatePlannedCapacity` |
| Variables | camelCase | `focusFactor` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_TEAM_MEMBERS` |
| Types / Interfaces | PascalCase | `TeamMember`, `SprintWithMembers` |
| Prisma models | PascalCase | `TeamMember` |
| Database fields | camelCase (Prisma maps to snake_case) | `jiraEmail` → `jira_email` |
| CSS classes | Tailwind utilities only | `bg-background text-foreground` |

### Imports

- Use absolute imports with the `@/` alias for all internal imports.
- Group imports: (1) Node built-ins, (2) external packages, (3) internal `@/` imports. Separate groups with a blank line.
- No circular imports. `lib/` must not import from `components/`. `components/` must not import from `app/`.

### Accessibility

- All interactive elements must be keyboard-navigable.
- shadcn/ui handles ARIA for its components — do not override ARIA attributes unless you have a specific reason and know what you are doing.
- All images and icons must have `alt` text or `aria-label`.
- Color alone must not be the only way to convey information (e.g. the OVERDUE badge uses both a red color and the text "OVERDUE").

---

## 15. Implementation Priorities

Build in this sequence. Do not start a later phase until the exit criterion of the current phase is met.

### Phase 1 — Foundation
**Exit criterion:** `docker compose up` works; Jira API key saves, encrypts, and validates.

- [ ] `Dockerfile` and `docker-compose.yml`
- [ ] `.env.example` and environment validation on startup
- [ ] Prisma schema for all models with migrations
- [ ] `lib/prisma.ts` singleton
- [ ] `lib/encryption.ts` (AES-256-GCM)
- [ ] `app/layout.tsx` with dark theme and sidebar shell
- [ ] `/settings` page — save and validate Jira connection

### Phase 2 — Team & Members
**Exit criterion:** Can create a team, add members with custom working days; sidebar switches between teams.

- [ ] `/teams/new` — create team form
- [ ] `/teams/[teamId]/members/new` — add member form with day toggles
- [ ] Sidebar team switcher with active team context via URL
- [ ] Empty state: first-run screen

### Phase 3 — Sprints & Capacity Dashboard
**Exit criterion:** Sprint dashboard shows correct planned capacity for at least one real Jira sprint.

- [ ] `/teams/[teamId]/sprints/new` — sprint import via Jira lookup
- [ ] Sprint dashboard header (name, dates, overdue badge)
- [ ] Capacity table (planned columns)
- [ ] Overdue detection and actual capacity columns
- [ ] Team capacity totals
- [ ] Focus factor override (editable input, auto-save)
- [ ] Sprint selector dropdown

### Phase 4 — Issues & Calendar
**Exit criterion:** Full sprint dashboard functional including issues; non-working days affect capacity.

- [ ] Jira issue fetch with changelog processing
- [ ] Issue pipeline (filter, label, group, sort)
- [ ] Per-developer issue tables
- [ ] Loading skeleton for issue tables
- [ ] Jira error state with cached data fallback
- [ ] Calendar 3-month view with sprint bands
- [ ] Non-working day popup (add)
- [ ] Non-working day indicators and tooltip
- [ ] Capacity recalculation on non-working day changes

### P1 features (implement after Phase 4 if time permits)
- Edit/delete team members
- Edit/delete non-working day records
- Calendar member filter
- Manual Jira refresh button
- Sprint sync from Jira

---

## Handling Ambiguity

When a situation is not covered by these rules:

1. Check the `features.md` acceptance criteria first.
2. Check the `PRD-improved.md` business rules section.
3. Choose the simpler implementation.
4. Leave a code comment explaining the decision: `// Business rule: [explanation]`.
5. Do not make assumptions about future requirements — implement only what is specified.

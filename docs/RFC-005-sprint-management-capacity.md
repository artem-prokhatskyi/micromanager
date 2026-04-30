# RFC-005: Sprint Management and Capacity Dashboard

**Status:** Ready for implementation  
**Complexity:** Medium  
**Builds upon:** RFC-001, RFC-002, RFC-003, RFC-004  
**Required by:** RFC-007 (issue tables use sprint data)

---

## Summary

Implements sprint creation via Jira lookup, the sprint dashboard header, the capacity table (planned and overdue columns), the team capacity totals, the sprint selector dropdown, and the per-sprint focus factor override. This RFC covers everything visible on the sprint dashboard *except* the issue tables (RFC-007) and the calendar (RFC-006).

---

## Features Covered

- F20 — Add sprint via Jira lookup
- F21 — Sprint list / selector
- F22 — Empty state: no sprints
- F23 — Edit sprint (sync from Jira) — P1
- F24 — Delete sprint — P1
- F25 — Sprint header
- F26 — Capacity table: planned columns
- F27 — Capacity table: overdue columns
- F28 — Team capacity totals
- F29 — Loading skeleton for sprint dashboard
- F30 — Per-sprint focus factor override

---

## File Structure to Create

```
app/
└── teams/
    └── [teamId]/
        └── sprints/
            ├── page.tsx              # Sprint list / redirect to latest sprint
            ├── new/
            │   └── page.tsx
            └── [sprintId]/
                └── page.tsx          # Sprint dashboard
components/
├── sprints/
│   ├── add-sprint-form.tsx
│   ├── sprint-selector.tsx           # Dropdown at top of dashboard
│   ├── sprint-header.tsx             # Name, dates, overdue badge
│   ├── sprint-capacity-table.tsx     # Full capacity table
│   ├── capacity-row.tsx              # Single member row
│   └── focus-factor-input.tsx        # Inline editable input
lib/
└── capacity.ts                       # All capacity calculation functions
app/
└── api/
    └── teams/
        └── [teamId]/
            └── sprints/
                ├── route.ts          # GET (list) + POST (create)
                └── [sprintId]/
                    └── route.ts      # GET + PUT (sync) + DELETE
```

---

## Technical Specifications

### lib/capacity.ts

All business logic for working day and capacity calculations. Exported functions:

```typescript
import { addDays, isWeekend, startOfDay, eachDayOfInterval } from 'date-fns';
import type { WeekDay, NonWorkingDay } from '@/types';

// Maps WeekDay enum to JS Date.getDay() (0=Sun, 1=Mon, ...)
const WEEKDAY_MAP: Record<WeekDay, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export function workingDaysInRange(
  workingDays: WeekDay[],
  nonWorkingDays: NonWorkingDay[],
  start: Date,
  end: Date
): number {
  const allDays = eachDayOfInterval({ start: startOfDay(start), end: startOfDay(end) });
  const workingDayNumbers = new Set(workingDays.map(d => WEEKDAY_MAP[d]));

  let count = allDays.filter(d => workingDayNumbers.has(d.getDay())).length;

  // Subtract non-working days that fall within range and on working days
  for (const nwd of nonWorkingDays) {
    const nwdDate = startOfDay(new Date(nwd.date));
    if (nwdDate >= startOfDay(start) && nwdDate <= startOfDay(end)) {
      if (workingDayNumbers.has(nwdDate.getDay())) {
        count -= nwd.halfDay ? 0.5 : 1;
      }
    }
  }

  return Math.max(0, count);
}

export function actualEndDate(sprint: {
  plannedEnd: Date;
  actualEnd: Date | null;
}): Date {
  if (sprint.actualEnd !== null) return sprint.actualEnd;
  const today = startOfDay(new Date());
  return today > startOfDay(sprint.plannedEnd) ? today : sprint.plannedEnd;
}

export function isSprintOverdue(sprint: {
  plannedEnd: Date;
  actualEnd: Date | null;
}): boolean {
  if (sprint.actualEnd !== null) {
    return sprint.actualEnd > sprint.plannedEnd;
  }
  return startOfDay(new Date()) > startOfDay(sprint.plannedEnd);
}

export function calculateCapacity(workingDays: number, focusFactor: number): number {
  return Math.round(workingDays * focusFactor * 10) / 10; // 1 decimal place
}
```

### API Routes

**GET /api/teams/[teamId]/sprints**

Returns all sprints for the team sorted by `plannedStart` descending:
```typescript
{
  data: Array<{
    id: string;
    name: string;
    plannedStart: string; // ISO
    plannedEnd: string;
    actualEnd: string | null;
    activatedAt: string | null;
    isOverdue: boolean;   // computed field
  }>
}
```

---

**POST /api/teams/[teamId]/sprints**

Request body:
```typescript
{ sprintName: string; } // the Jira sprint name to look up
```

Logic:
1. Validate `sprintName` is non-empty
2. Fetch team's `jiraSpace` from DB
3. Call `findSprintByName(jiraSpace, sprintName)` from `lib/jira.ts`
4. If not found: return `{ error: { message: "Sprint '[name]' not found in Jira." } }` with `404`
5. If found: create `Sprint` record with Jira data
6. Return `{ data: sprint }` with `201`

If multiple sprints with the same name exist in Jira: return them all for user selection:
```typescript
{ data: { multiple: true; options: JiraSprintMetadata[] } }
```
The client should re-POST with the specific `jiraSprintId` selected.

---

**PUT /api/teams/[teamId]/sprints/[sprintId]** (sync from Jira)

Re-fetches sprint metadata from Jira and updates `plannedStart`, `plannedEnd`, `actualEnd`, `activatedAt`. Does not modify `SprintFocusFactor` records.

---

**DELETE /api/teams/[teamId]/sprints/[sprintId]**

Cascades to `SprintFocusFactor` and `SprintIssueCache`.

---

**PATCH /api/teams/[teamId]/sprints/[sprintId]/focus-factors**

Updates a single member's focus factor for this sprint:
```typescript
// Request
{ memberId: string; focusFactor: number; }
// Response
{ data: { sprintId: string; memberId: string; focusFactor: number } }
```
Uses `prisma.sprintFocusFactor.upsert()`.

---

### Sprint Dashboard Page: app/teams/[teamId]/sprints/[sprintId]/page.tsx

Server Component. Fetches:
- Sprint record
- All team members with their `workingDays` and `defaultFocusFactor`
- `SprintFocusFactor` records for this sprint (to get overrides)
- `NonWorkingDay` records for all members within the sprint date range

Computes capacity data server-side and passes to client components. Does **not** fetch Jira issues (that is handled by RFC-007 separately via a client-side fetch).

```typescript
// Computed per member (server-side):
interface MemberCapacityData {
  memberId: string;
  name: string;
  specialization: Specialization | null;
  plannedWorkingDays: number;
  focusFactor: number;       // override ?? default
  plannedCapacity: number;
  actualWorkingDays: number; // only if overdue
  actualCapacity: number;    // only if overdue
  absenceSummary: {
    holiday: number;
    vacation: number;
    sickleave: number;
  };
}
```

### components/sprints/sprint-capacity-table.tsx

Client Component (needs `useState` for focus factor edits).

Renders:
1. `<SprintHeader>` — name, dates, overdue badge
2. Table with columns per `MemberCapacityData`
3. Footer row: "Total planned: X SP" | "Total actual: X SP" (actual only if overdue)

Columns (always):
- Name + FE/BE badge (display only)
- Planned working days
- Focus factor (`<FocusFactorInput>`)
- Planned capacity (recalculates when focus factor changes)

Additional columns (overdue only):
- Actual working days
- Actual capacity

### components/sprints/focus-factor-input.tsx

Client Component. Inline editable number input.
- Displays current value
- On focus: becomes editable input
- On blur or Enter: validates (0 < value ≤ 1), then PATCH to `/api/teams/[teamId]/sprints/[sprintId]/focus-factors`
- Shows error inline if validation fails
- Updates `plannedCapacity` and `actualCapacity` columns immediately (optimistic update)

### components/sprints/sprint-header.tsx

```typescript
interface SprintHeaderProps {
  name: string;
  plannedStart: Date;
  plannedEnd: Date;
  actualEnd: Date | null;
  isOverdue: boolean;
}
```

- Sprint name as `<h1>`
- Date range: `Jan 1, 2025 – Jan 14, 2025`
- If `actualEnd` differs from `plannedEnd`: show "Actual end: Jan 17, 2025 (+3 days)"
- OVERDUE badge: red `<Badge variant="destructive">OVERDUE</Badge>` if `isOverdue`

### components/sprints/sprint-selector.tsx

Client Component. shadcn/ui `Select` dropdown showing all sprints for the team. On change: `router.push(/teams/${teamId}/sprints/${selectedSprintId})`. Most recent sprint selected by default.

### Sprint list page: app/teams/[teamId]/sprints/page.tsx

Redirects to the most recent sprint. If no sprints: shows `<EmptyState>`.

```typescript
export default async function SprintsPage({ params }: { params: { teamId: string } }) {
  const latestSprint = await prisma.sprint.findFirst({
    where: { teamId: params.teamId },
    orderBy: { plannedStart: 'desc' },
    select: { id: true },
  });

  if (latestSprint) {
    redirect(`/teams/${params.teamId}/sprints/${latestSprint.id}`);
  }

  return (
    <EmptyState
      title="No sprints yet"
      description="Add your first sprint to start tracking capacity."
      actionLabel="Add sprint"
      actionHref={`/teams/${params.teamId}/sprints/new`}
    />
  );
}
```

### Add Sprint Form: components/sprints/add-sprint-form.tsx

Client Component.

1. Team selector dropdown (pre-filled from URL, changeable)
2. Sprint name text input
3. Submit button ("Find in Jira")

On submit:
- POST to `/api/teams/[teamId]/sprints`
- If single sprint found and created → redirect to sprint dashboard
- If multiple sprints found (`multiple: true`) → show list of options for user to choose from; re-POST with selected `jiraSprintId`
- If not found → show inline error

---

## shadcn/ui Components to Install

```bash
npx shadcn@latest add table skeleton
```

---

## Acceptance Criteria

- [ ] Sprint creation looks up Jira by name and stores `jiraSprintId`, `plannedStart`, `plannedEnd`, `actualEnd`, `activatedAt`
- [ ] Sprint dashboard shows correct `plannedWorkingDays` accounting for member schedule and non-working days
- [ ] Focus factor input editable inline; PATCH on blur/Enter; validates 0–1 range
- [ ] Changing focus factor updates capacity columns immediately (optimistic)
- [ ] Overdue columns only appear when `isOverdue = true`
- [ ] `actualEndDate()`: closed sprint → `actualEnd`; overdue active → today; on-time active → `plannedEnd`
- [ ] Sprint selector dropdown lists all team sprints sorted newest first
- [ ] Deleting a sprint cascades to `SprintFocusFactor` and `SprintIssueCache`
- [ ] Sprint list page redirects to most recent sprint if any exist
- [ ] Empty state shown with CTA when no sprints exist
- [ ] Total planned capacity shown below table; total actual shown only when overdue
- [ ] `workingDaysInRange` correctly handles non-standard weeks (e.g. Sun–Thu)
- [ ] Half-day non-working records deduct exactly 0.5 days

---

## Edge Cases

- Sprint `activatedAt` is null in Jira (very old sprints): store as null; affects planned/unplanned label in RFC-007
- `plannedEnd` and `actualEnd` are the same date: `isOverdue = false`; actual columns not shown
- Member has no `workingDays` that fall within sprint range: `plannedWorkingDays = 0`; capacity = 0
- Focus factor PATCH race condition (rapid clicks): debounce the PATCH call by 300ms in `FocusFactorInput`
- Sprint deleted while user is viewing its dashboard: next navigation shows empty state

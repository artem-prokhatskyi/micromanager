# RFC-007: Sprint Issue Tables and Jira Data Pipeline

**Status:** Ready for implementation  
**Complexity:** High  
**Builds upon:** RFC-001, RFC-003, RFC-004, RFC-005, RFC-006  
**Required by:** — (final RFC)

---

## Summary

Implements the complete Jira issue data pipeline: fetching sprint issues with full changelog, filtering and processing them per the business rules, grouping by assignee, and rendering per-developer issue tables with loading skeletons, cached data fallback, and the manual refresh button. This is the most complex RFC in the project.

---

## Features Covered

- F33 — Issue data pipeline
- F34 — Per-developer issue table header
- F35 — Issue table row
- F36 — Planned / unplanned label logic
- F37 — Issue table sorting (by Jira priority)
- F38 — Jira data cache with stale indicator
- F39 — Error state: Jira fetch failure on issue tables
- F29 — Loading skeleton (issue tables portion — capacity table skeleton was in RFC-005)
- F32 — Manual Jira refresh button (P1)

---

## File Structure to Create

```
app/
└── api/
    └── teams/
        └── [teamId]/
            └── sprints/
                └── [sprintId]/
                    └── issues/
                        └── route.ts     # GET (fetch/cache) + POST (refresh)
lib/
└── issue-pipeline.ts                    # All changelog processing and filtering logic
components/
└── sprints/
    ├── sprint-issue-section.tsx         # Client component: fetches + renders all issue tables
    ├── developer-issue-table.tsx        # Table for one developer
    ├── issue-table-row.tsx              # Single issue row
    ├── issue-skeleton.tsx               # Loading skeleton for issue tables
    ├── jira-error-banner.tsx            # Stale data / error banner
    └── refresh-button.tsx              # Manual refresh button
```

---

## Technical Specifications

### lib/issue-pipeline.ts

All business logic for processing Jira issues. No Jira API calls here — only pure data transformation.

```typescript
import { startOfDay } from 'date-fns';
import type { JiraIssue, TeamMember, Sprint } from '@/types';

export interface ProcessedIssue {
  key: string;
  title: string;
  url: string;
  label: 'planned' | 'unplanned';
  storyPoints: number | null;
  status: string;
  priority: 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest' | null;
  assigneeEmail: string;
}

export interface DeveloperIssueGroup {
  member: TeamMember;
  issues: ProcessedIssue[];
  totalStoryPoints: number;
}

const PRIORITY_ORDER: Record<string, number> = {
  Highest: 0, High: 1, Medium: 2, Low: 3, Lowest: 4,
};

export function processSprintIssues(
  issues: JiraIssue[],
  sprint: { actualEnd: Date | null; activatedAt: Date | null; jiraDomain: string; storyPointsFieldId: string },
  members: TeamMember[]
): DeveloperIssueGroup[] {
  // Step 1: Remove issues with no assignee
  const withAssignee = issues.filter(i => i.fields.assignee !== null);

  // Step 2: Filter changelog to sprint window
  const filtered = withAssignee.map(issue => ({
    ...issue,
    changelog: {
      histories: sprint.actualEnd
        ? issue.changelog.histories.filter(
            h => new Date(h.created) <= sprint.actualEnd!
          )
        : issue.changelog.histories,
    },
  }));

  // Step 3: Extract per-issue data from filtered changelog
  const processed = filtered.map(issue =>
    extractIssueData(issue, sprint, members)
  ).filter(Boolean) as ProcessedIssue[];

  // Step 4: Remove issues where assignee not in team
  const memberEmails = new Set(members.map(m => m.jiraEmail.toLowerCase()));
  const teamIssues = processed.filter(i =>
    memberEmails.has(i.assigneeEmail.toLowerCase())
  );

  // Step 5: Group by assignee (preserve member order from capacity table)
  const groups: DeveloperIssueGroup[] = members.map(member => {
    const memberIssues = teamIssues
      .filter(i => i.assigneeEmail.toLowerCase() === member.jiraEmail.toLowerCase())
      .sort((a, b) =>
        (PRIORITY_ORDER[a.priority ?? ''] ?? 5) -
        (PRIORITY_ORDER[b.priority ?? ''] ?? 5)
      );

    return {
      member,
      issues: memberIssues,
      totalStoryPoints: memberIssues.reduce((sum, i) => sum + (i.storyPoints ?? 0), 0),
    };
  });

  // Only return groups that have at least 1 issue
  return groups.filter(g => g.issues.length > 0);
}

function extractIssueData(
  issue: JiraIssue,
  sprint: { activatedAt: Date | null; jiraDomain: string; storyPointsFieldId: string },
  members: TeamMember[]
): ProcessedIssue | null {
  const histories = issue.changelog.histories;

  // Last assignee from changelog, or current assignee
  const assigneeChanges = histories
    .flatMap(h => h.items.filter(item => item.field === 'assignee'))
    .map((item, _, arr) => arr[arr.length - 1]);
  
  const lastAssigneeEmail =
    assigneeChanges.length > 0
      ? (assigneeChanges[assigneeChanges.length - 1]?.toString ?? issue.fields.assignee?.emailAddress)
      : issue.fields.assignee?.emailAddress;

  if (!lastAssigneeEmail) return null;

  // Last story points from changelog
  const spChanges = histories
    .flatMap(h => h.items.filter(item =>
      item.field === sprint.storyPointsFieldId ||
      item.field === 'story_points' ||
      item.field === 'Story Points'
    ));
  const lastSP = spChanges.length > 0
    ? parseFloat(spChanges[spChanges.length - 1]?.toString ?? '')
    : parseFloat(String(issue.fields[sprint.storyPointsFieldId] ?? ''));
  
  // Last status from changelog
  const statusChanges = histories
    .flatMap(h => h.items.filter(item => item.field === 'status'));
  const lastStatus = statusChanges.length > 0
    ? (statusChanges[statusChanges.length - 1]?.toString ?? issue.fields.status.name)
    : issue.fields.status.name;

  // Planned vs unplanned
  const sprintAdditions = histories.flatMap(h =>
    h.items
      .filter(item => item.field === 'Sprint' && (item.toString ?? '').includes(String(sprint.jiraDomain)))
      .map(() => new Date(h.created))
  );
  const addedAt = sprintAdditions.length > 0
    ? sprintAdditions.reduce((earliest, d) => d < earliest ? d : earliest)
    : null;

  const label: 'planned' | 'unplanned' =
    !addedAt || !sprint.activatedAt || addedAt <= sprint.activatedAt
      ? 'planned'
      : 'unplanned';

  return {
    key: issue.key,
    title: issue.fields.summary,
    url: `https://${sprint.jiraDomain}/browse/${issue.key}`,
    label,
    storyPoints: isNaN(lastSP) ? null : lastSP,
    status: lastStatus ?? issue.fields.status.name,
    priority: issue.fields.priority?.name ?? null,
    assigneeEmail: lastAssigneeEmail,
  };
}
```

### API Route: app/api/teams/[teamId]/sprints/[sprintId]/issues/route.ts

**GET** — returns processed issues (from cache if available, fetches from Jira if not):

```typescript
// Response
{
  data: {
    groups: DeveloperIssueGroup[];
    cachedAt: string | null;    // ISO timestamp of when data was fetched
    isStale: boolean;           // true if serving from cache due to Jira error
  }
}
```

Logic:
1. Check `SprintIssueCache` for this sprint
2. If cache exists and Jira is healthy (don't probe Jira on every load — skip this step): return cached data with `isStale: false`
3. If no cache: fetch from Jira via `fetchSprintIssues(sprint.jiraSprintId)` in `lib/jira.ts`
4. On Jira success: process with `processSprintIssues()`, store in `SprintIssueCache`, return with `cachedAt`
5. On Jira failure: if cache exists, return cached data with `isStale: true` and `cachedAt` from cache; if no cache, return error

**Cache strategy:** Always serve fresh data on first load (no cache). On subsequent loads, serve cache. Only fetch fresh when manually refreshed (POST).

**POST** (manual refresh) — forces re-fetch from Jira:

Logic:
1. Fetch fresh from Jira
2. If success: update `SprintIssueCache`, return fresh data
3. If failure: return error (do not delete existing cache)

Response shape same as GET.

### Sprint Dashboard Integration

In `app/teams/[teamId]/sprints/[sprintId]/page.tsx` (from RFC-005), add `<SprintIssueSection>` below the capacity table.

`<SprintIssueSection>` is a Client Component that:
1. On mount: fetches `GET /api/teams/[teamId]/sprints/[sprintId]/issues`
2. Shows `<IssueSkeleton>` while loading
3. On success: renders `<JiraErrorBanner>` if `isStale`, then `<DeveloperIssueTable>` for each group
4. On error: renders `<JiraErrorBanner>` with error message and retry button

### components/sprints/sprint-issue-section.tsx

```typescript
'use client';

interface SprintIssueSectionProps {
  teamId: string;
  sprintId: string;
  members: MemberCapacityData[]; // from RFC-005 — for ordering and absence summary
}
```

State:
- `status: 'loading' | 'success' | 'error' | 'stale'`
- `groups: DeveloperIssueGroup[]`
- `cachedAt: string | null`
- `errorMessage: string | null`

### components/sprints/developer-issue-table.tsx

Header section shows:
- Member name (large)
- `(totalStoryPoints SP / actualCapacity SP)` — pulls `actualCapacity` from `members` prop
- Absence line: `N holiday · N vacation · N sickleave` (from `MemberCapacityData.absenceSummary`)

Table uses TanStack Table with static column definitions (no sorting/filtering in v1.0 — sort is pre-applied by the pipeline).

Columns: Key | Title + Label pill | Story Points | Status

### components/sprints/issue-table-row.tsx

```typescript
interface IssueTableRowProps {
  issue: ProcessedIssue;
  jiraDomain: string;
}
```

- Key cell: `<a href={issue.url} target="_blank" rel="noopener noreferrer">{issue.key}</a>`
- Title cell: `<a href={issue.url} target="_blank">{issue.title}</a>` + `<LabelPill label={issue.label} />`
- Label pill: `planned` = muted gray badge; `unplanned` = amber/warning badge
- Story points: `{issue.storyPoints ?? '—'}`
- Status: plain text

### components/sprints/jira-error-banner.tsx

```typescript
interface JiraErrorBannerProps {
  type: 'stale' | 'error';
  message?: string;
  cachedAt?: string;     // ISO timestamp
  onRetry: () => void;
}
```

- `stale`: "Showing cached data from [formatted cachedAt]. [Retry]"
- `error` (no cache): "Could not load issues from Jira. [message] [Retry]"

Full-width banner below the sprint header, above the issue tables. Uses `bg-warning/20 border-warning` colors.

### components/sprints/refresh-button.tsx

Button in sprint dashboard header area (P1). On click: POST to `/api/.../issues`. Shows loading state during fetch.

---

## shadcn/ui Components to Install

```bash
npx shadcn@latest add
```
TanStack Table: `npm install @tanstack/react-table`

---

## Acceptance Criteria

- [ ] Issues fetched from Jira on first sprint dashboard load (no cache on first load)
- [ ] Loading skeleton shown while fetching
- [ ] Processed issues grouped by last assignee (within sprint window)
- [ ] Issues with no assignee not shown
- [ ] Issues assigned to non-team-members not shown
- [ ] For closed sprints: changelog entries after `actualEnd` are discarded before processing
- [ ] For active sprints: full changelog used
- [ ] `storyPoints` shows `—` when null/missing from Jira
- [ ] `label` is `planned` if added before `activatedAt`, else `unplanned`; `planned` if `activatedAt` is null
- [ ] Issues sorted by priority within each group: Highest → High → Medium → Low → Lowest → null
- [ ] Developer table header shows `totalSP / actualCapacity` correctly
- [ ] Absence summary shows correct counts from `NonWorkingDay` records
- [ ] Stale banner shown when serving cached data after Jira failure
- [ ] Error state shown when no cache and Jira fails, with retry button
- [ ] Retry button (both banner and refresh button) re-fetches from Jira
- [ ] Fresh fetch updates `SprintIssueCache` with new `fetchedAt` timestamp
- [ ] Issue keys and titles are clickable links opening Jira in new tab
- [ ] Capacity table renders immediately without waiting for Jira data

---

## Edge Cases

- Jira issue has story points as a string "5" vs number `5`: parse with `parseFloat()`, handle `NaN` as null
- Multiple changelog entries for the same field in one history item: use the last one in the array
- `activatedAt` is null: all issues labeled `planned`, log a server-side warning
- Sprint has 0 issues after filtering: render no developer tables (no empty state needed — capacity table is still shown)
- Developer has issues but capacity is 0 (e.g. on vacation all sprint): still show their issue table; `totalSP / 0 SP` displayed as `totalSP SP / 0 SP`
- `SprintIssueCache.data` contains a stale member list (member deleted since last cache): `processSprintIssues()` filters by current `members` list, so deleted members' issues are naturally excluded when re-processed — but cache stores raw Jira data, not processed output, so re-processing on each request is needed

**Important architectural note:** `SprintIssueCache` stores the **raw Jira response** (array of `JiraIssue`), not the processed output. Processing happens at read time using the current `members` list. This ensures that adding/removing members, changing jiraEmail, etc., are reflected without needing to invalidate the cache.

# RFCS.md — Team Sprint Monitor

Implementation will proceed **strictly in numerical order**. RFC-002 begins only after RFC-001 is fully complete and verified. No parallel implementation.

---

## Implementation Phases

### Phase 1 — Foundation (RFC-001)
Infrastructure and data layer. Nothing else can be built without this.

### Phase 2 — Shell (RFC-002)
Application skeleton. All subsequent pages render inside this shell.

### Phase 3 — Configuration (RFC-003)
Jira credentials and API client. Required by all Jira-dependent features.

### Phase 4 — Core Data (RFC-004)
Teams and members. Required by capacity calculations and issue filtering.

### Phase 5 — Sprint Dashboard (RFC-005)
Sprint management and capacity table. The primary product surface.

### Phase 6 — Calendar (RFC-006)
Non-working days. Feeds back into capacity calculations from RFC-005.

### Phase 7 — Issues (RFC-007)
Jira issue pipeline and per-developer tables. Completes the product.

---

## RFC List

| # | RFC | Title | Complexity | Builds Upon | Required By |
|---|---|---|---|---|---|
| 001 | RFC-001 | Docker, Environment, and Database Foundation | Low | — | 002, 003, 004, 005, 006, 007 |
| 002 | RFC-002 | Application Shell, Dark Theme, and Sidebar | Low | 001 | 003, 004, 005, 006, 007 |
| 003 | RFC-003 | Settings Page and Jira Connection | Medium | 001, 002 | 005, 007 |
| 004 | RFC-004 | Team and Member Management | Low | 001, 002 | 005, 006, 007 |
| 005 | RFC-005 | Sprint Management and Capacity Dashboard | Medium | 001–004 | 007 |
| 006 | RFC-006 | Calendar and Non-Working Days | Medium | 001, 002, 004, 005 | 007 |
| 007 | RFC-007 | Sprint Issue Tables and Jira Data Pipeline | High | 001–006 | — |

---

## Dependency Graph

```
RFC-001 (Foundation)
    │
    ├──► RFC-002 (Shell)
    │        │
    │        ├──► RFC-003 (Settings + Jira client)
    │        │        │
    │        ├──► RFC-004 (Teams + Members)
    │        │        │
    │        │        ├──► RFC-005 (Sprints + Capacity)
    │        │        │        │
    │        │        ├──► RFC-006 (Calendar)
    │        │        │        │
    │        │        │        └──► RFC-007 (Issues) ◄──── RFC-003
    │        │        │                                ◄──── RFC-005
    │        │        │                                ◄──── RFC-006
    │        │        └──────────────────────────────────────►
    │        └────────────────────────────────────────────────►
    └────────────────────────────────────────────────────────►
```

Sequential order: 001 → 002 → 003 → 004 → 005 → 006 → 007

---

## RFC Summaries

### RFC-001 — Docker, Environment, and Database Foundation
**Files:** `Dockerfile`, `docker-compose.yml`, `.env.example`, `prisma/schema.prisma`, `lib/prisma.ts`, `lib/encryption.ts`, `lib/config.ts`, `lib/utils.ts`, `types/index.ts`

Complete project scaffold. All 6 Prisma models with correct constraints. AES-256-GCM encryption utility. Docker Compose with healthcheck-based startup ordering. Prisma migrations run on container start.

**Exit criterion:** `docker compose up` works; DB migrations run; `encrypt(decrypt(x)) === x`

---

### RFC-002 — Application Shell, Dark Theme, and Sidebar Navigation
**Files:** `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `components/layout/*`, `components/shared/empty-state.tsx`

Root layout with `class="dark"` enforced globally. Collapsible sidebar with team switcher. Active team from URL. First-run empty state.

**Exit criterion:** Dark shell renders; sidebar collapses; root redirect works; first-run empty state shown

---

### RFC-003 — Settings Page and Jira Connection
**Files:** `app/settings/page.tsx`, `components/settings/settings-form.tsx`, `app/api/settings/route.ts`, `lib/jira.ts`

Settings form with encrypted Jira API key storage. Jira connection validation on save. Global `lib/jira.ts` client with all error mappings. Exports `validateJiraConnection`, `findSprintByName`, `fetchSprintIssues`.

**Exit criterion:** Settings save with encrypted key; Jira validation works; all error codes map to human-readable messages

---

### RFC-004 — Team and Member Management
**Files:** `app/teams/new/page.tsx`, `app/teams/[teamId]/members/*`, `components/teams/*`, `app/api/teams/*`

Full CRUD for teams and members. Working-day toggle (7 buttons). Focus factor validation. jiraEmail normalized to lowercase. jiraSpace normalized to uppercase. Edit/delete with confirmation dialogs.

**Exit criterion:** Create team → add members with custom working days → member list renders; delete cascades

---

### RFC-005 — Sprint Management and Capacity Dashboard
**Files:** `app/teams/[teamId]/sprints/*`, `components/sprints/sprint-*.tsx`, `components/sprints/capacity-*.tsx`, `lib/capacity.ts`, `app/api/teams/[teamId]/sprints/*`

Sprint import via Jira name lookup. Capacity calculations using `lib/capacity.ts`. Planned and overdue columns. Inline focus factor override. Sprint selector dropdown.

**Exit criterion:** Sprint imports from Jira; capacity table shows correct values including non-standard work weeks

---

### RFC-006 — Calendar and Non-Working Days
**Files:** `app/teams/[teamId]/calendar/page.tsx`, `components/calendar/*`, `app/api/teams/[teamId]/non-working-days/*`

3-month calendar with sprint band overlays and overdue day highlighting. Non-working day add/edit/delete popup. Cross indicators with tooltip. Member filter bar.

**Exit criterion:** Add non-working day for multiple members; capacity on sprint dashboard reflects the change; conflict validation works

---

### RFC-007 — Sprint Issue Tables and Jira Data Pipeline
**Files:** `app/api/teams/[teamId]/sprints/[sprintId]/issues/route.ts`, `lib/issue-pipeline.ts`, `components/sprints/sprint-issue-section.tsx`, `components/sprints/developer-issue-table.tsx`, `components/sprints/issue-table-row.tsx`, `components/sprints/jira-error-banner.tsx`

Jira issue fetch with raw response cached in `SprintIssueCache`. Processing pipeline: changelog filter → last assignee/SP/status extraction → planned/unplanned label → team member filter → priority sort. Stale data banner. Error state with retry.

**Exit criterion:** Sprint dashboard shows correct per-developer issue tables; stale banner appears when Jira is unavailable; re-processing on cache read handles member changes

---

## Files Per RFC Summary

| RFC | New Files | Modified Files |
|---|---|---|
| 001 | 10 | 0 |
| 002 | 8 | 0 |
| 003 | 4 | 1 (`lib/jira.ts` — new, but RFC-005 extends it) |
| 004 | 12 | 0 |
| 005 | 10 | 1 (`app/teams/[teamId]/sprints/[sprintId]/page.tsx`) |
| 006 | 9 | 0 |
| 007 | 7 | 1 (`app/teams/[teamId]/sprints/[sprintId]/page.tsx` — add `<SprintIssueSection>`) |

---

## Implementation Notes

1. **RFC-003 and RFC-004 have no dependency on each other** — they both depend on RFC-002 but not on each other. However, they are sequenced 003 → 004 because the Settings page (003) is the logical first step a user takes, and having the Jira client ready before sprints (RFC-005) is critical.

2. **RFC-006 is sequenced before RFC-007** even though RFC-007 doesn't strictly depend on RFC-006's UI. It depends on `NonWorkingDay` data being available and the `absenceSummary` being populated in `MemberCapacityData` from RFC-005, which requires RFC-006's API routes to exist.

3. **lib/capacity.ts (RFC-005) is used by RFC-006 and RFC-007** — `actualEndDate()` and `isSprintOverdue()` are needed by the calendar (overdue day highlighting) and issue section (actual capacity display).

4. **SprintIssueCache stores raw Jira data, not processed output** — this is an intentional architectural decision documented in RFC-007. It ensures member changes are reflected without cache invalidation.

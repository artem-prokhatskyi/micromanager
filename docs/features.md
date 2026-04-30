# Features: Team Sprint Monitor

**Version:** 1.0  
**Date:** 2025  
**Source:** PRD v1.1

---

## Product Overview

Team Sprint Monitor is an internal web tool for tracking development team productivity. It integrates with Jira Cloud and gives team leads and engineering managers a real-time view of each developer's capacity, sprint workload, and schedule deviations. The tool eliminates manual capacity calculations (~30 min per sprint) by automatically accounting for individual work schedules, vacations, sick leave, and focus factors.

**Primary user:** Team Lead / Engineering Manager  
**Stack:** TypeScript, Next.js (App Router), React, Tailwind CSS, shadcn/ui, PostgreSQL, Prisma, Docker Compose  
**Theme:** Dark only

---

## Table of Contents

- [Summary](#summary)
- [CAT-1: Infrastructure & DevOps](#cat-1-infrastructure--devops)
- [CAT-2: Application Shell & Navigation](#cat-2-application-shell--navigation)
- [CAT-3: Settings & Jira Integration](#cat-3-settings--jira-integration)
- [CAT-4: Team Management](#cat-4-team-management)
- [CAT-5: Sprint Management](#cat-5-sprint-management)
- [CAT-6: Sprint Dashboard — Capacity](#cat-6-sprint-dashboard--capacity)
- [CAT-7: Sprint Dashboard — Issues](#cat-7-sprint-dashboard--issues)
- [CAT-8: Calendar & Non-Working Days](#cat-8-calendar--non-working-days)
- [CAT-9: Out of Scope — v1.0](#cat-9-out-of-scope--v10)

---

## Summary

| Priority | Count | Feature IDs |
|---|---|---|
| Must have (P0) | 28 | F01–F28 |
| Should have (P1) | 10 | F29–F38 |
| Could have (P2) | 4 | F39–F42 |
| Won't have (v1.0) | 6 | F43–F48 |
| **Total** | **48** | |

| Category | Must | Should | Could | Won't |
|---|---|---|---|---|
| Infrastructure & DevOps | 5 | 0 | 0 | 0 |
| Application Shell & Navigation | 4 | 0 | 0 | 0 |
| Settings & Jira Integration | 4 | 0 | 0 | 0 |
| Team Management | 4 | 2 | 0 | 1 |
| Sprint Management | 3 | 2 | 0 | 0 |
| Sprint Dashboard — Capacity | 5 | 4 | 0 | 0 |
| Sprint Dashboard — Issues | 7 | 1 | 0 | 0 |
| Calendar & Non-Working Days | 6 | 1 | 0 | 0 |
| Future / Out of Scope | 0 | 0 | 4 | 5 |

---

## CAT-1: Infrastructure & DevOps

### F01 — Docker Compose stack
**Priority:** Must have | **Complexity:** Low  
**Description:** The entire application runs via `docker compose up` with no manual setup beyond providing a `.env` file.  
**Services:**
- `app` — Node 20 Alpine, Next.js on port 3000, depends on `db` healthcheck
- `db` — postgres:16-alpine on port 5432, named volume for data persistence

**Acceptance criteria:**
- `docker compose up` starts both services without errors
- App is accessible at `http://localhost:3000`
- PostgreSQL data persists across container restarts via named volume
- `app` does not start until `db` passes healthcheck

**Edge cases:** Port 3000 or 5432 already in use on host — document in README.

---

### F02 — Environment variable configuration
**Priority:** Must have | **Complexity:** Low  
**Description:** All sensitive and environment-specific values are provided via `.env` file at project root.

**Required variables:**

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (e.g. `postgresql://user:pass@db:5432/sprint_monitor`) |
| `ENCRYPTION_KEY` | 32-byte hex string for encrypting Jira API key at rest |

**Acceptance criteria:**
- App fails to start with a clear error if `DATABASE_URL` or `ENCRYPTION_KEY` is missing
- `.env.example` file included in repository with placeholder values
- `.env` listed in `.gitignore`

---

### F03 — Automatic database migrations on startup
**Priority:** Must have | **Complexity:** Low  
**Description:** Prisma runs `prisma migrate deploy` automatically when the `app` container starts, before the Next.js server accepts requests.

**Acceptance criteria:**
- Fresh `docker compose up` on an empty database creates all tables correctly
- Re-running `docker compose up` on an already-migrated database is a no-op (no errors)
- Migration failure prevents app from starting and logs a clear error

---

### F04 — Prisma schema covering all entities
**Priority:** Must have | **Complexity:** Medium  
**Description:** PostgreSQL schema defined in Prisma covering: `Settings`, `Team`, `TeamMember`, `NonWorkingDay`, `Sprint`, `SprintFocusFactor`.

**Key constraints to enforce at DB level:**
- `TeamMember.team_id` — foreign key to `Team`
- `NonWorkingDay` — unique constraint on `(member_id, date)` to prevent duplicate records
- `SprintFocusFactor` — unique constraint on `(sprint_id, member_id)`
- `Jira API key` stored encrypted (application-level encryption before write)

**Acceptance criteria:**
- All entities are created by migration with correct types and constraints
- Unique constraints reject duplicate records at DB level

---

### F05 — README with setup instructions
**Priority:** Must have | **Complexity:** Low  
**Description:** `README.md` at project root with step-by-step instructions for first-time setup and running the app.

**Must cover:** prerequisites (Docker), cloning the repo, copying `.env.example` to `.env`, filling required variables, running `docker compose up`, accessing the app.

**Acceptance criteria:**
- A person unfamiliar with the codebase can get the app running by following the README alone

---

## CAT-2: Application Shell & Navigation

### F06 — Collapsible sidebar
**Priority:** Must have | **Complexity:** Low  
**Description:** A persistent left sidebar that can be toggled between expanded (with labels) and collapsed (icon-only) modes.

**Contents (top to bottom):**
1. Toggle button (collapse/expand)
2. Teams section — one button per team
3. Divider
4. Action links: Add team, Add team member, Add sprint
5. Divider
6. Settings link

**Acceptance criteria:**
- Sidebar is visible on all pages
- Collapsed state shows icons only; expanded state shows icons + labels
- Toggle state persists across page navigations within the session
- Active team is visually highlighted in the teams list

---

### F07 — Active team context
**Priority:** Must have | **Complexity:** Low  
**Description:** Clicking a team button in the sidebar sets that team as the active context for the entire app. All subsequent views (calendar, sprint dashboard) operate within the active team.

**Acceptance criteria:**
- Switching team updates the current view immediately
- Active team ID is reflected in the URL so direct links work correctly
- If a teamId in the URL does not exist, redirect to the first available team or onboarding

---

### F08 — First-run empty state
**Priority:** Must have | **Complexity:** Low  
**Description:** When the app is opened for the first time (no teams, no settings configured), display an empty state screen guiding the user through initial setup.

**Flow:** "Configure your Jira connection to get started" → link to Settings → after settings saved, prompt to create first team.

**Acceptance criteria:**
- Empty state shown when no teams exist
- Clear CTA linking to the Settings page
- Empty state is not shown once at least one team exists

---

### F09 — Dark theme (global, enforced)
**Priority:** Must have | **Complexity:** Low  
**Description:** The application uses dark theme exclusively. `class="dark"` is set on the `<html>` element globally and never removed. No light mode, no theme toggle.

**Acceptance criteria:**
- All pages and components render correctly in dark theme
- No theme toggle UI exists anywhere in the app
- No flash of light theme on page load

---

## CAT-3: Settings & Jira Integration

### F10 — Settings page
**Priority:** Must have | **Complexity:** Low  
**Description:** A dedicated `/settings` page accessible from the sidebar where the user configures global integration credentials.

**Fields:**
| Field | Default | Notes |
|---|---|---|
| Jira domain | — | e.g. `your-domain.atlassian.net` |
| Jira API key | — | Stored encrypted (AES-256) |
| Jira email | — | Used for Basic auth alongside API key |
| Story points field ID | `story_points` | Override with e.g. `customfield_10016` |
| GitHub API key | — | Stored only, unused in v1.0 |

**Acceptance criteria:**
- All fields save to the `Settings` table on submit
- Jira API key is encrypted before being written to the database
- Settings persist across page reloads and container restarts

---

### F11 — Jira connection validation
**Priority:** Must have | **Complexity:** Medium  
**Description:** When settings are saved, the system makes a test request to the Jira API to validate that the domain, email, and API key are correct.

**Acceptance criteria:**
- On successful validation: show a green success message "Connected to Jira successfully"
- On failure: show a specific human-readable error (e.g. "Invalid API key", "Domain not found") — not a raw HTTP error
- Validation runs on every save, not just first save

**Technical note:** Use `GET /rest/api/3/myself` as the validation endpoint.

---

### F12 — Jira API key encryption at rest
**Priority:** Must have | **Complexity:** Medium  
**Description:** The Jira API key is encrypted using `ENCRYPTION_KEY` from environment before being written to the database, and decrypted on read before being used in API calls.

**Acceptance criteria:**
- Raw API key is never stored in plain text in the database
- Decrypted key is never logged or exposed in API responses
- App handles decryption failure gracefully (e.g. if `ENCRYPTION_KEY` changes)

---

### F13 — Jira API error handling (global)
**Priority:** Must have | **Complexity:** Medium  
**Description:** All Jira API calls are wrapped with consistent error handling that translates HTTP errors into human-readable messages.

**Error mappings:**
| HTTP status | User-facing message |
|---|---|
| 401 | "Invalid Jira credentials. Please check your API key in Settings." |
| 403 | "Jira access denied. Ensure your account has the required permissions." |
| 404 | "Resource not found in Jira." |
| 429 | "Jira rate limit reached. Please wait a moment and try again." |
| 5xx | "Jira is currently unavailable. Showing cached data." |
| Network error | "Cannot reach Jira. Check your network connection." |

**Acceptance criteria:**
- No raw stack traces or HTTP status codes shown to user
- All errors display in a consistent UI component (toast or inline banner)

---

## CAT-4: Team Management

### F14 — Create team
**Priority:** Must have | **Complexity:** Low  
**Description:** Form at `/teams/new` to create a new team.

**Fields:**
- Team name (required)
- Jira project key / space (required) — e.g. `PROJ`
- GitHub repositories (optional, multi-value text input) — stored only, unused in v1.0

**Acceptance criteria:**
- Team is created and immediately appears in the sidebar teams list
- Duplicate team names are allowed (teams are identified by ID)
- Jira project key is not validated against Jira at creation time (validation happens when adding sprints)

---

### F15 — Add team member
**Priority:** Must have | **Complexity:** Low  
**Description:** Form at `/teams/[teamId]/members/new` to add a developer to a team.

**Fields:**
| Field | Type | Validation |
|---|---|---|
| Name | text | Required |
| Jira email | email | Required; used to match Jira assignee |
| GitHub username | text | Optional; stored only |
| Working days | 7 toggle buttons (Mon–Sun) | At least 1 day required |
| Default focus factor | number input | Required; 0–1 range |
| Specialization | checkboxes: Frontend, Backend | Optional; display only in v1.0 |

**Acceptance criteria:**
- Team selector dropdown pre-filled with active team from sidebar; user can change it
- Member saved and visible in team's member list
- Focus factor validates 0–1 range with clear error message if out of range
- Working days: all 7 days shown as toggleable buttons; any combination valid

**Edge cases:** What if jira_email doesn't match any Jira user? — Not validated at creation; mismatch will cause issues to not appear on dashboard (documented behavior).

---

### F16 — Team member list view
**Priority:** Must have | **Complexity:** Low  
**Description:** A page or section showing all members of the active team with their key attributes.

**Acceptance criteria:**
- Displays name, jira_email, working days, default focus factor, specialization badge
- Accessible from sidebar or team page

---

### F17 — Empty state: no team members
**Priority:** Must have | **Complexity:** Low  
**Description:** When a team has no members, pages that depend on members (calendar, sprint dashboard) show a prompt to add members first.

**Acceptance criteria:**
- Calendar shows "No team members yet. Add members to get started." with a link to add member form
- Sprint dashboard capacity table shows same prompt if team has no members

---

### F18 — Edit team member
**Priority:** Should have | **Complexity:** Low  
**Description:** Allow editing all fields of an existing team member.

**Acceptance criteria:**
- Changes to `default_focus_factor` do not affect existing `SprintFocusFactor` overrides
- Changes to `working_days` take effect immediately in capacity calculations for all sprints
- Edit form pre-filled with current values

---

### F19 — Delete team member
**Priority:** Should have | **Complexity:** Low  
**Description:** Allow deleting a team member from a team.

**Acceptance criteria:**
- Confirmation dialog before deletion ("This will remove [name] from all sprint data. Continue?")
- Associated `NonWorkingDay` records deleted on cascade
- Associated `SprintFocusFactor` records deleted on cascade
- Issues previously assigned to this member remain on sprint dashboards with a "[removed member]" label or are hidden — decision to be made before implementation

---

## CAT-5: Sprint Management

### F20 — Add sprint via Jira lookup
**Priority:** Must have | **Complexity:** Medium  
**Description:** Form at `/teams/[teamId]/sprints/new` where the user enters a sprint name and the system fetches metadata from Jira Cloud.

**Flow:**
1. User enters sprint name
2. System calls Jira API to find the sprint by name within the team's Jira project
3. System displays pulled dates (planned_start, planned_end, actual_end, activated_at) for user confirmation
4. User confirms → sprint saved to database

**Acceptance criteria:**
- Team selector dropdown pre-filled with active team; editable
- If sprint name not found in Jira: show "Sprint '[name]' not found in Jira. Check the name and try again."
- If multiple sprints match the name: show a list for the user to select from
- Dates shown to user before saving (no silent saves)

**Technical note:** Uses `GET /agile/1.0/board?projectKeyOrId={jira_space}` → `GET /agile/1.0/board/{boardId}/sprint` → match by name.

---

### F21 — Sprint list / selector
**Priority:** Must have | **Complexity:** Low  
**Description:** All sprints for the active team are accessible via a dropdown at the top of the sprint dashboard page, sorted by `planned_start` descending (most recent first).

**Acceptance criteria:**
- Selecting a sprint navigates to that sprint's dashboard
- Current sprint is visually indicated as selected
- Empty state shown if no sprints exist for the team: "No sprints yet. Add your first sprint."

---

### F22 — Empty state: no sprints
**Priority:** Must have | **Complexity:** Low  
**Description:** When the active team has no sprints, the sprint dashboard route shows a prompt to add the first sprint.

**Acceptance criteria:**
- Clear CTA linking to `/teams/[teamId]/sprints/new`

---

### F23 — Edit sprint
**Priority:** Should have | **Complexity:** Low  
**Description:** Allow re-syncing sprint metadata from Jira (e.g. if the sprint was closed after it was added to the tool).

**Acceptance criteria:**
- "Sync from Jira" button on sprint page re-fetches `planned_start`, `planned_end`, `actual_end`, and updates the record
- Does not overwrite any locally-edited data (focus factors)

---

### F24 — Delete sprint
**Priority:** Should have | **Complexity:** Low  
**Description:** Allow removing a sprint from the tool.

**Acceptance criteria:**
- Confirmation dialog before deletion
- Associated `SprintFocusFactor` records deleted on cascade
- Jira data is not affected

---

## CAT-6: Sprint Dashboard — Capacity

### F25 — Sprint header
**Priority:** Must have | **Complexity:** Low  
**Description:** Top section of the sprint dashboard showing sprint identity and status.

**Displays:**
- Sprint name
- `planned_start` — `planned_end`
- Actual end date (only if different from planned_end)
- OVERDUE badge (red) when `is_overdue = true`

**Overdue logic:**
```
is_overdue = (actual_end > planned_end) OR (actual_end is null AND today > planned_end)
```

**Acceptance criteria:**
- Actual end date not shown if sprint completed on time
- OVERDUE badge is red and visually prominent
- Day delta between planned and actual end shown alongside actual end date (e.g. "+3 days")

---

### F26 — Capacity table: planned columns
**Priority:** Must have | **Complexity:** Medium  
**Description:** Table with one row per team member showing planned capacity data.

**Columns (always visible):**
| Column | Value |
|---|---|
| Name + FE/BE badge | Display only |
| Planned working days | `working_days_in_range(member, planned_start, planned_end)` |
| Focus factor | Editable input (see F30) |
| Planned capacity | `planned_working_days × focus_factor` |

**Calculation — working_days_in_range:**
```
days = dates in range where weekday ∈ member.working_days
for each NonWorkingDay in range: days -= (half_day ? 0.5 : 1.0)
return days
```

**Acceptance criteria:**
- Table recalculates immediately when a NonWorkingDay is added/removed
- Planned capacity shown to 1 decimal place
- Members ordered consistently (alphabetical by name)

---

### F27 — Capacity table: overdue columns
**Priority:** Must have | **Complexity:** Medium  
**Description:** When a sprint is overdue, two additional columns appear in the capacity table.

**Additional columns (overdue only):**
| Column | Value |
|---|---|
| Actual working days | `working_days_in_range(member, planned_start, actual_end_date)` |
| Actual capacity | `actual_working_days × focus_factor` |

**actual_end_date logic:**
```
if sprint.actual_end is not null → sprint.actual_end
elif today > sprint.planned_end → today (live, updates on page refresh)
else → sprint.planned_end
```

**Acceptance criteria:**
- Columns only appear when `is_overdue = true`
- For active overdue sprints: actual capacity reflects today's date (not a stale value)
- Columns clearly labeled to distinguish from planned

---

### F28 — Team capacity totals
**Priority:** Must have | **Complexity:** Low  
**Description:** Summary row below the capacity table showing aggregate team capacity.

**Displays:**
- Total planned capacity (sum of all members' planned capacity)
- Total actual capacity (sum of all members' actual capacity) — overdue sprints only

**Acceptance criteria:**
- Totals update when any individual focus factor is changed
- Totals update when non-working days are added/removed

---

### F29 — Loading skeleton for sprint dashboard
**Priority:** Must have | **Complexity:** Low  
**Description:** While Jira data is being fetched, the sprint dashboard shows a skeleton loader in place of the issue tables. The capacity table (calculated locally) renders immediately without waiting for Jira.

**Acceptance criteria:**
- Capacity table renders before Jira data returns
- Issue tables area shows skeleton rows (not a blank page or spinner overlay)
- Skeleton is dismissed once Jira data loads or an error is returned

---

### F30 — Per-sprint focus factor override
**Priority:** Should have | **Complexity:** Low  
**Description:** The focus factor input in the capacity table is editable per sprint. Changing it creates or updates a `SprintFocusFactor` record without touching `TeamMember.default_focus_factor`.

**Acceptance criteria:**
- Input pre-filled with `SprintFocusFactor` if it exists, else `member.default_focus_factor`
- Change persists on blur/enter (auto-save, no separate save button)
- Planned and actual capacity columns recalculate immediately on change
- Value validates 0–1 range inline

---

### F31 — Total team capacity summary
**Priority:** Should have | **Complexity:** Low  
**Description:** *(Included in F28 above — merged for clarity)*

---

### F32 — Manual Jira refresh button
**Priority:** Should have | **Complexity:** Low  
**Description:** A "Refresh" button on the sprint dashboard that re-fetches sprint issue data from Jira on demand, bypassing the cache.

**Acceptance criteria:**
- Button visible in sprint dashboard header area
- On click: show loading state, invalidate cache for this sprint, re-fetch from Jira
- On success: issue tables update with fresh data
- On failure: show error banner with cached data timestamp (see F13)

---

## CAT-7: Sprint Dashboard — Issues

### F33 — Issue data pipeline
**Priority:** Must have | **Complexity:** High  
**Description:** Fetches sprint issues from Jira and processes them through a multi-step pipeline to produce the final per-developer issue tables.

**Pipeline steps:**
1. Fetch all sprint issues: key, summary, url, assignee, priority, changelog
2. Remove issues with no assignee
3. If sprint is closed: filter changelog entries to `timestamp <= sprint.actual_end`
4. Extract per issue: `last_assignee`, `last_story_points`, `last_status`, `planned/unplanned label`
5. Remove issues where `last_assignee.email` does not match any `TeamMember.jira_email`
6. Group by `last_assignee`
7. Sort each group by Jira priority: Highest → High → Medium → Low → Lowest

**Acceptance criteria:**
- Issues without assignee never appear in any table
- Issues assigned to non-team-members never appear
- For closed sprints: status and story points reflect state at sprint close, not current Jira state
- For active sprints: status and story points reflect current Jira state

**Technical note:** Story points field read from `Settings.story_points_field_id` (default `story_points`). If field not found on issue, show `—` in story points column.

---

### F34 — Per-developer issue table header
**Priority:** Must have | **Complexity:** Low  
**Description:** Each developer's issue section is preceded by a header row summarizing their sprint data.

**Displays:**
- Developer name
- `total_SP / actual_capacity` — sum of all assigned issue story points vs. capacity
- Absence breakdown: `N holiday / N vacation / N sickleave` days within sprint date range

**Acceptance criteria:**
- `total_SP` is the sum of `last_story_points` for all issues in this developer's group
- Absence counts reflect NonWorkingDay records within `[planned_start, actual_end_date]`
- Shows `0 holiday / 0 vacation / 0 sickleave` when no absences recorded (not hidden)

---

### F35 — Issue table row
**Priority:** Must have | **Complexity:** Low  
**Description:** Each row in a developer's issue table represents one Jira issue.

**Columns:**
| Column | Description |
|---|---|
| Key | e.g. `PROJECT-123`. Clickable — opens Jira issue in new tab |
| Title | Issue summary. Clickable — opens Jira issue in new tab |
| Label | `planned` or `unplanned` pill badge |
| Story points | `last_story_points` from filtered changelog; `—` if not set |
| Status | `last_status` from filtered changelog |

**Acceptance criteria:**
- Both key and title link to the correct Jira issue URL
- Links open in a new tab
- `planned` badge visually distinct from `unplanned` badge (different color or style)

---

### F36 — Planned / unplanned label logic
**Priority:** Must have | **Complexity:** Medium  
**Description:** Each issue is labeled based on when it was added to the sprint relative to the sprint's activation time.

```
label = "planned" if added_to_sprint_at <= sprint.activated_at
label = "unplanned" if added_to_sprint_at > sprint.activated_at
```

`activated_at` = `sprint.activatedDate` from Jira sprint metadata (timestamp when sprint transitioned to Active).

**Acceptance criteria:**
- All issues have a label (no issue without planned/unplanned)
- If `activated_at` is null (edge case): treat all issues as planned and log a warning

---

### F37 — Issue table sorting
**Priority:** Must have | **Complexity:** Low  
**Description:** Issues within each developer's table are sorted by Jira priority.

**Sort order:** Highest → High → Medium → Low → Lowest → (no priority set)

**Acceptance criteria:**
- Issues with no priority set appear at the bottom of the group
- Sort is stable (issues with same priority maintain consistent order)

---

### F38 — Jira data cache with stale indicator
**Priority:** Must have | **Complexity:** Medium  
**Description:** Jira issue data is cached in PostgreSQL per sprint after each successful fetch. If Jira is unavailable on a subsequent load, cached data is shown with a staleness timestamp.

**Acceptance criteria:**
- Cache stores raw Jira response or processed issue data per sprint with a `fetched_at` timestamp
- If Jira fetch fails and cache exists: show banner "Showing cached data from [fetched_at timestamp]" + Retry button
- If Jira fetch fails and no cache exists: show error state "No data available. Could not connect to Jira." + Retry button
- Successful fetch updates the cache and dismisses the stale banner

---

### F39 — Error state: Jira fetch failure on issue tables
**Priority:** Must have | **Complexity:** Low  
**Description:** When Jira data cannot be fetched and no cache is available, the issue tables area shows a clear error state instead of a blank section.

**Acceptance criteria:**
- Error message is human-readable (maps from F13 error table)
- Retry button re-triggers the fetch without a full page reload
- Capacity table still renders (it does not depend on Jira data)

---

## CAT-8: Calendar & Non-Working Days

### F40 — Calendar 3-month view
**Priority:** Must have | **Complexity:** Medium  
**Description:** Calendar tab (`/teams/[teamId]/calendar`) displaying three consecutive months with navigation.

**Display:**
- Default view: previous month, current month, next month
- Back / Forward buttons navigate by one month at a time
- Sprint date ranges shown as colored horizontal bands across days
- Days beyond a sprint's `planned_end` that fall within an overdue sprint's actual range are highlighted red

**Acceptance criteria:**
- Correct month boundaries shown
- Sprint bands span correct date range
- Overdue day highlighting only applies to sprints where `is_overdue = true`
- Multiple overlapping sprints: bands stack or use distinct colors

---

### F41 — Non-working day indicators on calendar
**Priority:** Must have | **Complexity:** Low  
**Description:** Days that have at least one NonWorkingDay record (for any team member) are marked with a cross (×) icon.

**Acceptance criteria:**
- Cross visible on day cell when any team member has a NonWorkingDay on that date
- Cross reflects the active member filter (F45) — only shown if at least one filtered member has a record
- Cross is not shown for dates with no records

---

### F42 — Non-working day tooltip
**Priority:** Must have | **Complexity:** Low  
**Description:** Hovering over a day's cross icon shows a tooltip listing which team members have a non-working day record and why.

**Format:** `[Member name] — [type]` per line, e.g.:
```
Alice — vacation
Bob — sickleave (half day)
```

**Acceptance criteria:**
- Tooltip lists all members with records on that day (filtered by member filter if active)
- Half-day records indicated in tooltip
- Tooltip dismisses on mouse-out

---

### F43 — Add non-working day popup
**Priority:** Must have | **Complexity:** Medium  
**Description:** Clicking any day on the calendar opens a popup to add a non-working day event.

**Fields:**
| Field | Type | Details |
|---|---|---|
| Type | dropdown | holiday / vacation / sickleave |
| Team members | multi-select | All team members; at least 1 required |
| Half day | checkbox | Checked = 0.5 day deducted; unchecked = 1.0 day |

**Buttons:** Save, Cancel

**Validation:**
- If any selected member already has a NonWorkingDay on this date: block save and show inline error per conflicting member (e.g. "Alice already has a record on this date")
- At least one member must be selected

**Acceptance criteria:**
- Popup opens on day click anywhere on the calendar
- Pre-fills the date from the clicked cell (not editable in popup)
- On save: cross indicator appears on that day; capacity recalculates on sprint dashboard
- On cancel: no changes made

---

### F44 — Non-working day affects capacity calculation
**Priority:** Must have | **Complexity:** Low  
**Description:** Adding a NonWorkingDay record for a team member reduces their capacity on any sprint that overlaps that date.

**Calculation:**
- Full day: `−1.0` from working days count
- Half day: `−0.5` from working days count

**Acceptance criteria:**
- Sprint dashboard capacity updates reflect new NonWorkingDay records without requiring a page reload
- Records outside the sprint date range have no effect on that sprint's capacity

---

### F45 — Empty state: no team members on calendar
**Priority:** Must have | **Complexity:** Low  
**Description:** If the active team has no members, the calendar shows a prompt instead of an empty calendar with no context.

**Acceptance criteria:**
- Message: "No team members yet. Add members to track their availability."
- CTA links to add member form

---

### F46 — Calendar member filter
**Priority:** Should have | **Complexity:** Low  
**Description:** A row of toggle buttons above the calendar — one per team member. Activating/deactivating a member filters the cross indicators and tooltips to show only the selected members' records.

**Acceptance criteria:**
- All members selected by default
- Toggling a member off hides their records from cross indicators and tooltips
- If a day has records only for deselected members, the cross icon is hidden
- Filter state resets on page reload (not persisted)

---

### F47 — Edit non-working day record
**Priority:** Should have | **Complexity:** Low  
**Description:** Allow editing an existing NonWorkingDay record (change type or half-day status).

**Acceptance criteria:**
- Accessible from calendar tooltip or a dedicated management view
- Edit form pre-filled with current values
- Cannot change the date or member of an existing record (delete and re-add instead)

---

### F48 — Delete non-working day record
**Priority:** Should have | **Complexity:** Low  

*(Note: F31 ID reused; renumbering: this is F38 in sequence — see summary table for corrected count)*

**Description:** Allow deleting a NonWorkingDay record.

**Acceptance criteria:**
- Accessible from calendar tooltip or management view
- Confirmation required before deletion
- Cross indicator removed from calendar immediately
- Capacity recalculates on affected sprint dashboards

---

## CAT-9: Out of Scope — v1.0

These features are explicitly excluded from v1.0. They are documented here for future planning.

| ID | Feature | Reason deferred |
|---|---|---|
| F43 | GitHub repository integration | Infrastructure not ready; field stored in DB for future use |
| F44 | FE/BE specialization in calculations | Badge displayed; logic deferred to v2 |
| F45 | User authentication and roles | Internal tool on trusted network; not needed in v1.0 |
| F46 | Multi-tenancy / multi-company | Single internal deployment only |
| F47 | Report export (PDF, CSV) | Nice-to-have; manual screenshotting acceptable for now |
| F48 | Notifications and alerts | No defined trigger conditions yet |

---

## Dependency Map

```
F01 (Docker) ──────────────────────────────────────────┐
F02 (Env vars) ────────────────────────────────────────┤
F03 (Migrations) ──► F04 (Schema) ─────────────────────┤
                                                        ▼
F10 (Settings) ──► F11 (Jira validation) ──► F20 (Add sprint)
                                                        │
F14 (Create team) ──► F15 (Add member) ────────────────┤
                                │                       ▼
                                └──────────────► F26 (Capacity table)
                                                        │
F43 (Add non-working day) ─────────────────────────────┤
                                                        ▼
F33 (Issue pipeline) ──► F34/F35/F36/F37 (Issue tables)
```

**Critical path for MVP (P0 in build order):**
F01 → F02 → F03 → F04 → F10 → F11 → F14 → F15 → F20 → F25 → F26 → F27 → F28 → F33 → F40 → F43

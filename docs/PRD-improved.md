# PRD: Team Sprint Monitor (Improved)

**Version:** 1.1  
**Date:** 2025  
**Status:** Ready for Implementation

---

## Gap Analysis & Review Findings

### Critical Gaps Identified

| Impact | Area | Gap |
|---|---|---|
| High | Technical | No Docker / container setup details — environment variables, port mapping, volume config not specified |
| High | Implementation | No empty state definitions — first-run experience and zero-data states not described |
| High | Technical | Jira story points field name not standardized — custom field ID varies per Jira instance (`customfield_10016` is common but not universal) |
| Medium | UX | No loading states defined — Jira API calls can be slow; no skeleton/spinner behavior specified |
| Medium | UX | No error states for forms — what happens if sprint name not found in Jira? |
| Medium | Functional | Edit and delete operations missing — members and non-working days have no defined edit/delete behavior |
| Medium | Technical | No data persistence strategy for Jira responses — caching mechanism referenced but not specified |
| Low | Business | No definition of "done" for each phase — single-evening timeline needs clearer sequencing |

### Overall Assessment

The PRD is well-structured with strong functional coverage and unusually precise business rules (pseudo-code for capacity calculations is implementation-ready). The main gaps are at the implementation edges: empty states, error handling, and Docker configuration are under-specified for a developer picking this up cold. The Jira story points field ambiguity is a real integration risk that could block the sprint dashboard entirely if not resolved early.

### Quality Scores (original PRD)

| Dimension | Score | Rationale |
|---|---|---|
| Completeness | 7/10 | Core flows covered; Docker, empty states, error flows missing |
| Clarity | 8/10 | Business rules in pseudo-code are excellent; some UI states ambiguous |
| Feasibility | 7/10 | Single-evening timeline is aggressive; Jira field ambiguity is a risk |
| User-Focus | 8/10 | Strong persona and journey coverage; no error recovery journeys |

---

## Overview

Team Sprint Monitor is an internal web tool for tracking development team productivity. It integrates with Jira Cloud and gives team leads and engineering managers a real-time view of each developer's capacity, sprint workload, and schedule deviations — without manually aggregating data in spreadsheets.

**Problem statement:** Before each sprint, team leads manually calculate capacity by cross-referencing individual work schedules, vacation calendars, and Jira data — a process that takes ~30 minutes, is error-prone, and must be repeated every 1–2 weeks.

**Core value proposition:** Replace manual capacity calculations with an automated dashboard that accounts for individual work schedules (including non-standard weeks like Sun–Thu), vacations, sick leave, and each developer's focus factor.

---

## Goals and Objectives

| # | Goal | Success Metric |
|---|---|---|
| 1 | Eliminate manual capacity calculation before each sprint | Time to prepare a capacity plan < 5 minutes |
| 2 | Provide visibility into sprint schedule deviations | Team lead sees overdue status and actual capacity without asking the team |
| 3 | Centralize the team's non-working day calendar | Zero discrepancies between actual absences and what is reflected in capacity |
| 4 | Ship a working MVP in a single development session | All P0 functional requirements deployed and usable |

---

## Scope

### In scope — v1.0

- Team and team member management (create; edit and delete as P1)
- Individual work schedule configuration (any days of the week, e.g. Sun–Thu)
- Non-working day calendar (holiday / vacation / sickleave, half-day support)
- Sprint creation with automatic metadata pull from Jira Cloud
- Sprint dashboard: capacity table and per-developer issue tables
- Automatic overdue sprint detection
- Issue and status filtering via Jira changelog within the sprint window
- Global settings: Jira API key, Jira domain, Jira story points field ID
- Dark theme only, collapsible sidebar, multi-team navigation
- Docker Compose setup: Next.js app + PostgreSQL

### Out of scope — v1.0

- GitHub integration (field stored, no functionality)
- FE/BE specialization in calculations (badge displayed, no logic)
- User authentication and roles
- Multi-tenancy / multi-company support
- Report export (PDF, CSV)
- Notifications and alerts
- Mobile version

---

## User Personas

### Primary: Team Lead / Engineering Manager

**Context:** Manages 1–3 development teams, runs sprint planning every 1–2 weeks, is accountable for delivering sprints on time.

**Technical comfort:** Comfortable with Jira and internal tools; not a developer. Will not troubleshoot broken integrations — errors must be self-explanatory.

**Pain points:**
- Manually calculates each developer's available days accounting for vacations and holidays before every sprint
- Has no quick way to see whether a sprint is at risk of overrunning
- Absence data is scattered across Slack, HR systems, and personal memory

**Goals when using the tool:**
- Before sprint: quickly get the real capacity of each developer
- During sprint: monitor workload and current task status
- After sprint: understand why a sprint overran and by how much

---

## Functional Requirements

### P0 — Must have (blocks launch)

**Team setup**
- Create a team with a name and Jira project key
- Add team members: name, jira_email, working days (any subset of Mon–Sun), focus factor
- Sidebar with team switcher (one button per team)
- Empty state on first load: prompt to configure Settings, then create a team

**Sprints**
- Add a sprint by name → system searches Jira and pulls dates; show error if sprint not found
- Sprint dashboard with capacity table
- Automatic planned capacity calculation (working days × focus factor)
- Overdue detection; display actual capacity when sprint is overdue
- Empty state when no sprints added yet: prompt to add first sprint

**Sprint issues**
- Fetch issues from Jira including changelog
- Filter issues to team members only (matched by jira_email)
- Filter changelog to sprint window for closed sprints
- Display: key, title, planned/unplanned label, story points, status
- Sort by Jira priority (Highest → High → Medium → Low → Lowest)
- Loading skeleton while Jira data is being fetched
- Error state if Jira fetch fails: show message + retry button

**Calendar**
- Display 3 months with back/forward navigation
- Add non-working days via popup (type, multi-select members, half day checkbox)
- Show sprint ranges on calendar; highlight overdue days in red
- Empty state when no team members exist: prompt to add members first

**Settings**
- Save Jira API key, Jira domain, and story points field ID (default: `story_points`; allow override to custom field ID such as `customfield_10016`)
- Validate Jira connection on save: show success or error feedback

### P1 — Should have

- Edit and delete team members
- Edit and delete non-working day records
- Team member filter on the calendar
- Tooltip with non-working day details on hover
- Sprint selector dropdown on the sprint dashboard page
- Per-sprint focus factor override (without changing the member default)
- Total team capacity summary below the capacity table
- Manual "Refresh" button on sprint dashboard to re-fetch Jira data

### P2 — Nice to have (future iterations)

- GitHub integration
- FE/BE filtering and analytics by specialization
- Dashboard export
- Cross-sprint comparison

---

## Non-Functional Requirements

**Performance**
- Sprint dashboard loads in < 3 seconds for up to 200 issues
- Jira API requests are executed asynchronously; UI shows loading skeleton, never blocks
- Jira responses cached in PostgreSQL per sprint; cache invalidated on manual refresh or when sprint status changes

**Security**
- Jira API key stored encrypted in the database (AES-256 or equivalent — not plain text)
- Tool deployed on the company's internal network; no public access assumed
- No authentication in v1.0 (internal tool, trusted network)

**Reliability**
- If Jira API is unavailable, show last cached data with timestamp indicating staleness
- All Jira API errors surface as human-readable messages (e.g. "Sprint not found in Jira" not a 404 stack trace)
- Prisma migrations run automatically on container startup via `prisma migrate deploy`

**Scalability**
- Supports up to 10 teams, 20 members per team, 50 sprints per team in v1.0

**Technical constraints**
- TypeScript + Next.js (App Router) + React + Tailwind CSS
- shadcn/ui, dark theme only — `class="dark"` set globally on `<html>`, never removed, no theme toggle
- TanStack Table for issue tables, react-day-picker for calendar
- PostgreSQL + Prisma ORM
- Jira Cloud REST API v3 (Basic auth: `email:api_key` base64-encoded)
- Docker + Docker Compose — `docker compose up` starts the full stack

---

## Docker & Infrastructure

### docker-compose.yml services

| Service | Image | Details |
|---|---|---|
| `app` | Custom Dockerfile (Node 20 Alpine) | Next.js app on port 3000; depends on `db` |
| `db` | `postgres:16-alpine` | Port 5432; named volume for data persistence |

### Environment variables (`.env`)

| Variable | Example | Required |
|---|---|---|
| `POSTGRES_URL` | `postgresql://user:pass@db:5432/sprint_monitor` | Yes |
| `ENCRYPTION_KEY` | 32-byte hex string | Yes — for Jira API key encryption |

### Startup sequence

1. `db` container starts and becomes healthy
2. `app` container starts; runs `prisma migrate deploy` before Next.js server
3. App available at `http://localhost:3000`

---

## Business Rules

### Working Days Calculation

```
working_days_in_range(member, start, end):
  days = all dates in [start, end] where date.weekday in member.working_days
  for each NonWorkingDay record for this member in [start, end]:
    if half_day: days -= 0.5
    else: days -= 1
  return days
```

### Capacity Calculation

```
planned_capacity(member, sprint):
  days = working_days_in_range(member, sprint.planned_start, sprint.planned_end)
  return days × focus_factor(member, sprint)

actual_capacity(member, sprint):
  days = working_days_in_range(member, sprint.planned_start, actual_end_date(sprint))
  return days × focus_factor(member, sprint)

focus_factor(member, sprint):
  return SprintFocusFactor(sprint, member) ?? member.default_focus_factor
```

### Actual End Date

```
actual_end_date(sprint):
  if sprint.actual_end is not null:
    return sprint.actual_end           -- sprint closed in Jira
  elif today > sprint.planned_end:
    return today                       -- overdue active sprint, updates live
  else:
    return sprint.planned_end          -- active sprint within plan
```

### Overdue Detection

```
is_overdue(sprint):
  return (sprint.actual_end is not null AND sprint.actual_end > sprint.planned_end)
      OR (sprint.actual_end is null AND today > sprint.planned_end)
```

### Changelog Filtering

```
filtered_changelog(issue, sprint):
  if sprint.actual_end is not null:
    return changelog entries where timestamp <= sprint.actual_end
  else:
    return all changelog entries
```

Purpose: capture the state of the issue at sprint close, not the current state.
Example: issue was In Review at sprint close, moved to Done in next sprint → shows In Review for this sprint.

### Issue Assignment

```
assignee_for_sprint(issue, sprint):
  changelog = filtered_changelog(issue, sprint)
  return last assignee change in changelog, or original assignee if no changes
```

### Planned vs Unplanned Label

```
label(issue, sprint):
  added_to_sprint_at = timestamp when issue was added to sprint (from changelog)
  if added_to_sprint_at <= sprint.activated_at:
    return "planned"
  else:
    return "unplanned"

sprint.activated_at = timestamp when sprint transitioned to Active in Jira Cloud
```

---

## User Journeys

### Journey 1: First-time setup

1. App opens → empty state screen: "Configure your Jira connection to get started" → link to Settings
2. Settings → enter Jira domain, Jira API key, story points field ID → save → system validates connection → show success or error
3. Sidebar → "Add team" → enter name and Jira project key → save
4. Sidebar → "Add team member" → fill in details, select working days, set focus factor → save (repeat per member)
5. Sidebar → "Add sprint" → enter sprint name → system finds sprint in Jira and shows pulled dates for confirmation → save

### Journey 2: Sprint planning

1. Navigate to the sprint dashboard
2. See loading skeleton while Jira data fetches
3. Review the capacity table: check working days and focus factors per developer
4. Adjust focus factor for a specific developer for this sprint if needed
5. Open Calendar → mark planned vacations or holidays via the popup
6. Return to the dashboard → capacity is recalculated automatically

### Journey 3: Completed sprint review

1. Open a closed sprint's dashboard
2. If overdue → see red OVERDUE badge, actual end date, and day delta from plan
3. Review per-developer issue tables: planned/unplanned labels, final statuses, story points
4. Compare `total_SP / actual_capacity` per developer to assess workload distribution

### Journey 4: Active sprint monitoring

1. Open an active sprint's dashboard
2. If today exceeds planned_end → see OVERDUE badge, actual capacity updated to today
3. Review current issue statuses (changelog not filtered for active sprints)
4. Click "Refresh" to re-fetch latest data from Jira

### Journey 5: Jira fetch failure

1. Open sprint dashboard → Jira API returns error
2. See human-readable error banner: "Could not connect to Jira. Showing data from [timestamp]."
3. Cached data (if available) is still displayed; retry button visible in banner

---

## Success Metrics

| Metric | Baseline | Target after 1 month of use |
|---|---|---|
| Time to prepare capacity before a sprint | ~30 min (manual) | < 5 min |
| Capacity errors caused by untracked absences | Occurred regularly | 0 |
| Tool adoption | — | Used for every new sprint |
| Dashboard loads without Jira API errors | — | > 95% of sessions |

---

## Timeline

**Target: single development session (one evening)**

Recommended build sequence to maximize what works end-to-end fastest:

| Phase | Scope | Exit Criteria |
|---|---|---|
| 1 — Foundation | Docker Compose setup, DB schema + Prisma migrations, Settings page with Jira connection validation | `docker compose up` works; Jira API key saves and validates |
| 2 — Team & members | Team creation, member creation with working days, sidebar navigation | Can create a team and add members; sidebar switches context |
| 3 — Sprints & dashboard | Sprint import from Jira, capacity table, overdue logic | Sprint dashboard shows correct capacity for at least one real sprint |
| 4 — Issues & calendar | Issue tables with changelog filtering, non-working day calendar | Full sprint dashboard functional; non-working days affect capacity |

---

## Open Questions / Decisions Required Before Build

| # | Question | Recommended Default |
|---|---|---|
| 1 | What is the story points field ID in this Jira instance? (`story_points` vs `customfield_10016` vs other) | Make it configurable in Settings; default to `story_points` |
| 2 | Should sprint dates be stored and compared in UTC or local time? | UTC throughout; display in local time via browser |
| 3 | Should non-working day records be editable/deletable in v1.0? | Yes — add to P1 (included above) |
| 4 | Manual Jira refresh: button on dashboard, or automatic polling? | Manual button (included in P1); polling adds complexity |
| 5 | What `ENCRYPTION_KEY` rotation strategy is needed? | Out of scope v1.0; document as known gap |

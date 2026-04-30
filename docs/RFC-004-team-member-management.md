# RFC-004: Team and Member Management

**Status:** Ready for implementation  
**Complexity:** Low  
**Builds upon:** RFC-001, RFC-002  
**Required by:** RFC-005, RFC-006, RFC-007

---

## Summary

Implements the full CRUD for teams and team members: create team form, add member form with working-day toggles and focus factor input, member list view, and the API routes that back them. This RFC provides the core data entities that sprint capacity calculations (RFC-006) and issue tables (RFC-007) depend on.

---

## Features Covered

- F14 — Create team
- F15 — Add team member
- F16 — Team member list view
- F17 — Empty state: no team members
- F18 — Edit team member (P1, included here since forms are already being built)
- F19 — Delete team member (P1)

---

## File Structure to Create

```
app/
├── teams/
│   ├── new/
│   │   └── page.tsx
│   └── [teamId]/
│       ├── page.tsx              # Redirects to /sprints sub-route
│       ├── members/
│       │   ├── page.tsx          # Member list
│       │   └── new/
│       │       └── page.tsx
│       └── members/
│           └── [memberId]/
│               └── edit/
│                   └── page.tsx
components/
├── teams/
│   ├── create-team-form.tsx
│   ├── team-member-form.tsx      # Used for both create and edit
│   ├── team-member-list.tsx
│   ├── team-member-card.tsx
│   └── working-days-toggle.tsx   # 7-button day selector
app/
└── api/
    ├── teams/
    │   └── route.ts              # POST /api/teams
    └── teams/
        └── [teamId]/
            ├── route.ts          # GET (team detail)
            └── members/
                ├── route.ts      # GET (list) + POST (create)
                └── [memberId]/
                    └── route.ts  # PUT (update) + DELETE
```

---

## Technical Specifications

### API Routes

**POST /api/teams**

Request body (zod):
```typescript
{
  name: string;           // required, min 1 char
  jiraSpace: string;      // required, min 1 char, trimmed
  githubRepositories?: string[];
}
```
Response: `{ data: { id: string; name: string } }` with status `201`.

---

**GET /api/teams/[teamId]/members**

Response:
```typescript
{
  data: Array<{
    id: string;
    name: string;
    jiraEmail: string;
    githubUsername: string;
    workingDays: WeekDay[];
    defaultFocusFactor: number;
    specialization: Specialization | null;
  }>
}
```

---

**POST /api/teams/[teamId]/members**

Request body (zod):
```typescript
{
  name: string;                    // required
  jiraEmail: string;               // required, valid email
  githubUsername?: string;
  workingDays: WeekDay[];          // required, min 1 day
  defaultFocusFactor: number;      // required, 0 < value <= 1
  specialization?: Specialization;
}
```
Response: `{ data: TeamMember }` with status `201`.

---

**PUT /api/teams/[teamId]/members/[memberId]**

Same body as POST but all fields optional (partial update). Returns `{ data: TeamMember }`.

Important: changing `defaultFocusFactor` must NOT update any existing `SprintFocusFactor` records — those are sprint-specific overrides.

---

**DELETE /api/teams/[teamId]/members/[memberId]**

No body. Returns `{ data: { deleted: true } }` with status `200`.

Cascade deletes (handled by Prisma `onDelete: Cascade` from RFC-001 schema):
- `NonWorkingDay` records for this member
- `SprintFocusFactor` records for this member

---

### components/teams/working-days-toggle.tsx

Controlled component. Props:
```typescript
interface WorkingDaysToggleProps {
  value: WeekDay[];
  onChange: (days: WeekDay[]) => void;
  error?: string;
}
```

Renders 7 buttons in a row: `Mon Tue Wed Thu Fri Sat Sun`. Each button toggles the day in/out of the selected array. Selected state: `bg-primary text-primary-foreground`. Unselected: `bg-secondary text-secondary-foreground`. At least 1 day must be selected (validate on form submit, not on toggle).

### components/teams/team-member-form.tsx

Used for both create (`/members/new`) and edit (`/members/[memberId]/edit`). Accepts `initialValues` prop — undefined for create, populated for edit.

Fields in order:
1. Name (Input)
2. Jira email (Input, type="email")
3. Working days (WorkingDaysToggle)
4. Default focus factor (Input, type="number", step="0.01", min="0", max="1", placeholder="0.8")
5. GitHub username (Input, optional)
6. Specialization (two Checkboxes: Frontend, Backend — both unchecked = null)
7. Team selector (Select dropdown, pre-filled with `teamId` from URL params, options = all teams)

**Validation (zod, same rules as API):**
- Name: required
- Jira email: valid email format
- Working days: at least 1 day selected
- Focus factor: number between 0 (exclusive) and 1 (inclusive); display error "Must be between 0 and 1"

On submit: POST or PUT to appropriate API route. On success: redirect to `/teams/[teamId]/members`.

### components/teams/create-team-form.tsx

Simple form. Fields: name (Input), Jira space / project key (Input), GitHub repositories (optional, comma-separated text input parsed into array on submit).

On success: redirect to `/teams/[newTeamId]/members/new` to immediately prompt adding the first member.

### app/teams/[teamId]/members/page.tsx — member list

Server Component. Fetches members for the team. If empty → renders `<EmptyState>` with CTA to add first member. If members exist → renders `<TeamMemberList>`.

```typescript
// Empty state copy
title="No team members yet"
description="Add team members to start tracking sprint capacity."
actionLabel="Add first member"
actionHref={`/teams/${teamId}/members/new`}
```

### components/teams/team-member-card.tsx

Card per member showing: name, jiraEmail, working days as day-pills, focus factor, specialization badge. Action buttons: Edit (→ edit page), Delete (confirmation dialog then DELETE API call).

Delete confirmation uses shadcn/ui `AlertDialog`:
> "Remove [name] from the team? This will also remove their non-working day records. This cannot be undone."

Buttons: "Cancel" / "Remove member" (destructive variant).

---

## shadcn/ui Components to Install

```bash
npx shadcn@latest add select checkbox alert-dialog badge
```

---

## Acceptance Criteria

- [ ] POST `/api/teams` creates a team and it appears in sidebar immediately (sidebar refetches on navigation)
- [ ] POST `/api/teams/[teamId]/members` creates a member with all fields saved correctly
- [ ] `workingDays` array stored correctly in PostgreSQL (Prisma enum array)
- [ ] `defaultFocusFactor` rejects values outside 0–1 at API level (400 response)
- [ ] At least 1 working day required — API returns 400 if empty array sent
- [ ] Working days toggle shows all 7 days; any subset is valid
- [ ] Team selector in member form pre-fills from URL `teamId`; changing team changes the POST destination
- [ ] Editing a member does not affect existing `SprintFocusFactor` records
- [ ] Deleting a member cascades to `NonWorkingDay` and `SprintFocusFactor` records
- [ ] Delete confirmation dialog shown before any DELETE call
- [ ] Member list shows empty state with CTA when team has no members
- [ ] Creating a team redirects to add-first-member page
- [ ] `jiraEmail` stored as lowercase (normalize on save)
- [ ] `jiraSpace` stored as uppercase (normalize on save — Jira project keys are uppercase)

---

## Edge Cases

- Duplicate `jiraEmail` within the same team: currently not blocked at DB level (no unique constraint on `(teamId, jiraEmail)`). If two members have the same email, issues will be attributed to both — document this as a known limitation.
- `defaultFocusFactor` submitted as `0`: reject with "Must be greater than 0" (a developer with 0 focus factor has no capacity, which is a configuration error)
- GitHub repositories field submitted as empty string: save as empty array `[]`
- Deleting the only member of a team: allowed; team remains with 0 members

---

## Data Notes

- `jiraEmail` comparison against Jira assignee emails is **case-insensitive** (normalize to lowercase on save and compare with `.toLowerCase()` in the issue pipeline)
- `jiraSpace` is the Jira project key (e.g. `PROJ`, `TEAM`). Normalize to uppercase on save.

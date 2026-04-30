# RFC-006: Calendar and Non-Working Days

**Status:** Ready for implementation  
**Complexity:** Medium  
**Builds upon:** RFC-001, RFC-002, RFC-004, RFC-005  
**Required by:** RFC-007 (absence summary in issue table headers uses NonWorkingDay data)

---

## Summary

Implements the calendar tab: 3-month view with sprint band overlays, non-working day cross indicators with tooltips, the add/edit/delete non-working day popup, and the team member filter. NonWorkingDay records created here affect capacity calculations in RFC-005 and absence summaries in RFC-007.

---

## Features Covered

- F40 — Calendar 3-month view with sprint bands
- F41 — Non-working day cross indicators
- F42 — Non-working day tooltip on hover
- F43 — Add non-working day popup
- F44 — Non-working day affects capacity calculation (data side — calculation is in RFC-005's `lib/capacity.ts`)
- F45 — Empty state: no team members on calendar
- F46 — Calendar member filter (P1)
- F47 — Edit non-working day record (P1)
- F48 — Delete non-working day record (P1)

---

## File Structure to Create

```
app/
└── teams/
    └── [teamId]/
        └── calendar/
            └── page.tsx
components/
└── calendar/
    ├── team-calendar.tsx           # Main calendar client component
    ├── calendar-month.tsx          # Single month grid
    ├── calendar-day-cell.tsx       # Individual day cell
    ├── sprint-band.tsx             # Sprint range overlay
    ├── non-working-day-popup.tsx   # Add/edit popup (shadcn Dialog)
    ├── non-working-day-tooltip.tsx # Hover tooltip content
    └── member-filter-bar.tsx       # Toggle buttons above calendar
app/
└── api/
    └── teams/
        └── [teamId]/
            └── non-working-days/
                ├── route.ts        # GET (list) + POST (create)
                └── [id]/
                    └── route.ts    # PUT (update) + DELETE
```

---

## Technical Specifications

### Calendar page: app/teams/[teamId]/calendar/page.tsx

Server Component. Fetches:
- All team members (for filter bar and popup multi-select)
- All sprints for the team (for band display)
- Non-working days for the currently displayed range (3 months centered on today)

Passes data to `<TeamCalendar>` (Client Component) which handles navigation and filter state.

### components/calendar/team-calendar.tsx

Client Component. Manages:
- `currentMonth: Date` state (default: current month, so 3-month view shows prev/current/next)
- `selectedMemberIds: string[]` state (default: all member IDs)
- `popupState: { open: boolean; date: Date | null; editRecord: NonWorkingDay | null }`

Layout:
```
[Member filter bar]
[← Back]  [Forward →]
[Month 1] [Month 2] [Month 3]
[Non-working day popup (Dialog)]
```

On navigation: calls `/api/teams/[teamId]/non-working-days?start=X&end=Y` to fetch records for the new date range.

### components/calendar/calendar-month.tsx

Renders a single calendar month grid (7 columns × 5-6 rows). Props:
```typescript
interface CalendarMonthProps {
  month: Date;
  sprints: SprintBand[];
  nonWorkingDays: NonWorkingDay[];
  members: TeamMember[];
  selectedMemberIds: string[];
  onDayClick: (date: Date) => void;
}
```

Uses `date-fns` functions: `startOfMonth`, `endOfMonth`, `eachDayOfInterval`, `getDay`.

### SprintBand rendering

For each sprint that overlaps the displayed month:
- Render a colored horizontal band behind the day cells spanning the sprint's date range
- Overdue days (days between `sprint.plannedEnd` and `actualEndDate(sprint)`) use a red tint (`bg-destructive/20`)
- Use `position: absolute` within a relative-positioned row, or CSS grid column span approach

### components/calendar/calendar-day-cell.tsx

Props:
```typescript
interface CalendarDayCellProps {
  date: Date;
  isCurrentMonth: boolean;
  nonWorkingDays: NonWorkingDay[];  // filtered to this date and selected members
  onClick: () => void;
}
```

Renders:
- Day number
- Cross (×) icon if `nonWorkingDays.length > 0` after member filter applied
- Wraps cross in `<NonWorkingDayTooltip>` (shadcn/ui `Tooltip`)

### components/calendar/non-working-day-tooltip.tsx

Content for the tooltip on the cross icon:
```
Alice — vacation
Bob — sickleave (half day)
```

```typescript
interface NonWorkingDayTooltipProps {
  records: Array<{
    memberName: string;
    type: NonWorkingDayType;
    halfDay: boolean;
  }>;
}
```

### components/calendar/non-working-day-popup.tsx

shadcn/ui `Dialog`. Handles both add (no `editRecord`) and edit (with `editRecord`).

Fields:
1. Date display (read-only, shows selected date formatted)
2. Type dropdown (Select): holiday / vacation / sickleave
3. Members multi-select: all team members as checkboxes in a scrollable list (min 1 required)
   - For edit mode: shows only the single member (member cannot be changed in edit)
4. Half day checkbox

On save (add):
- POST to `/api/teams/[teamId]/non-working-days`
- On `409` conflict: show inline error per conflicting member name
- On success: update local state; close dialog

On save (edit):
- PUT to `/api/teams/[teamId]/non-working-days/[id]`

On delete (edit mode only):
- Show inline "Remove this record?" confirmation
- DELETE to `/api/teams/[teamId]/non-working-days/[id]`
- On success: update local state; close dialog

### components/calendar/member-filter-bar.tsx

Row of toggle buttons, one per team member. Using shadcn/ui `Toggle` or custom `Button` with `variant="outline"` / `variant="default"` based on selected state.

```typescript
interface MemberFilterBarProps {
  members: Array<{ id: string; name: string }>;
  selectedIds: string[];
  onToggle: (memberId: string) => void;
}
```

Default: all members selected. Filter state is local to the page session (no persistence).

### API Routes

**GET /api/teams/[teamId]/non-working-days**

Query params: `?start=YYYY-MM-DD&end=YYYY-MM-DD`

Returns all `NonWorkingDay` records for the team within the date range, including member name:
```typescript
{
  data: Array<{
    id: string;
    memberId: string;
    memberName: string;
    date: string; // YYYY-MM-DD
    type: NonWorkingDayType;
    halfDay: boolean;
  }>
}
```

---

**POST /api/teams/[teamId]/non-working-days**

Request body (zod):
```typescript
{
  memberIds: string[];           // required, min 1
  date: string;                  // required, YYYY-MM-DD format
  type: NonWorkingDayType;       // required
  halfDay: boolean;              // required
}
```

For each `memberId`:
1. Check for existing record on this date: `@@unique([memberId, date])`
2. If conflict found: collect all conflicting member names
3. If any conflicts: return `409` with `{ error: { message: "...", conflicts: string[] } }`
4. If no conflicts: create all records in a transaction (`prisma.$transaction`)
5. Return `{ data: NonWorkingDay[] }` with `201`

---

**PUT /api/teams/[teamId]/non-working-days/[id]**

Request body:
```typescript
{
  type?: NonWorkingDayType;
  halfDay?: boolean;
}
```
Cannot change `memberId` or `date`. Returns updated record.

---

**DELETE /api/teams/[teamId]/non-working-days/[id]**

Returns `{ data: { deleted: true } }`.

After delete: any sprint dashboard currently open will show stale capacity until refreshed. This is acceptable — no real-time push needed.

---

## shadcn/ui Components to Install

```bash
npx shadcn@latest add dialog popover tooltip toggle
```

---

## Acceptance Criteria

- [ ] Calendar shows 3 months: previous, current, next
- [ ] Back/Forward navigation moves by 1 month
- [ ] Sprint date ranges shown as colored bands across day cells
- [ ] Days beyond overdue sprint's `plannedEnd` highlighted with red tint
- [ ] Days with non-working records show cross (×) icon
- [ ] Cross icon only shown for members in the active member filter
- [ ] Hovering cross icon shows tooltip with `member → type` per record
- [ ] Half-day records show "(half day)" in tooltip
- [ ] Clicking any day opens add popup pre-filled with that date
- [ ] Popup multi-select allows selecting multiple members
- [ ] Saving non-working day for member who already has a record on that date shows conflict error with member name
- [ ] POST creates one `NonWorkingDay` record per selected member (atomic transaction)
- [ ] Edit popup pre-fills type and halfDay; member cannot be changed
- [ ] Delete from edit popup removes the record; calendar updates immediately
- [ ] Member filter hides crosses for deselected members
- [ ] Empty state shown when team has no members
- [ ] Calendar correctly handles month boundaries (days from previous/next month shown as muted)
- [ ] Non-working days on non-working-days of the week (e.g. Saturday for Mon–Fri worker) are saved but deduct 0 days from capacity

---

## Edge Cases

- Non-working day on a day that is not in the member's `workingDays` schedule: record is saved (user may be tracking it for documentation), but `workingDaysInRange()` only deducts if the day falls on a working day
- Sprint bands spanning multiple months: band must render correctly across month boundaries (partial band in each month view)
- Member with 0 sprints in displayed range: no bands shown; calendar functions normally
- Leap year February: `eachDayOfInterval` handles this correctly via `date-fns`
- Popup opened for a date in the past: allowed (past absences can be recorded retroactively)

# RFC-003: Settings Page and Jira Connection

**Status:** Ready for implementation  
**Complexity:** Medium  
**Builds upon:** RFC-001, RFC-002  
**Required by:** RFC-005 (sprint import), RFC-007 (issue fetch)

---

## Summary

Implements the Settings page where the user configures Jira credentials and the story points field ID. Includes the Jira connection validation call, encrypted storage of the API key, and the global Jira API client in `lib/jira.ts`. This RFC is a prerequisite for any feature that calls the Jira API.

---

## Features Covered

- F10 — Settings page
- F11 — Jira connection validation
- F12 — Jira API key encryption at rest
- F13 — Jira API error handling (global client)

---

## File Structure to Create

```
app/
├── settings/
│   └── page.tsx
components/
├── settings/
│   └── settings-form.tsx
lib/
└── jira.ts                      # Jira API client — all Jira calls go through here
app/
└── api/
    └── settings/
        └── route.ts             # GET (load) + POST (save + validate)
```

---

## Technical Specifications

### API Route: app/api/settings/route.ts

**GET** — returns current settings (API key masked):

```typescript
// Response shape
{
  data: {
    jiraDomain: string;
    jiraEmail: string;
    jiraApiKey: string;    // always returned as "••••••••" (masked)
    storyPointsFieldId: string;
    githubApiKey: string;  // masked
    hasJiraKey: boolean;   // true if a key is stored
  }
}
```

**POST** — saves settings, validates Jira connection:

Request body (validated with zod):
```typescript
{
  jiraDomain: string;      // required, non-empty
  jiraEmail: string;       // required, valid email format
  jiraApiKey: string;      // required if hasJiraKey is false; optional if updating (empty = keep existing)
  storyPointsFieldId: string; // required, defaults to "story_points"
  githubApiKey?: string;
}
```

Logic:
1. Validate request body with zod
2. If `jiraApiKey` is non-empty: encrypt it via `encrypt()` from `lib/encryption.ts`
3. If `jiraApiKey` is empty and a key already exists: keep the existing encrypted key
4. Upsert the single `Settings` record (create if none, update if exists)
5. After saving, call `validateJiraConnection()` from `lib/jira.ts`
6. Return `{ data: { success: true } }` or `{ error: { message: "..." } }`

Response codes:
- `200` — saved and Jira validated
- `400` — zod validation error (return field-level errors)
- `502` — saved successfully but Jira validation failed (return Jira error message)

### lib/jira.ts

Single source of truth for all Jira API calls. Export these functions:

```typescript
// Validates credentials — calls GET /rest/api/3/myself
export async function validateJiraConnection(): Promise<{ success: true } | { success: false; message: string }>

// Finds a sprint by name within a team's Jira project
// Returns sprint metadata or null if not found
export async function findSprintByName(
  jiraSpace: string,
  sprintName: string
): Promise<JiraSprintMetadata | null>

// Fetches all issues for a sprint including full changelog
export async function fetchSprintIssues(
  jiraSprintId: number
): Promise<JiraIssue[]>
```

Internal helpers (not exported):
- `getJiraConfig()` — reads and decrypts credentials from DB; throws if not configured
- `jiraFetch(path, options?)` — wraps `fetch` with auth headers and error mapping
- `mapJiraError(status: number): string` — maps HTTP status to user-facing message

**Auth header construction:**
```typescript
const credentials = btoa(`${jiraEmail}:${decryptedApiKey}`);
headers['Authorization'] = `Basic ${credentials}`;
headers['Accept'] = 'application/json';
headers['Content-Type'] = 'application/json';
```

**Base URLs:**
- Jira REST API v3: `https://${jiraDomain}/rest/api/3`
- Jira Agile API: `https://${jiraDomain}/rest/agile/1.0`

**Error mapping:**
```typescript
const JIRA_ERROR_MESSAGES: Record<number, string> = {
  401: 'Invalid Jira credentials. Please check your API key in Settings.',
  403: 'Jira access denied. Ensure your account has the required permissions.',
  404: 'Resource not found in Jira.',
  429: 'Jira rate limit reached. Please wait a moment and try again.',
};

// 5xx → 'Jira is currently unavailable.'
// network error → 'Cannot reach Jira. Check your network connection.'
```

**JiraSprintMetadata type:**
```typescript
interface JiraSprintMetadata {
  id: number;
  name: string;
  state: 'active' | 'closed' | 'future';
  startDate: string;      // ISO string
  endDate: string;        // ISO string
  completeDate?: string;  // ISO string, present if closed
  activatedDate?: string; // ISO string
}
```

**JiraIssue type (used in RFC-007):**
```typescript
interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    assignee: { emailAddress: string; displayName: string } | null;
    priority: { name: 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest' } | null;
    status: { name: string };
    [storyPointsField: string]: unknown; // dynamic field
  };
  changelog: {
    histories: Array<{
      created: string; // ISO string
      items: Array<{
        field: string;
        toString: string | null;
        fromString: string | null;
      }>;
    }>;
  };
}
```

### components/settings/settings-form.tsx

Client Component (`'use client'`). Uses `useState` for form fields and loading/error state.

**Form fields:**
- Jira domain (text input, placeholder: `your-domain.atlassian.net`)
- Jira email (email input)
- Jira API key (password input, shows placeholder `••••••••` if `hasJiraKey` is true, with note "Leave blank to keep existing key")
- Story points field ID (text input, placeholder: `story_points`)
- GitHub API key (password input, optional, "Stored for future use")

**On submit:**
1. POST to `/api/settings`
2. Show loading state on button ("Saving...")
3. On `200`: show success toast "Connected to Jira successfully"
4. On `502`: show error banner (not toast) "Jira credentials saved but connection failed: [message]"
5. On `400`: show inline field-level validation errors

**Layout:** Single column form, shadcn/ui `Card` wrapper, fields with `Label` + `Input`, `Button` at bottom.

### app/settings/page.tsx

Server Component. Fetches current settings via `prisma.settings.findFirst()` and passes masked values to `<SettingsForm>`.

```typescript
export default async function SettingsPage() {
  const settings = await prisma.settings.findFirst();
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-medium mb-6">Settings</h1>
      <SettingsForm
        initialValues={{
          jiraDomain: settings?.jiraDomain ?? '',
          jiraEmail: settings?.jiraEmail ?? '',
          storyPointsFieldId: settings?.storyPointsFieldId ?? 'story_points',
          hasJiraKey: Boolean(settings?.jiraApiKey),
          hasGithubKey: Boolean(settings?.githubApiKey),
        }}
      />
    </div>
  );
}
```

---

## shadcn/ui Components to Install

```bash
npx shadcn@latest add card input label form toast
```

---

## Acceptance Criteria

- [ ] Settings page accessible at `/settings` from sidebar link
- [ ] All fields save to the `Settings` table on POST
- [ ] Jira API key is encrypted before DB write; never stored plain text
- [ ] GET returns API key as `••••••••` (masked), never the actual value
- [ ] POST with empty `jiraApiKey` field keeps the existing key
- [ ] Jira connection validated after every save
- [ ] Success toast shown on valid Jira credentials
- [ ] Error banner (not toast) shown when Jira validation fails, with human-readable message
- [ ] Field-level validation errors shown for invalid inputs (empty required fields, invalid email)
- [ ] `ENCRYPTION_KEY` is never logged or included in any response
- [ ] `validateJiraConnection()` uses `GET /rest/api/3/myself` — no other endpoint
- [ ] All Jira HTTP errors map to human-readable messages (test 401, 403, 404, 429, 500)
- [ ] Network errors (fetch throws) mapped to "Cannot reach Jira" message
- [ ] `lib/jira.ts` exports `validateJiraConnection`, `findSprintByName`, `fetchSprintIssues`
- [ ] `getJiraConfig()` throws a clear error if Settings not configured (not just returns null)

---

## Edge Cases

- Settings table is empty (first run): GET returns empty defaults; POST creates the record
- `jiraApiKey` submitted as whitespace only: treat as empty (trim before checking)
- `jiraDomain` submitted with `https://` prefix: strip it (store only the domain)
- `storyPointsFieldId` submitted empty: default to `"story_points"`
- Jira domain unreachable (DNS failure): caught as network error → "Cannot reach Jira"

---

## Security Notes

- The decrypted API key must not appear in: response bodies, server logs, error messages
- `getJiraConfig()` decrypts the key each time it's called — it is not cached in a module-level variable
- The `Authorization` header is constructed per-request inside `jiraFetch()` — not stored anywhere

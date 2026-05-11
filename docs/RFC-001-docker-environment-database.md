# RFC-001: Docker, Environment, and Database Foundation

**Status:** Ready for implementation  
**Complexity:** Low  
**Builds upon:** —  
**Required by:** RFC-002, RFC-003, RFC-004, RFC-005, RFC-006, RFC-007

---

## Summary

Establishes the complete project scaffold: Docker Compose stack, environment configuration, Prisma schema with all models, database migrations, and the `lib/` singleton utilities that every subsequent RFC depends on. Nothing else in the project can be built until this RFC is complete.

---

## Features Covered

- F01 — Docker Compose stack
- F02 — Environment variable configuration
- F03 — Automatic database migrations on startup
- F04 — Prisma schema covering all entities
- F05 — README with setup instructions

---

## File Structure to Create

```
/
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── prisma/
│   └── schema.prisma
├── lib/
│   ├── prisma.ts
│   ├── encryption.ts
│   ├── config.ts
│   └── utils.ts
└── types/
    └── index.ts
```

---

## Technical Specifications

### Dockerfile

Multi-stage build. Stage 1 (`builder`): installs all deps, runs `next build`. Stage 2 (`runner`): copies only `.next/standalone`, `.next/static`, and `public`. Runs as non-root `node` user. Exposes port 3000.

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
USER nextjs
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
```

### docker-compose.yml

```yaml
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
    env_file:
      - .env

volumes:
  postgres_data:
```

### .env.example

```
POSTGRES_URL=postgresql://sprint_user:sprint_pass@db:5432/sprint_monitor
ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
POSTGRES_USER=sprint_user
POSTGRES_PASSWORD=sprint_pass
POSTGRES_DATABASE=sprint_monitor
```

### Prisma Schema

All models follow these rules (from RULES.md):
- `id String @id @default(cuid())`
- `createdAt DateTime @default(now())`
- `updatedAt DateTime @updatedAt`
- Explicit `onDelete` on all foreign keys
- DB-level unique constraints

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("POSTGRES_URL")
}

model Settings {
  id                  String   @id @default(cuid())
  jiraDomain          String   @default("")
  jiraEmail           String   @default("")
  jiraApiKey          String   @default("")  // stored encrypted
  storyPointsFieldId  String   @default("story_points")
  githubApiKey        String   @default("")  // stored, unused v1.0
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}

model Team {
  id                  String        @id @default(cuid())
  name                String
  jiraSpace           String
  githubRepositories  String[]      @default([])
  createdAt           DateTime      @default(now())
  updatedAt           DateTime      @updatedAt
  members             TeamMember[]
  sprints             Sprint[]
  nonWorkingDays      NonWorkingDay[]
}

enum WeekDay {
  Mon
  Tue
  Wed
  Thu
  Fri
  Sat
  Sun
}

enum Specialization {
  frontend
  backend
  both
}

model TeamMember {
  id                  String          @id @default(cuid())
  teamId              String
  name                String
  jiraEmail           String
  githubUsername      String          @default("")
  workingDays         WeekDay[]
  defaultFocusFactor  Float
  specialization      Specialization?
  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt
  team                Team            @relation(fields: [teamId], references: [id], onDelete: Cascade)
  nonWorkingDays      NonWorkingDay[]
  sprintFocusFactors  SprintFocusFactor[]
}

enum NonWorkingDayType {
  holiday
  vacation
  sickleave
}

model NonWorkingDay {
  id        String            @id @default(cuid())
  memberId  String
  teamId    String
  date      DateTime          @db.Date
  type      NonWorkingDayType
  halfDay   Boolean           @default(false)
  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt
  member    TeamMember        @relation(fields: [memberId], references: [id], onDelete: Cascade)
  team      Team              @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([memberId, date])
}

model Sprint {
  id            String    @id @default(cuid())
  teamId        String
  jiraSprintId  Int
  name          String
  plannedStart  DateTime
  plannedEnd    DateTime
  actualEnd     DateTime?
  activatedAt   DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  team          Team      @relation(fields: [teamId], references: [id], onDelete: Cascade)
  focusFactors  SprintFocusFactor[]
  issueCache    SprintIssueCache?
}

model SprintFocusFactor {
  id           String     @id @default(cuid())
  sprintId     String
  memberId     String
  focusFactor  Float
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  sprint       Sprint     @relation(fields: [sprintId], references: [id], onDelete: Cascade)
  member       TeamMember @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@unique([sprintId, memberId])
}

model SprintIssueCache {
  id          String   @id @default(cuid())
  sprintId    String   @unique
  data        Json
  fetchedAt   DateTime
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  sprint      Sprint   @relation(fields: [sprintId], references: [id], onDelete: Cascade)
}
```

### lib/prisma.ts — singleton

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### lib/encryption.ts

AES-256-GCM. Encrypt returns `iv:authTag:ciphertext` (all hex). Decrypt splits on `:` and reverses.

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(key, 'hex');
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(ciphertext: string): string {
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':');
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Invalid encrypted value format');
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
```

### lib/config.ts

Typed accessors for environment variables. Validates on import.

```typescript
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const config = {
  databaseUrl: () => requireEnv('POSTGRES_URL'),
  encryptionKey: () => requireEnv('ENCRYPTION_KEY'),
} as const;
```

### lib/utils.ts

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### types/index.ts

Core shared types. These mirror Prisma models but are used in the application layer.

```typescript
export type WeekDay = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
export const WEEK_DAYS: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export type NonWorkingDayType = 'holiday' | 'vacation' | 'sickleave';
export const NON_WORKING_DAY_TYPES: NonWorkingDayType[] = ['holiday', 'vacation', 'sickleave'];

export type Specialization = 'frontend' | 'backend' | 'both';

export interface ApiSuccess<T> {
  data: T;
}

export interface ApiError {
  error: {
    message: string;
    code?: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
```

### next.config.ts

Enable standalone output for Docker:

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
};

export default nextConfig;
```

---

## Acceptance Criteria

- [ ] `docker compose up` starts both `db` and `app` services without errors
- [ ] `app` does not start until `db` healthcheck passes
- [ ] App is accessible at `http://localhost:3000` after `docker compose up`
- [ ] PostgreSQL data persists across `docker compose down` + `docker compose up`
- [ ] `prisma migrate deploy` runs automatically on container start
- [ ] Fresh database has all tables created by migration
- [ ] Re-running migrations on an already-migrated DB is a no-op
- [ ] `encrypt(decrypt(x)) === x` for any string `x`
- [ ] App fails to start with a clear error if `ENCRYPTION_KEY` is not 64 hex chars
- [ ] App fails to start with a clear error if `POSTGRES_URL` is missing
- [ ] `.env` is in `.gitignore`; `.env.example` is committed
- [ ] `lib/prisma.ts` singleton does not create duplicate connections in dev mode
- [ ] All Prisma unique constraints are enforced at DB level

---

## Edge Cases

- `ENCRYPTION_KEY` is present but wrong length → throw at startup, not at first use
- Container starts before DB is ready → `depends_on: condition: service_healthy` prevents this
- Migration fails → container exits with non-zero code; log the Prisma error

---

## Security Notes

- `ENCRYPTION_KEY` value must never appear in logs
- `getKey()` in `encryption.ts` is called at encrypt/decrypt time, not at module load, to avoid exposing the key in memory longer than necessary
- `.env` added to `.gitignore` before first commit

---

## Dependencies

**npm packages to install:**
- `@prisma/client`, `prisma` (dev)
- `clsx`, `tailwind-merge`
- `date-fns`
- `zod`
- `next`, `react`, `react-dom`
- `typescript`, `@types/node`, `@types/react`, `@types/react-dom` (dev)
- `tailwindcss`, `postcss`, `autoprefixer` (dev)

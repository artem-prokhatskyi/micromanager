# Team Sprint Monitor

Team Sprint Monitor is an internal tool for tracking sprint capacity and Jira-backed delivery status. This repository currently contains the RFC-001 foundation scaffold: Next.js, Prisma, PostgreSQL, Docker, encryption utilities, and shared runtime configuration.

## Prerequisites

- Docker Desktop with Docker Compose v2
- Node.js 20 and npm if you want to run commands outside Docker

## Getting Started

1. Copy `.env.example` to `.env`.
2. Review the values in `.env` and replace them if needed.
3. Start the full stack:

```bash
docker compose up --build
```

4. Open `http://localhost:3000` after both services are healthy.

## Environment Variables

The app requires these environment variables:

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma |
| `ENCRYPTION_KEY` | 64-character hex string used for AES-256-GCM encryption |
| `POSTGRES_USER` | PostgreSQL username |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `POSTGRES_DB` | PostgreSQL database name |

`ENCRYPTION_KEY` must be exactly 64 hex characters. The runtime startup check fails fast if it is missing or invalid.

## Useful Commands

```bash
npm install
npm run build
npm run dev
npm run prisma:validate
npm run prisma:generate
npm run prisma:migrate:deploy
```

When you run `npm run dev` on the host machine, the dev launcher automatically rewrites a Docker-style PostgreSQL hostname of `db` to `localhost` so the app can connect to the database container published on port `5432`. If you need a different host-side connection string, set `LOCAL_DATABASE_URL` before starting dev.

## Docker Notes

- The `db` service uses a named `postgres_data` volume so data survives container restarts.
- The `app` service waits for the database healthcheck before starting.
- Container startup validates environment variables, runs `prisma migrate deploy`, and then launches the standalone Next.js server.

## Current Scope

RFC-001 intentionally does not include the application shell, settings UI, Jira client, or feature pages. Those are implemented in later RFCs.
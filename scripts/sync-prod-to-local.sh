#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

PROD_DATABASE_URL="${PROD_DATABASE_URL:-${1:-}}"
FORCE_MODE="${2:-}"
PG_DUMP_IMAGE="${PG_DUMP_IMAGE:-postgres:17-alpine}"
SYNC_SCHEMAS="${SYNC_SCHEMAS:-public}"

if [[ -z "$PROD_DATABASE_URL" ]]; then
  echo "Error: PROD_DATABASE_URL is required."
  echo "Usage: PROD_DATABASE_URL=postgresql://... ./scripts/sync-prod-to-local.sh [--yes]"
  echo "   or: ./scripts/sync-prod-to-local.sh postgresql://... [--yes]"
  exit 1
fi

if [[ -z "$SYNC_SCHEMAS" ]]; then
  echo "Error: SYNC_SCHEMAS cannot be empty."
  exit 1
fi

PG_DUMP_SCHEMA_ARGS=()

IFS=',' read -r -a SCHEMA_LIST <<< "$SYNC_SCHEMAS"
for schema in "${SCHEMA_LIST[@]}"; do
  normalized_schema="$(echo "$schema" | xargs)"

  if [[ -n "$normalized_schema" ]]; then
    PG_DUMP_SCHEMA_ARGS+=("--schema=$normalized_schema")
  fi
done

if [[ ${#PG_DUMP_SCHEMA_ARGS[@]} -eq 0 ]]; then
  echo "Error: SYNC_SCHEMAS did not contain any valid schema names."
  exit 1
fi

: "${POSTGRES_USER:?Error: POSTGRES_USER is not set.}"
: "${POSTGRES_DATABASE:?Error: POSTGRES_DATABASE is not set.}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is not installed or not available in PATH."
  exit 1
fi

if ! docker compose ps -q db >/dev/null 2>&1; then
  echo "Error: docker compose is not available or the compose project is not initialized."
  exit 1
fi

DB_CONTAINER_ID="$(docker compose ps -q db)"

if [[ -z "$DB_CONTAINER_ID" ]]; then
  echo "Error: db service container was not found. Start it with: docker compose up -d db"
  exit 1
fi

if [[ "$FORCE_MODE" != "--yes" ]]; then
  echo "This will fully overwrite local database '$POSTGRES_DATABASE' in the Docker db service."
  read -r -p "Continue? [y/N]: " CONFIRM

  if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
  fi
fi

echo "Syncing production data into local Docker database..."

echo "Using pg_dump client image: $PG_DUMP_IMAGE"
echo "Syncing schemas: $SYNC_SCHEMAS"

run_pg_dump() {
  docker run --rm \
    "$PG_DUMP_IMAGE" \
    pg_dump \
      --verbose \
      --clean \
      --if-exists \
      --no-owner \
      --no-privileges \
      --dbname "$PROD_DATABASE_URL" \
      "${PG_DUMP_SCHEMA_ARGS[@]}"
}

LOCAL_SERVER_VERSION_NUM="$({
  docker compose exec -T db psql -At -U "$POSTGRES_USER" -d "$POSTGRES_DATABASE" -c "SHOW server_version_num" 2>/dev/null
} | tr -d '\r' || true)"

if [[ "$LOCAL_SERVER_VERSION_NUM" =~ ^[0-9]+$ ]] && (( LOCAL_SERVER_VERSION_NUM < 170000 )); then
  echo "Detected local Postgres $LOCAL_SERVER_VERSION_NUM (< 170000). Filtering PG17-only SET commands."

  run_pg_dump \
    | sed '/^SET transaction_timeout = /d' \
    | docker compose exec -T db psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DATABASE"
else
  run_pg_dump \
    | docker compose exec -T db psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DATABASE"
fi

echo "Done. Local database '$POSTGRES_DATABASE' is now synced from production dump."

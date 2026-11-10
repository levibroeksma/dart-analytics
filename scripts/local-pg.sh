#!/usr/bin/env bash
# Throwaway local Postgres for sessions that have no DATABASE_URL (cloud
# containers). Usage: bash scripts/local-pg.sh start | build | url | stop
#   start  initdb if needed, start the server, create the `integration`
#          database, print the DATABASE_URL (sslmode off, as the suite needs)
#   build  start, then migrate -> seed -> migrate from app/ (as integration.yml)
#   url    print the DATABASE_URL
#   stop   stop the server and delete its data directory
# Under root (the container user) the server runs as `postgres`, because
# Postgres refuses to start as root; the data directory is /var/tmp/dart-pg,
# which that user can read (a session scratchpad it cannot). Override with
# PGDATA_DIR and PGPORT. Then, from app/:
#   export DATABASE_URL=$(bash ../scripts/local-pg.sh url)
#   npm run test:integration       # statistics SQL against the built database
#   npm run db:verify              # database/verification/*.sql
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="${PGDATA_DIR:-/var/tmp/dart-pg}"
PORT="${PGPORT:-5432}"
BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
URL="postgres://postgres@localhost:$PORT/integration"

if [ -z "$BIN" ]; then
  echo "local-pg: no PostgreSQL server binaries under /usr/lib/postgresql" >&2
  exit 1
fi

as_pg() {
  if [ "$(id -u)" -eq 0 ]; then
    su postgres -c "$*"
  else
    bash -c "$*"
  fi
}

start() {
  if [ "$(id -u)" -eq 0 ]; then
    mkdir -p "$DIR" && chown postgres "$DIR" || exit 1
  else
    mkdir -p "$DIR" || exit 1
  fi
  if [ ! -d "$DIR/data" ]; then
    as_pg "$BIN/initdb -D $DIR/data -U postgres -A trust >/dev/null" || exit 1
  fi
  if ! as_pg "$BIN/pg_ctl -D $DIR/data status >/dev/null 2>&1"; then
    as_pg "$BIN/pg_ctl -D $DIR/data -o '-c listen_addresses=localhost -c port=$PORT -c unix_socket_directories=$DIR' -l $DIR/log -w start >/dev/null" || {
      tail -5 "$DIR/log" >&2
      exit 1
    }
  fi
  as_pg "$BIN/createdb -h localhost -p $PORT -U postgres integration 2>/dev/null" || true
  echo "$URL"
}

case "${1:-}" in
  start) start ;;
  url) echo "$URL" ;;
  build)
    start >/dev/null
    cd "$ROOT/app" || exit 1
    export DATABASE_URL="$URL?sslmode=disable"
    npm run db:migrate:ci || echo "first migrate pass stopped; seeding, then retrying" >&2
    npm run db:seed:ci && npm run db:migrate:ci && npm run db:status:ci | tail -2
    echo "$URL"
    ;;
  stop)
    as_pg "$BIN/pg_ctl -D $DIR/data -m fast stop >/dev/null 2>&1" || true
    rm -rf "$DIR"
    ;;
  *)
    echo "usage: bash scripts/local-pg.sh start | build | url | stop" >&2
    exit 2
    ;;
esac

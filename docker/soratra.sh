#!/bin/sh
# Entry point and helper commands inside the Soratra image.
set -eu
cd /app

password_file=/config/postgres-password

# Uses the generated password unless POSTGRES_URL points somewhere else.
database_url() {
  if [ -n "${POSTGRES_URL:-}" ]; then return; fi
  if [ ! -s "$password_file" ]; then
    echo "Soratra cannot start: no database password in $password_file and POSTGRES_URL is not set." >&2
    echo "Start it with the supplied compose.yaml, which creates the password on first run." >&2
    exit 1
  fi
  POSTGRES_URL="postgres://soratra:$(cat "$password_file")@${POSTGRES_HOST:-db}:5432/soratra"
  export POSTGRES_URL
}

command="${1:-start}"
[ "$#" -eq 0 ] || shift
case "$command" in
  init)
    if [ -s "$password_file" ]; then
      echo "Database password already exists."
    else
      umask 022
      node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))" > "$password_file.tmp"
      mv "$password_file.tmp" "$password_file"
      echo "Generated a database password."
    fi
    ;;
  migrate)
    database_url
    node cli/migrate.cjs
    ;;
  reset-link)
    database_url
    exec node cli/reset-link.cjs "$@"
    ;;
  start)
    database_url
    echo "Soratra ${SORATRA_VERSION:-dev}: updating the database..."
    node cli/migrate.cjs
    echo "Soratra ${SORATRA_VERSION:-dev}: starting."
    exec node server.js
    ;;
  *)
    echo "Usage: soratra [start | migrate | reset-link <username> | init]" >&2
    exit 2
    ;;
esac

#!/usr/bin/env bash
# Every compose file combination we document must parse. Needs no images.
set -euo pipefail
cd "$(dirname "$0")/../.."

check() {
  echo "docker compose $* config"
  docker compose "$@" config --quiet
}

check -f compose.yaml
check -f compose.yaml -f compose.build.yaml
check -f compose.yaml -f compose.build.yaml -f docker/compose.test.yaml
DOMAIN=books.example.org check -f compose.yaml -f compose.caddy.yaml
check -f compose.dev.yaml

# Without DOMAIN the HTTPS overlay must refuse with its own explanation.
if output=$(env -u DOMAIN docker compose -f compose.yaml -f compose.caddy.yaml config --quiet 2>&1); then
  echo 'compose.caddy.yaml accepted a missing DOMAIN' >&2
  exit 1
fi
grep -q 'Set DOMAIN to your domain' <<< "$output" || { echo "$output" >&2; exit 1; }
echo 'All compose combinations are valid.'

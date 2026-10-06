#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
docker compose "$@" build app migrate scheduler
docker compose "$@" stop app scheduler
docker compose "$@" up -d --wait db
docker compose "$@" run --rm migrate
docker compose "$@" up -d --wait --remove-orphans

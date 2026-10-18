#!/usr/bin/env bash
# An installation's life: seeded on the previous release, updated to the image
# under test on the same volumes, restarted, then moved to a fresh install with
# a backup, following docs/SELF_HOSTING.md. Readers must stay signed in and
# keep their data at every step.
source "$(dirname "$0")/lib.sh"

previous_release() {
  local own
  own=$(git -C "$repo" tag --points-at HEAD --list 'v*' | head -n 1)
  git -C "$repo" tag --merged HEAD --list 'v*' --sort=-v:refname | grep -vxF "${own:-none}" | head -n 1 | sed 's/^v//'
}

previous=${PREVIOUS_VERSION:-$(previous_release)}
[ -n "$previous" ] || fail 'no earlier release tag found; fetch tags (fetch-depth: 0) or set PREVIOUS_VERSION'

# The test overlay swaps Open Library for the fixture so the seed can add a book.
new_install old 3201 compose.yaml:docker/compose.test.yaml
set_env old SORATRA_VERSION "$previous"

log "Starting the previous release, $previous"
up old
install_playwright lifecycle-seed 3201
# Later starts skip the daily backup while this one is under a day old.
wait_for_backup old

log "Updating to $SORATRA_IMAGE_TAG on the same volumes"
set_env old SORATRA_VERSION "$SORATRA_IMAGE_TAG"
up old
image=$(at old docker compose ps --format '{{.Image}}' app)
[ "$image" = "ghcr.io/kadirkess/soratra:$SORATRA_IMAGE_TAG" ] || fail "app runs $image after the update"
at old docker compose exec -T app soratra migrate
install_playwright lifecycle-verify 3201

log 'Restarting without removing volumes'
at old docker compose down
up old
install_playwright lifecycle-verify 3201

log 'Moving to a fresh installation with a backup'
at old docker compose exec -T backup pg_dump --format=custom --file=/backups/moving.dump
at old docker compose cp backup:/backups/moving.dump "$SCENARIO_ROOT/moving.dump"
at old docker compose down

# Its own generated database password and auth secret, until the restore.
new_install new 3202 compose.yaml:docker/compose.test.yaml
up new
at new docker compose cp "$SCENARIO_ROOT/moving.dump" backup:/backups/moving.dump
at new docker compose stop app
at new docker compose exec -T backup pg_restore --clean --if-exists --no-owner --dbname=soratra /backups/moving.dump
up new
install_playwright lifecycle-verify 3202

log 'Lifecycle scenario passed'

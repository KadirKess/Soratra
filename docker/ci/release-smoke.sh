#!/usr/bin/env bash
# The published image as a new user gets it: compose.yaml and nothing else.
# Usage: release-smoke.sh VERSION  (pulls ghcr.io/kadirkess/soratra:VERSION)
SORATRA_IMAGE_TAG=${1:?usage: release-smoke.sh VERSION}
source "$(dirname "$0")/lib.sh"

port=${SMOKE_PORT:-3000}
new_install release "$port" compose.yaml
at release docker compose pull --quiet
up release

log 'Checking the published image'
expected=$(uname -m | sed 's/x86_64/amd64/; s/aarch64/arm64/')
arch=$(docker image inspect --format '{{.Architecture}}' "ghcr.io/kadirkess/soratra:$SORATRA_IMAGE_TAG")
[ "$arch" = "$expected" ] || fail "pulled a $arch image on a $expected machine"
version=$(at release docker compose exec -T app printenv SORATRA_VERSION)
[ "$version" = "$SORATRA_IMAGE_TAG" ] || fail "image reports version $version"
curl --fail --silent --show-error http://localhost:$port/api/health | grep -q '"ok"' || fail 'not healthy'
curl --fail --silent --show-error http://localhost:$port/setup | grep -q 'Start my journal' || fail 'no setup page'
curl --fail --silent --show-error --output /dev/null http://localhost:$port/source.tar.gz || fail 'no source archive'
wait_for_backup release

log 'Release smoke test passed'

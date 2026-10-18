# Shared by the install scenarios in this folder. Each installation gets its
# own folder laid out like a real one: the compose files, a .env with its
# settings, and a ./backups folder, all under $SCENARIO_ROOT.
#
# SORATRA_IMAGE_TAG names the image under test (ghcr.io/kadirkess/soratra:TAG).
# CI loads it from the image job; locally, build it first:
#   docker build -t ghcr.io/kadirkess/soratra:ci --build-arg SORATRA_VERSION=ci .

set -euo pipefail

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
SORATRA_IMAGE_TAG=${SORATRA_IMAGE_TAG:-ci}
SCENARIO_ROOT=${SCENARIO_ROOT:-$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/soratra-scenario.XXXXXX")}
installs=()

# A Compose project name unique to this run, so parallel runs never share volumes.
run_id=${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-$$}

log() { printf '\n==> %s\n' "$*"; }
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

# new_install NAME PORT COMPOSE_FILE [KEY=VALUE...]
new_install() {
  local name=$1 port=$2 files=$3
  shift 3
  local dir="$SCENARIO_ROOT/$name"
  mkdir -p "$dir/docker" "$dir/e2e/helpers" "$dir/backups"
  cp "$repo/compose.yaml" "$repo/compose.caddy.yaml" "$dir/"
  cp "$repo/docker/compose.test.yaml" "$dir/docker/"
  cp "$repo/e2e/helpers/openLibraryMock.mjs" "$dir/e2e/helpers/"
  {
    echo "COMPOSE_PROJECT_NAME=soratra-$name-$run_id"
    echo "COMPOSE_FILE=$files"
    echo "SORATRA_VERSION=$SORATRA_IMAGE_TAG"
    echo "SORATRA_PORT=$port"
    printf '%s\n' "$@"
  } > "$dir/.env"
  installs+=("$name")
}

# at NAME docker compose ...  runs a command inside that installation's folder.
at() {
  local name=$1
  shift
  (cd "$SCENARIO_ROOT/$name" && "$@")
}

# set_env NAME KEY VALUE  changes one setting, as an operator editing .env would.
set_env() {
  local file="$SCENARIO_ROOT/$1/.env"
  grep -v "^$2=" "$file" > "$file.next" || true
  echo "$2=$3" >> "$file.next"
  mv "$file.next" "$file"
}

up() {
  at "$1" docker compose up -d --wait --wait-timeout 300
}

wait_for_backup() {
  local name=$1
  for _ in $(seq 1 60); do
    at "$name" docker compose logs backup | grep -q 'Backup written' && return 0
    sleep 2
  done
  fail "no backup written in $name"
}

# install_playwright PROJECT PORT  runs one project of playwright.install.config.ts.
install_playwright() {
  (cd "$repo" && PLAYWRIGHT_BASE_URL="http://localhost:$2" INSTALL_STATE_DIR="$SCENARIO_ROOT" \
    npx playwright test --config playwright.install.config.ts --project "$1")
}

sha256() {
  if command -v sha256sum > /dev/null; then printf '%s' "$1" | sha256sum | cut -d' ' -f1
  else printf '%s' "$1" | shasum -a 256 | cut -d' ' -f1
  fi
}

cleanup() {
  local status=$?
  # The odd expansion keeps bash 3.2 (macOS) happy with an empty array.
  for name in ${installs[@]+"${installs[@]}"}; do
    if [ "$status" -ne 0 ]; then
      log "logs from $name"
      at "$name" docker compose logs --no-color --tail 200 || true
    fi
    at "$name" docker compose down --volumes --remove-orphans > /dev/null 2>&1 || true
  done
  # Backups are written by root inside the container, so they may not be ours
  # to delete; CI runners are thrown away anyway.
  [ -n "${KEEP_SCENARIO_ROOT:-}" ] || rm -rf "$SCENARIO_ROOT" 2> /dev/null || true
  exit "$status"
}
trap cleanup EXIT

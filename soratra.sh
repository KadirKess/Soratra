#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

command_name=start
port=''
operator=''
support=''
support_provided=false
edit=false
automatic=false
open_browser=true
color=true
verbose=false
while [ "$#" -gt 0 ]; do
  case "$1" in
    start|configure|advanced|stop|status|logs|update) command_name="$1"; shift ;;
    --configure) command_name=configure; shift ;;
    --advanced) command_name=advanced; shift ;;
    --port|--name|--support-email)
      [ "$#" -ge 2 ] || { echo "Missing value for $1" >&2; exit 1; }
      case "$1" in
        --port) port="$2" ;;
        --name) operator="$2" ;;
        --support-email) support="$2"; support_provided=true ;;
      esac
      edit=true; shift 2 ;;
    --yes) automatic=true; shift ;;
    --no-open) open_browser=false; shift ;;
    --no-color) color=false; shift ;;
    --verbose) verbose=true; shift ;;
    -h|--help)
      cat <<'HELP'
Soratra launcher

  ./soratra.sh                         Set up once, then start your app
  ./soratra.sh configure               Edit the saved local port
  ./soratra.sh advanced                Email, public hosting, and other options
  ./soratra.sh --port 3030             Change the port and start
  ./soratra.sh --name 'Your name'       Set the name shown on legal pages
  ./soratra.sh --support-email a@b.com  Change the support address
  ./soratra.sh stop                    Stop containers; keep your data
  ./soratra.sh status                  Show container status
  ./soratra.sh logs                    Follow application logs
  ./soratra.sh update                  Build, migrate, and restart

  --yes          Use defaults without prompts
  --no-open      Leave browser opening to you
  --no-color     Disable terminal colors
  --verbose      Show Docker build and startup output

Requires Docker with Compose v2. Local access stays on localhost.
Configuration is saved privately in .env. Back up before updating.
HELP
      exit 0 ;;
    *) echo "Unknown argument: $1. Use --help." >&2; exit 1 ;;
  esac
done

ink='' accent='' muted='' reset=''
if [ -t 1 ] && $color && [ -z "${NO_COLOR:-}" ]; then
  ink=$'\033[1m'; accent=$'\033[38;5;202m'; muted=$'\033[2m'; reset=$'\033[0m'
fi
printf '\n%s  +------------------------------------------+%s\n' "$muted" "$reset"
printf '%s  |%s  %s%-40s%s%s|%s\n' "$muted" "$reset" "$accent$ink" 'S O R A T R A' "$reset" "$muted" "$reset"
printf '%s  |%s  %-40s%s|%s\n' "$muted" "$reset" 'A quiet place for your reading.' "$muted" "$reset"
printf '%s  +------------------------------------------+%s\n\n' "$muted" "$reset"

say() { printf '  %s%s%s\n' "$muted" "$1" "$reset"; }
fail() { printf '\n  %sError%s  %s\n\n' "$accent" "$reset" "$1" >&2; exit 1; }
step_log=''
step_pid=''
cleanup() {
  if [ -n "$step_pid" ]; then kill "$step_pid" 2>/dev/null || true; fi
  if [ -n "$step_log" ]; then rm -f -- "$step_log"; fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
run_step() {
  local label="$1" status=0 frame=0 glyph=''
  shift
  if $verbose; then
    printf '  %s%-36s%s [working]\n' "$ink" "$label" "$reset"
    if "$@"; then status=0; else status=$?; fi
  else
    step_log="$(mktemp "${TMPDIR:-/tmp}/soratra-step.XXXXXX")"
    if [ -t 1 ]; then
      "$@" >"$step_log" 2>&1 &
      step_pid=$!
      while kill -0 "$step_pid" 2>/dev/null; do
        case "$frame" in 0) glyph='/' ;; 1) glyph='-' ;; 2) glyph='\' ;; 3) glyph='|' ;; esac
        printf '\r  %s%-36s%s %s[%s]%s' "$ink" "$label" "$reset" "$accent" "$glyph" "$reset"
        frame=$(((frame + 1) % 4))
        sleep 0.12
      done
      if wait "$step_pid"; then status=0; else status=$?; fi
      step_pid=''
      printf '\r%-70s\r' ''
    else
      printf '  %-36s [working]\n' "$label"
      if "$@" >"$step_log" 2>&1; then status=0; else status=$?; fi
    fi
  fi
  if [ "$status" -ne 0 ]; then
    printf '  %s%-36s%s %s[failed]%s\n\n' "$ink" "$label" "$reset" "$accent" "$reset" >&2
    if [ -n "$step_log" ]; then cat "$step_log" >&2; fi
    fail "$label failed. Fix the error above and run this command again."
  fi
  printf '  %s%-36s%s %s[done]%s\n' "$ink" "$label" "$reset" "$muted" "$reset"
  if [ -n "$step_log" ]; then rm -f -- "$step_log"; step_log=''; fi
}
if [ "$command_name" = advanced ]; then
  [ -t 0 ] || fail 'Advanced settings need a terminal. Use configure with flags for unattended edits.'
  ! $edit || fail 'Use configure with setting flags, or advanced for the interactive menu.'
fi
command -v docker >/dev/null 2>&1 || fail 'Install Docker Desktop or Docker Engine with Compose, then run this again.'
docker info >/dev/null 2>&1 || fail 'Docker is not running. Start Docker Desktop or your Docker service, then run this again.'
docker compose version >/dev/null 2>&1 || fail 'Docker Compose v2 is required. Update your Docker installation.'

node_command=()
if command -v node >/dev/null 2>&1 && node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 24 ? 0 : 1)' >/dev/null 2>&1; then
  node_command=(node)
else
  node_command=(docker run --rm -i --user "$(id -u):$(id -g)" --mount "type=bind,source=$(pwd),target=/workspace" --workdir /workspace node:24-bookworm-slim node)
fi
config() { "${node_command[@]}" scripts/launcher-config.mjs "$@"; }
prompt() {
  local answer=''
  if [ -t 0 ] && ! $automatic; then
    printf '  %s [%s]: ' "$1" "$2" >&2
    IFS= read -r answer || fail 'Setup cancelled.'
  fi
  printf '%s' "${answer:-$2}"
}
port_available() {
  local result=''
  if result="$(docker run --rm -p "127.0.0.1:$1:39999" node:24-bookworm-slim node -e 'process.exit(0)' 2>&1)"; then
    return 0
  fi
  case "$result" in
    *"port is already allocated"*|*"address already in use"*|*"port is already in use"*) return 1 ;;
    *) printf '%s\n' 'Docker could not check the port. Check Docker networking and image downloads.' "$result" >&2; exit 2 ;;
  esac
}
choose_port() {
  local candidate="$1" attempts=0
  while true; do
    if port_available "$candidate"; then break; else
      local code=$?
      [ "$code" -eq 1 ] || exit "$code"
    fi
    attempts=$((attempts + 1))
    [ "$attempts" -lt 20 ] && [ "$candidate" -lt 65535 ] || fail 'Could not find an available port. Choose one with --port.'
    say "Port $candidate is busy; checking the next one." >&2
    candidate=$((candidate + 1))
  done
  printf '%s' "$candidate"
}

first=false
if [ ! -e .env ]; then
  case "$command_name" in
    stop|status|logs|update) fail 'No saved installation yet. Run ./soratra.sh first.' ;;
  esac
  first=true
  printf '  %sFIRST SETUP%s\n' "$ink" "$reset"
  say 'Your journal and database stay on this computer.'
  say 'Book search uses Open Library; no API key is needed.'
  say 'Password recovery by email is off until you configure a sender.'
  printf '\n'
  explicit_port=false
  [ -z "$port" ] || explicit_port=true
  port="${port:-$(prompt 'Local port' 3000)}"
  [[ "$port" =~ ^[1-9][0-9]*$ ]] && [ "$port" -ge 1024 ] && [ "$port" -le 65535 ] || fail 'Choose a port between 1024 and 65535.'
  if $explicit_port; then
    port_available "$port" || fail "Port $port is busy. Choose another with --port."
  else
    port="$(choose_port "$port")"
  fi
  operator="${operator:-Personal installation}"
  support="${support:-}"
  config validate APP_PORT "$port" LEGAL_NAME "$operator" SUPPORT_EMAIL "$support"
  run_step 'Creating private settings' "${node_command[@]}" scripts/setup.mjs
  if ! config edit APP_PORT "$port" LEGAL_NAME "$operator" SUPPORT_EMAIL "$support"; then
    rm -- .env
    fail 'Setup failed before saving settings. Run the launcher again.'
  fi
  edit=false
fi

if [ "$command_name" = advanced ]; then
  source scripts/launcher-advanced.sh
  advanced_settings
  exit 0
fi

saved="$(config read)"
saved_port="$(printf '%s\n' "$saved" | sed -n '1p')"
saved_operator="$(printf '%s\n' "$saved" | sed -n '4p')"
saved_support="$(printf '%s\n' "$saved" | sed -n '5p')"
mode="$(printf '%s\n' "$saved" | sed -n '3p')"
compose=(docker compose -f compose.yaml)
if [ "$mode" = public ]; then compose+=(-f compose.public.yaml); fi
if [ "$command_name" = configure ] && ! $first && ! $edit; then
  port="$(prompt 'Local port' "$saved_port")"
  say 'Personal details, email, and hosting settings are in ./soratra.sh advanced.'
  edit=true
fi
if $edit; then
  case "$command_name" in stop|status|logs) fail 'Use configure or start when changing settings.' ;; esac
  edits=(LEGAL_NAME "$saved_operator")
  [ -z "$port" ] || edits+=(APP_PORT "$port")
  [ -z "$operator" ] || edits+=(LEGAL_NAME "$operator")
  if $support_provided; then edits+=(SUPPORT_EMAIL "$support"); fi
  config validate "${edits[@]}"
  if [ -n "$port" ] && [ "$port" != "$saved_port" ]; then
    port_available "$port" || fail "Port $port is busy. Choose another with --port. Saved settings have not changed."
  fi
  config edit "${edits[@]}"
  say 'Saved settings in private .env. Existing credentials are preserved.'
fi
saved="$(config read)"
origin="$(printf '%s\n' "$saved" | sed -n '2p')"
case "$command_name" in
  configure) printf '\nSaved. Run ./soratra.sh to start at %s\n\n' "$origin"; exit 0 ;;
  stop) run_step 'Stopping Soratra' "${compose[@]}" stop; say 'Stopped. Your reading data is saved.'; printf '\n'; exit 0 ;;
  status) "${compose[@]}" ps --all; exit 0 ;;
  logs) "${compose[@]}" logs --follow --tail 100 app scheduler; exit 0 ;;
  update)
    say 'Updating. Make sure you have a database backup.'
    if [ -t 0 ] && ! $automatic; then
      [ "$(prompt 'Continue? Type yes' no)" = yes ] || fail 'Update cancelled.'
    elif ! $automatic; then fail 'Use --yes after making a backup to update without a terminal.'; fi
    run_step 'Updating Soratra' ./scripts/upgrade.sh "${compose[@]:2}" ;;
  start)
    if $first || ! docker image inspect soratra:local soratra-tools:local >/dev/null 2>&1; then
      say 'The first build can take a few minutes.'
      run_step 'Building Soratra' "${compose[@]}" build app migrate scheduler
    fi
    run_step 'Starting database' "${compose[@]}" up -d --wait --wait-timeout 180 db
    run_step 'Preparing database' "${compose[@]}" run --rm migrate
    run_step 'Starting your journal' "${compose[@]}" up -d --wait --wait-timeout 180 --no-build --remove-orphans ;;
esac
printf '\n  %sYOUR JOURNAL IS READY%s\n\n' "$accent$ink" "$reset"
printf '  Open      %s%s%s\n' "$ink" "$origin" "$reset"
printf '  %sStop      ./soratra.sh stop\n  Settings  ./soratra.sh configure%s\n\n' "$muted" "$reset"
if $open_browser && [ -t 0 ]; then
  if command -v open >/dev/null 2>&1; then open "$origin" || true
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$origin" >/dev/null 2>&1 || true
  fi
fi

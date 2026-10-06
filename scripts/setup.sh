#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ -e .env ]; then
  echo 'Configuration already exists; refusing to overwrite .env.' >&2
  exit 1
fi
docker run --rm --user "$(id -u):$(id -g)" \
  --mount "type=bind,source=$(pwd),target=/workspace" \
  --workdir /workspace node:24-bookworm-slim node scripts/setup.mjs

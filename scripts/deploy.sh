#!/usr/bin/env bash
# Copies the console to the server and rebuilds the container.
#
#   scripts/deploy.sh [ssh-host]     (default: hkn)
#
# Never sends .env, data/ or node_modules; the server keeps its own .env and
# archived builds in ~/ci-console.
set -euo pipefail

host="${1:-hkn}"
cd "$(dirname "$0")/.."

rsync -az --delete \
  --exclude node_modules --exclude .next --exclude data --exclude '.env*' --exclude .git \
  ./ "$host:ci-console/"

ssh "$host" 'cd ~/ci-console && docker compose up -d --build && docker compose ps'

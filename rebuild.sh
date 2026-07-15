#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ ! -f index.html || ! -f compose.yaml ]]; then
  echo "Error: rebuild.sh must be run from a Voxel Destruction environment." >&2
  exit 1
fi

docker network inspect edge >/dev/null 2>&1 || docker network create edge >/dev/null
mkdir -p data logs output

echo "Running validation inside Docker..."
docker compose run --rm --no-deps test

echo "Rebuilding and recreating the web container..."
docker compose up --build --force-recreate -d --remove-orphans

echo "Rebuild completed successfully."

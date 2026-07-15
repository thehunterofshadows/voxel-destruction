#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_NAME="voxel-destruction"
PROD_WORKTREE="/home/justin/run/${REPO_NAME}-prod"

cd "$REPO_ROOT"

if [[ ! -f index.html || ! -f compose.yaml ]]; then
  echo "Error: setup.sh must be run from the voxel-destruction repository root." >&2
  exit 1
fi

REMOTE="$(git remote | head -n 1 || true)"
if [[ -n "$REMOTE" ]]; then
  git fetch "$REMOTE"
fi

if ! git show-ref --verify --quiet refs/heads/main; then
  git branch main "$REMOTE/main"
fi

if ! git show-ref --verify --quiet refs/heads/dev; then
  if [[ -n "$REMOTE" ]] && git show-ref --verify --quiet "refs/remotes/${REMOTE}/dev"; then
    git branch dev "$REMOTE/dev"
  else
    git branch dev main
    if [[ -n "$REMOTE" ]]; then
      git push -u "$REMOTE" dev
    fi
  fi
fi

if [[ "$(git branch --show-current)" != "dev" ]]; then
  git switch dev
fi

if [[ -n "$REMOTE" ]] && ! git rev-parse --abbrev-ref 'dev@{upstream}' >/dev/null 2>&1; then
  git push -u "$REMOTE" dev
fi

docker network inspect edge >/dev/null 2>&1 || docker network create edge >/dev/null
mkdir -p data logs output

if [[ ! -f .env ]]; then
  printf '%s\n' \
    'APP_ENV=dev' \
    'COMPOSE_PROJECT_NAME=voxel-destruction-dev' \
    'WEB_CONTAINER_NAME=voxel-destruction-dev-web' > .env
fi

mkdir -p "$(dirname "$PROD_WORKTREE")"
if [[ ! -e "$PROD_WORKTREE/.git" ]]; then
  if [[ -e "$PROD_WORKTREE" ]]; then
    echo "Error: $PROD_WORKTREE exists but is not a git worktree." >&2
    exit 1
  fi
  git worktree add "$PROD_WORKTREE" main
fi

if [[ ! -f "$PROD_WORKTREE/.env" ]]; then
  printf '%s\n' \
    'APP_ENV=prod' \
    'COMPOSE_PROJECT_NAME=voxel-destruction-prod' \
    'WEB_CONTAINER_NAME=voxel-destruction-prod-web' > "$PROD_WORKTREE/.env"
fi
mkdir -p "$PROD_WORKTREE/data" "$PROD_WORKTREE/logs" "$PROD_WORKTREE/output"

echo "Starting Dev stack..."
docker compose up --build -d --remove-orphans

echo "Starting Prod stack..."
(cd "$PROD_WORKTREE" && docker compose up --build -d --remove-orphans)

echo
echo "Voxel Destruction setup complete."
echo "Dev:  https://dev-destruction.fireorbooty.com"
echo "Prod: https://destruction.fireorbooty.com"

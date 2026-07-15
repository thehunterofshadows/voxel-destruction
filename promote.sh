#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROD_WORKTREE="/home/justin/run/voxel-destruction-prod"

cd "$REPO_ROOT"

if [[ ! -f index.html || "$(git branch --show-current)" != "dev" ]]; then
  echo "Error: promote.sh must be run from the root dev checkout." >&2
  exit 1
fi

if [[ $# -ne 1 ]]; then
  echo "Usage: ./promote.sh [--dry-run | --confirm]" >&2
  exit 1
fi

case "$1" in
  --dry-run)
    echo "Commits on dev not yet in main:"
    git log main..dev --oneline
    echo
    echo "Files changed between main and dev:"
    git diff --name-status main..dev
    echo
    echo "Run ./promote.sh --confirm only after explicit production approval."
    ;;
  --confirm)
    if [[ ! -e "$PROD_WORKTREE/.git" ]]; then
      echo "Error: Prod worktree missing at $PROD_WORKTREE. Run ./setup.sh first." >&2
      exit 1
    fi
    if [[ -n "$(git status --porcelain)" ]]; then
      echo "Error: Dev working tree is not clean." >&2
      git status --short
      exit 1
    fi
    if [[ -n "$(git -C "$PROD_WORKTREE" status --porcelain --untracked-files=no)" ]]; then
      echo "Error: Prod working tree is not clean." >&2
      git -C "$PROD_WORKTREE" status --short
      exit 1
    fi

    REMOTE="$(git remote | head -n 1 || true)"
    if [[ -n "$REMOTE" ]]; then
      git pull --ff-only "$REMOTE" dev
    fi

    (
      cd "$PROD_WORKTREE"
      if [[ -n "$REMOTE" ]]; then
        git pull --ff-only "$REMOTE" main
      fi
      git merge dev --no-edit
      if [[ -n "$REMOTE" ]]; then
        git push "$REMOTE" main
      fi
      ./rebuild.sh
    )
    echo "Promotion completed: https://destruction.fireorbooty.com"
    ;;
  *)
    echo "Error: use --dry-run or --confirm." >&2
    exit 1
    ;;
esac

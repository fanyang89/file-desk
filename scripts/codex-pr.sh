#!/usr/bin/env bash
set -euo pipefail

BASE_BRANCH="${BASE_BRANCH:-main}"
COMMIT_MSG="${1:-}"
PR_TITLE="${2:-}"

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: gh CLI not found. Reopen the project in devcontainer or install gh first." >&2
  exit 1
fi

if [[ -z "$COMMIT_MSG" ]]; then
  echo "Usage: bash scripts/codex-pr.sh \"<commit message>\" [\"<pr title>\"]" >&2
  echo "Example: bash scripts/codex-pr.sh \"Add bulk rename support\" \"Add bulk rename support\"" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Error: GitHub auth missing. Run: gh auth login" >&2
  exit 1
fi

CURRENT_BRANCH="$(git branch --show-current)"
if [[ -z "$CURRENT_BRANCH" ]]; then
  echo "Error: Unable to detect current branch." >&2
  exit 1
fi

if [[ "$CURRENT_BRANCH" == "$BASE_BRANCH" ]]; then
  CURRENT_BRANCH="codex/$(date +%Y%m%d-%H%M%S)"
  git checkout -b "$CURRENT_BRANCH"
fi

echo "Running quality checks..."
bun run lint
bun run build

if [[ -z "$(git status --porcelain)" ]]; then
  echo "No local changes. Skipping commit."
else
  git add -A
  git commit -m "$COMMIT_MSG"
fi

git push -u origin "$CURRENT_BRANCH"

if gh pr view "$CURRENT_BRANCH" >/dev/null 2>&1; then
  echo "PR already exists for branch: $CURRENT_BRANCH"
  gh pr view "$CURRENT_BRANCH" --web
  exit 0
fi

if [[ -z "$PR_TITLE" ]]; then
  gh pr create --base "$BASE_BRANCH" --head "$CURRENT_BRANCH" --fill
else
  gh pr create --base "$BASE_BRANCH" --head "$CURRENT_BRANCH" --title "$PR_TITLE" --fill
fi

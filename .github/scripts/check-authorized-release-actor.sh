#!/usr/bin/env bash
# Verifies github.actor is listed in CODEOWNERS (individual users only).
# Usage: check-authorized-release-actor.sh

set -euo pipefail

ACTOR="${GITHUB_ACTOR:?GITHUB_ACTOR required}"
CODEOWNERS_FILE="${1:-.github/CODEOWNERS}"

AUTHORIZED_USERS=$(grep -o '@[a-zA-Z0-9_-]*[^/]' "$CODEOWNERS_FILE" | grep -v '@devrev/' | sed 's/@//' | tr '\n' ' ')

if ! echo "$AUTHORIZED_USERS" | grep -q "\b${ACTOR}\b"; then
  echo "::error::User $ACTOR is not authorized to run release workflows" >&2
  echo "Only users listed in $CODEOWNERS_FILE can trigger releases" >&2
  exit 1
fi

echo "Authorized release actor: $ACTOR"

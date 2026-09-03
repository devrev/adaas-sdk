#!/usr/bin/env bash
# Fails if npm already has a version in the same minor line >= target version.
# Usage: check-npm-minor-line.sh <package_name> <target_version>
# Example: check-npm-minor-line.sh @devrev/ts-adaas 1.19.0

set -euo pipefail

PACKAGE="${1:?package name required}"
TARGET="${2:?target version required}"

MAJOR=$(echo "$TARGET" | cut -d. -f1)
MINOR=$(echo "$TARGET" | cut -d. -f2)
PREFIX="${MAJOR}.${MINOR}."

VERSIONS_JSON=$(npm view "$PACKAGE" versions --json 2>/dev/null || echo "[]")

CONFLICT=$(echo "$VERSIONS_JSON" | jq -r --arg prefix "$PREFIX" --arg target "$TARGET" '
  [.[] | select(startswith($prefix))] |
  map(select(. >= $target)) |
  if length > 0 then .[-1] else empty end
')

if [ -n "$CONFLICT" ]; then
  echo "::error::Cannot publish $TARGET: npm already has version $CONFLICT in the ${MAJOR}.${MINOR} line" >&2
  exit 1
fi

echo "No conflicting versions found in ${MAJOR}.${MINOR} line for target $TARGET"

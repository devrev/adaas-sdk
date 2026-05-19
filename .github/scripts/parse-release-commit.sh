#!/usr/bin/env bash
# Parses the first line of a commit message for release commands.
# Usage: parse-release-commit.sh "<commit message>" "<ref_name>"
# Writes command, version, and release_line to GITHUB_OUTPUT when set.

set -euo pipefail

COMMIT_MSG="${1:?commit message required}"
REF_NAME="${2:?ref name required}"

FIRST_LINE=$(echo "$COMMIT_MSG" | head -n1)

write_output() {
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "command=$1" >> "$GITHUB_OUTPUT"
    echo "version=${2:-}" >> "$GITHUB_OUTPUT"
    echo "release_line=${3:-}" >> "$GITHUB_OUTPUT"
  else
    echo "command=$1"
    echo "version=${2:-}"
    echo "release_line=${3:-}"
  fi
}

if [[ "$FIRST_LINE" =~ ^beta/([0-9]+\.[0-9]+\.[0-9]+-beta\.[0-9]+)$ ]]; then
  if [[ "$REF_NAME" != "main" ]]; then
    echo "::error::beta release commands must be merged to main (current branch: $REF_NAME)" >&2
    exit 1
  fi
  write_output "beta" "${BASH_REMATCH[1]}" ""
  exit 0
fi

if [[ "$FIRST_LINE" =~ ^release/([0-9]+\.[0-9]+)$ ]]; then
  if [[ "$REF_NAME" != "main" ]]; then
    echo "::error::release commands must be merged to main (current branch: $REF_NAME)" >&2
    exit 1
  fi
  MINOR="${BASH_REMATCH[1]}"
  write_output "release" "${MINOR}.0" "$MINOR"
  exit 0
fi

if [[ "$FIRST_LINE" =~ ^patch/([0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
  VERSION="${BASH_REMATCH[1]}"
  MINOR=$(echo "$VERSION" | cut -d. -f1-2)
  EXPECTED_BRANCH="release/$MINOR"
  if [[ "$REF_NAME" != "$EXPECTED_BRANCH" ]]; then
    echo "::error::patch/$VERSION must be merged to $EXPECTED_BRANCH (current branch: $REF_NAME)" >&2
    exit 1
  fi
  write_output "patch" "$VERSION" "$MINOR"
  exit 0
fi

write_output "none" "" ""

#!/usr/bin/env bash
# Validates release command format (branch-agnostic). Exits 0 on valid format, 1 otherwise.
# Usage: validate-release-command.sh "<first line of commit message>"

set -euo pipefail

MSG="${1:?commit message required}"
FIRST_LINE=$(echo "$MSG" | head -n1)

if [[ "$FIRST_LINE" =~ ^beta/[0-9]+\.[0-9]+\.[0-9]+-beta\.[0-9]+$ ]]; then
  exit 0
fi

if [[ "$FIRST_LINE" =~ ^release/[0-9]+\.[0-9]+$ ]]; then
  exit 0
fi

if [[ "$FIRST_LINE" =~ ^patch/[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  exit 0
fi

echo "Invalid release command format: $FIRST_LINE" >&2
echo "Expected one of:" >&2
echo "  beta/X.Y.Z-beta.N   (e.g. beta/1.19.4-beta.0)" >&2
echo "  release/X.Y         (e.g. release/1.19)" >&2
echo "  patch/X.Y.Z         (e.g. patch/1.19.5)" >&2
exit 1

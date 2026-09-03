#!/usr/bin/env bash
# Prints a PR comment body for a release-command PR title.
# Usage: pr-release-comment.sh "<pr title>" "<base branch>"

set -euo pipefail

TITLE="${1:?PR title required}"
BASE="${2:?base branch required}"
FIRST_LINE=$(echo "$TITLE" | head -n1)

if [[ "$FIRST_LINE" =~ ^beta/([0-9]+\.[0-9]+\.[0-9]+-beta\.[0-9]+)$ ]]; then
  VERSION="${BASH_REMATCH[1]}"
  if [[ "$BASE" != "main" ]]; then
    echo "::error::Beta releases must target \`main\` (current base: \`$BASE\`)"
    exit 1
  fi
  cat <<EOF
## Release command: beta

Merging this PR to \`main\` with the title \`$FIRST_LINE\` will trigger the **beta release** workflow:

- Set package version to \`$VERSION\`
- Run tests and publish \`@devrev/ts-adaas@$VERSION\` to npm with the \`beta\` tag
- Push version commit and git tag to \`main\`

**Requirements:** squash merge with PR title as the commit message; only CODEOWNERS can merge.
EOF
  exit 0
fi

if [[ "$FIRST_LINE" =~ ^release/([0-9]+\.[0-9]+)$ ]]; then
  MINOR="${BASH_REMATCH[1]}"
  VERSION="${MINOR}.0"
  if [[ "$BASE" != "main" ]]; then
    echo "::error::Release line cuts must target \`main\` (current base: \`$BASE\`)"
    exit 1
  fi
  cat <<EOF
## Release command: release line

Merging this PR to \`main\` with the title \`$FIRST_LINE\` will trigger the **release line** workflow:

- Create branch \`release/$MINOR\` from \`main\`
- Set package version to \`$VERSION\` and publish to npm with the \`latest\` tag
- Push \`release/$MINOR\` and git tag \`$VERSION\`

Fails if \`release/$MINOR\` already exists or npm already has a \`$MINOR.x\` version >= \`$VERSION\`.

**Requirements:** squash merge with PR title as the commit message; only CODEOWNERS can merge.
EOF
  exit 0
fi

if [[ "$FIRST_LINE" =~ ^patch/([0-9]+\.[0-9]+\.[0-9]+)$ ]]; then
  VERSION="${BASH_REMATCH[1]}"
  MINOR=$(echo "$VERSION" | cut -d. -f1-2)
  EXPECTED="release/$MINOR"
  if [[ "$BASE" != "$EXPECTED" ]]; then
    echo "::error::Patch releases must target \`$EXPECTED\` (current base: \`$BASE\`)"
    exit 1
  fi
  cat <<EOF
## Release command: patch

Merging this PR to \`$EXPECTED\` with the title \`$FIRST_LINE\` will trigger the **patch release** workflow:

- Set package version to \`$VERSION\` and publish to npm with the \`latest\` tag
- Open an automated backport PR to \`main\` titled \`backport: patch/$VERSION\`

**Requirements:** squash merge with PR title as the commit message; only CODEOWNERS can merge.
EOF
  exit 0
fi

echo "Invalid release command in PR title: $FIRST_LINE" >&2
exit 1

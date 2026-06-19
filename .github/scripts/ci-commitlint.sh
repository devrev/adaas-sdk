#!/usr/bin/env bash
# Validates PR title and all commits in a pull request for conventional or release-command format.
# Requires: PR_TITLE, BASE_SHA, HEAD_SHA environment variables.

set -euo pipefail

PR_TITLE="${PR_TITLE:?PR_TITLE required}"
BASE_SHA="${BASE_SHA:?BASE_SHA required}"
HEAD_SHA="${HEAD_SHA:?HEAD_SHA required}"

lint_message() {
  local msg="$1"
  local first
  first=$(echo "$msg" | head -n1)

  case "$first" in
    beta/*|release/*|patch/*)
      bash .github/scripts/validate-release-command.sh "$first"
      ;;
    *)
      echo "$msg" | npx commitlint
      ;;
  esac
}

echo "Validating PR title: $PR_TITLE"
lint_message "$PR_TITLE"

if [ "$BASE_SHA" = "$HEAD_SHA" ]; then
  echo "No commits to validate"
  exit 0
fi

echo "Validating commits between $BASE_SHA and $HEAD_SHA"
while read -r sha; do
  [ -z "$sha" ] && continue
  msg=$(git log -1 --pretty=%B "$sha")
  echo "Checking commit $sha"
  lint_message "$msg"
done < <(git rev-list "${BASE_SHA}..${HEAD_SHA}")

echo "All commit messages valid"

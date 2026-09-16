#!/usr/bin/env bash
set -euo pipefail

tag="${1:?usage: update-changelog.sh <tag> <notes-file>}"
notes_file="${2:?usage: update-changelog.sh <tag> <notes-file>}"
changelog_file="${CHANGELOG_FILE:-CHANGELOG.md}"
release_date="$(date -u +%Y-%m-%d)"
tmp_file="$(mktemp)"

if [ ! -f "$changelog_file" ]; then
  {
    echo "# Changelog"
    echo
    echo "All notable changes to Tomahawk will be documented in this file."
    echo
  } > "$changelog_file"
fi

if grep -Eq "^## \\[$tag\\]|^## $tag" "$changelog_file"; then
  echo "$changelog_file already has an entry for $tag" >&2
  exit 0
fi

{
  sed -n '1,/^# Changelog$/p' "$changelog_file"
  echo
  echo "## [$tag] - $release_date"
  echo
  cat "$notes_file"
  echo
  sed '1,/^# Changelog$/d' "$changelog_file" | sed '/./,$!d'
} > "$tmp_file"

mv "$tmp_file" "$changelog_file"

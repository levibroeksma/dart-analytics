#!/usr/bin/env bash
# Decides whether a Dependabot PR needs the Claude impact review. Reads
# dependabot/fetch-metadata's updated-dependencies-json (argument 1) and prints
# breaking=true when any dependency is a semver-major update, its major number
# changes (covers a null updateType, for example action tags), or a minor bump
# of a 0.x version (where a minor can break the API); otherwise breaking=false.
# Used by .github/workflows/dependency-review.yml.
set -euo pipefail

jq -r '
  def parts: ltrimstr("v") | split(".");
  def version_break:
    (.prevVersion // "" | parts) as $p
    | (.newVersion // "" | parts) as $n
    | ($p[0] // "") != "" and ($n[0] // "") != ""
      and ($p[0] != $n[0] or ($p[0] == "0" and $p[1] != $n[1]));
  "breaking=" + (any(.[]; .updateType == "version-update:semver-major" or version_break) | tostring)
' <<< "${1:-[]}"

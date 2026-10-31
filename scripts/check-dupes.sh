#!/usr/bin/env bash
# Clone-group ratchet (rule of three; D512). `fallow dupes` groups are keyed by the
# sorted unique file set of their instances; scripts/dupes-baseline.txt holds
# `<count>\t<key>` per key. Fails when a key's count rises or a new key
# appears ("new clone group"), and when a baseline count exceeds the current
# one ("stale baseline row, lower it") so the baseline only ever shrinks.
#   bash scripts/check-dupes.sh            check
#   bash scripts/check-dupes.sh --update   rewrite the baseline
# DUPES_JSON=<file> replaces the fallow run; DUPES_BASELINE=<file> the baseline.
#
# WHAT THIS CANNOT CATCH: a clone added inside a file set that already has
# groups, when the file set's count is unchanged by an offsetting removal.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE="${DUPES_BASELINE:-$ROOT/scripts/dupes-baseline.txt}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ -n "${DUPES_JSON:-}" ]; then
  cp "$DUPES_JSON" "$TMP/in.json"
else
  # Default output lists every group (clone_groups_omitted stays 0 without --top).
  (cd "$ROOT/app" && npx -y fallow@3.38.0 dupes --format json --no-fragments --quiet) > "$TMP/in.json" || true
fi

OM="$(jq -r '.clone_groups_omitted // 0' "$TMP/in.json" 2>/dev/null)" || { echo "check-dupes: unreadable fallow output" >&2; exit 1; }
if [ "$OM" != 0 ]; then echo "check-dupes: $OM clone groups omitted from output; cannot ratchet" >&2; exit 1; fi

jq -r '.clone_groups[] | [.instances[].file] | unique | join(" | ")' "$TMP/in.json" \
  | LC_ALL=C sort | uniq -c | sed -E 's/^ *([0-9]+) (.*)$/\1\t\2/' > "$TMP/cur.txt"

if [ "${1:-}" = "--update" ]; then
  cp "$TMP/cur.txt" "$BASE"
  echo "check-dupes: baseline rewritten ($(wc -l < "$BASE") rows)"
  exit 0
fi

LC_ALL=C sort -t$'\t' -k2 "$BASE" > "$TMP/base.txt"
FAIL=0
while IFS=$'\t' read -r n key; do
  b="$(awk -F'\t' -v k="$key" '$2==k{print $1}' "$TMP/base.txt")"
  if [ -z "$b" ] || [ "$n" -gt "$b" ]; then echo "new clone group: $key (now $n, baseline ${b:-0})" >&2; FAIL=1; fi
done < "$TMP/cur.txt"
while IFS=$'\t' read -r b key; do
  n="$(awk -F'\t' -v k="$key" '$2==k{print $1}' "$TMP/cur.txt")"
  if [ -z "$n" ] || [ "$b" -gt "$n" ]; then echo "stale baseline row, lower it: $key (baseline $b, now ${n:-0}); run: bash scripts/check-dupes.sh --update" >&2; FAIL=1; fi
done < "$TMP/base.txt"

if [ "$FAIL" -ne 0 ]; then exit 1; fi
echo "check-dupes: ok ($(wc -l < "$TMP/cur.txt") file sets)"

#!/usr/bin/env bash
# Type gate wrapper (#1323): runs `npm run check` in app/ and ends with its
# verdict as the last line, so a trimmed read (`tail -1`) cannot show a clean
# result for a failing run. `astro check` prints its error count several lines
# from the end, under per-file diagnostics and adapter noise.
#   pass: one line, `check: 0 errors, 0 warnings, 0 hints`, exit 0
#   fail: the full check output, then `check: N errors, N warnings, N hints`
#         (or `check: no summary found`), exit 1
# CHECK_TYPES_CMD=<command> replaces `npm run check` (fixtures).
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$(mktemp)"
trap 'rm -f "$OUT"' EXIT

(cd "$ROOT/app" && eval "${CHECK_TYPES_CMD:-npm run check}") > "$OUT" 2>&1
code=$?

count() { sed -nE "s/^- ([0-9]+) $1s?\$/\\1/p" "$OUT" | tail -1; }
e="$(count error)"; w="$(count warning)"; h="$(count hint)"

if [ -z "$e" ] || [ -z "$w" ] || [ -z "$h" ]; then
  cat "$OUT" >&2
  echo "check: no summary found (exit $code)" >&2
  exit 1
fi
SUMMARY="check: $e errors, $w warnings, $h hints"
if [ "$code" -ne 0 ] || [ "$e" != 0 ] || [ "$w" != 0 ] || [ "$h" != 0 ]; then
  cat "$OUT" >&2
  echo "$SUMMARY" >&2
  exit 1
fi
echo "$SUMMARY"

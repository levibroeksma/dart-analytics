#!/usr/bin/env bash
# Fixture test for scripts/scaffold-game-screens.sh: against a copy of the
# Fives screen files it writes the nine renamed files with no leftover
# "fives" spelling, then refuses a second run.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$ROOT/scripts/scaffold-game-screens.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASSED=0
FAILED=0
ok() { PASSED=$((PASSED + 1)); }
fail() { FAILED=$((FAILED + 1)); echo "FAIL: $1" >&2; }

while read -r path; do
  mkdir -p "$TMP/$(dirname "$path")"
  cp "$ROOT/$path" "$TMP/$path"
done < <(git -C "$ROOT" ls-files 'app/src/*ives*' 'app/src/pages/games/fives/*')

out="$(SCAFFOLD_ROOT="$TMP" bash "$SCRIPT" Bull500 bull-500 bull-500 2>&1)"; code=$?
[ "$code" -eq 0 ] && ok || fail "scaffold exited $code: $out"

written="$(printf '%s\n' "$out" | grep -c '^wrote ')"
[ "$written" -eq 9 ] && ok || fail "wrote $written files, wanted 9"

for path in \
  app/src/lib/game/bull-500-seats.ts \
  app/src/lib/game/bull-500-setup.data.ts \
  app/src/lib/game/bull-500-play.data.ts \
  app/src/components/layout/games/Bull500RecreationalInput.astro \
  app/src/components/layout/games/interfaces/Bull500.astro \
  app/src/components/layout/games/result-modals/Bull500Results.astro \
  app/src/components/layout/games/setup/Bull500SetupForm.astro \
  app/src/pages/games/bull-500/setup/index.astro \
  app/src/pages/games/bull-500/play/index.astro; do
  [ -f "$TMP/$path" ] && ok || fail "missing $path"
done

leftover="$(cd "$TMP" && grep -rli 'fives' app/src/lib/game/bull-500-* app/src/components/layout/games/*Bull500* app/src/components/layout/games/*/Bull500* app/src/pages/games/bull-500 | wc -l)"
[ "$leftover" -eq 0 ] && ok || fail "$leftover scaffolded file(s) still say fives"

grep -q 'bull500Setup' "$TMP/app/src/lib/game/bull-500-setup.data.ts" && ok || fail "setup controller not renamed to bull500Setup"
grep -q 'BULL_500_V1' "$TMP/app/src/lib/game/bull-500-setup.data.ts" && ok || fail "ruleset key not renamed to BULL_500_V1"

SCAFFOLD_ROOT="$TMP" bash "$SCRIPT" Bull500 bull-500 bull-500 >/dev/null 2>&1
[ "$?" -eq 1 ] && ok || fail "second run did not refuse to overwrite"

echo "test-scaffold-game-screens: $PASSED passed, $FAILED failed"
[ "$FAILED" -eq 0 ]

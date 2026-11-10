#!/usr/bin/env bash
# Scaffolds a kernel-bound game's screens PR from Fives, the exemplar:
#   bash scripts/scaffold-game-screens.sh <Pascal> <code-slug> <route-slug>
#   e.g. bash scripts/scaffold-game-screens.sh Bull500 bull-500 bull-500
# Copies the nine Fives screen files (seats, setup and play data, input,
# interface, results modal, setup form, two pages) to their new names with
# Fives/fives/FIVES renamed. The copies still name Fives' engine and rules;
# they are a starting shape to edit, not a working game. Tests are not copied:
# write them first (app/CLAUDE.md §Test-Driven Development). Refuses to
# overwrite. $SCAFFOLD_ROOT overrides the repo root (the fixture test).
set -u

if [ "$#" -ne 3 ]; then
  echo "usage: $0 <Pascal> <code-slug> <route-slug>" >&2
  exit 2
fi

PASCAL="$1"
CODE="$2"
ROUTE="$3"
ROOT="${SCAFFOLD_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

case "$PASCAL" in [A-Z]*) ;; *) echo "Pascal name must start with a capital: $PASCAL" >&2; exit 2 ;; esac
case "$CODE" in [a-z]*) ;; *) echo "code slug must start with a letter: $CODE" >&2; exit 2 ;; esac

CAMEL="$(printf '%s' "$CODE" | awk -F- '{ out = $1; for (i = 2; i <= NF; i++) out = out toupper(substr($i,1,1)) substr($i,2); print out }')"
UPPER="$(printf '%s' "$CODE" | tr 'a-z-' 'A-Z_')"

APP="app/src"
FILES="
$APP/lib/game/fives-seats.ts|$APP/lib/game/$CODE-seats.ts
$APP/lib/game/fives-setup.data.ts|$APP/lib/game/$CODE-setup.data.ts
$APP/lib/game/fives-play.data.ts|$APP/lib/game/$CODE-play.data.ts
$APP/components/layout/games/FivesRecreationalInput.astro|$APP/components/layout/games/${PASCAL}RecreationalInput.astro
$APP/components/layout/games/interfaces/Fives.astro|$APP/components/layout/games/interfaces/$PASCAL.astro
$APP/components/layout/games/result-modals/FivesResults.astro|$APP/components/layout/games/result-modals/${PASCAL}Results.astro
$APP/components/layout/games/setup/FivesSetupForm.astro|$APP/components/layout/games/setup/${PASCAL}SetupForm.astro
$APP/pages/games/fives/setup/index.astro|$APP/pages/games/$ROUTE/setup/index.astro
$APP/pages/games/fives/play/index.astro|$APP/pages/games/$ROUTE/play/index.astro
"

for pair in $FILES; do
  from="${pair%%|*}"
  to="${pair##*|}"
  if [ ! -f "$ROOT/$from" ]; then
    echo "missing exemplar: $from" >&2
    exit 1
  fi
  if [ -e "$ROOT/$to" ]; then
    echo "refusing to overwrite: $to" >&2
    exit 1
  fi
done

for pair in $FILES; do
  from="${pair%%|*}"
  to="${pair##*|}"
  mkdir -p "$(dirname "$ROOT/$to")"
  sed -e "s#/games/fives/#/games/$ROUTE/#g" \
      -e "s#games/fives#games/$ROUTE#g" \
      -e "s/FIVES/$UPPER/g" \
      -e "s/Fives/$PASCAL/g" \
      -e "s/fives-/$CODE-/g" \
      -e "s/fives\\./$CODE./g" \
      -e "s/fives/$CAMEL/g" \
      "$ROOT/$from" > "$ROOT/$to"
  echo "wrote $to"
done

cat <<NEXT

Still to do by hand (docs/architecture/07-Frontend/09-Adding-A-Game.md):
  - tests first: $CODE-seats, $CODE-setup.data, $CODE-play.data
  - types.ts: ${PASCAL}SetupContext, ${PASCAL}SeatResult, ${PASCAL}ResultsSnapshot, ${PASCAL}PlayContext
  - register-route-data.ts and its test; games-visibility.ts and its three lists
  - tests/lib/game/support/factories.ts, then vitest -u on tests/lib/game (factory-surface snapshot)
  - the copies still name Fives' engine, rules and labels: replace them
  - File Inventory, Component Inventory, History entry, rules file header
NEXT

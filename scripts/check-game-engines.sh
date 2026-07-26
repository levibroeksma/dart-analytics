#!/usr/bin/env bash
# Game-engine contract gate (D105/D110/D127 pattern — engine.registry.ts /
# services/rulesets/registry.ts): every app/src/modules/game/*.engine.module.ts
# must (a) export a *EngineFactory, (b) call registerEngineFactory(...), and
# (c) name a rulesetVersionKey with a matching entry in
# app/src/services/rulesets/registry.ts, so engine #6 cannot regress the
# contract with no server-side validator wired up.
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

REGISTRY_FILE="app/src/services/rulesets/registry.ts"
FAIL=0
CONFORMING=0

MODULES=$(find app/src/modules/game -maxdepth 1 -name "*.engine.module.ts" 2>/dev/null | sort)
if [ -z "$MODULES" ]; then
  echo "FAIL: no *.engine.module.ts files found under app/src/modules/game" >&2
  exit 1
fi

if [ ! -f "$REGISTRY_FILE" ]; then
  echo "FAIL: ruleset validator registry not found at $REGISTRY_FILE" >&2
  exit 1
fi

for file in $MODULES; do
  BAD=0

  if ! grep -qE 'export const [A-Za-z0-9_]*EngineFactory\b' "$file"; then
    echo "FAIL: $file exports no *EngineFactory" >&2
    FAIL=1
    BAD=1
  fi

  if ! grep -qE 'registerEngineFactory\(' "$file"; then
    echo "FAIL: $file never calls registerEngineFactory(...)" >&2
    FAIL=1
    BAD=1
  fi

  KEYS=$(grep -oE 'rulesetVersionKey[[:space:]]*[:=][[:space:]]*"[A-Z0-9_]+"' "$file" \
    | grep -oE '"[A-Z0-9_]+"' | tr -d '"' | sort -u)
  if [ -z "$KEYS" ]; then
    echo "FAIL: $file names no rulesetVersionKey" >&2
    FAIL=1
    BAD=1
  else
    for key in $KEYS; do
      if ! grep -qE "(^|[^A-Za-z0-9_])\"?${key}\"?[[:space:]]*:" "$REGISTRY_FILE"; then
        echo "FAIL: $file names rulesetVersionKey \"$key\" with no entry in $REGISTRY_FILE" >&2
        FAIL=1
        BAD=1
      fi
    done
  fi

  if [ "$BAD" -eq 0 ]; then
    echo "OK: $file conforms (rulesetVersionKey: $KEYS)."
    CONFORMING=$((CONFORMING + 1))
  fi
done

if [ "$FAIL" -eq 0 ]; then
  echo "OK: all $CONFORMING game engine module(s) conform to the GameEngine contract."
fi
exit $FAIL

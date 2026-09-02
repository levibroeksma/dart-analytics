#!/usr/bin/env bash
# Game-engine contract gate (D105/D110/D127 pattern — engine.registry.ts /
# services/rulesets/registry.ts): every app/src/modules/game/*.engine.module.ts
# must (a) export a *EngineFactory, (b) call registerEngineFactory(...), and
# (c) name a rulesetVersionKey with a matching entry in
# app/src/services/rulesets/registry.ts and (d) a matching key in
# RULESET_CAPABILITIES (app/src/lib/game/rulesets/capabilities.ts), so engine
# #6 cannot regress the contract with no server-side validator wired up and
# no declared capture/input mode support.
#
# WHAT THIS CANNOT CATCH:
#   * That the modes declared for a rulesetVersionKey in RULESET_CAPABILITIES
#     match what the engine actually implements. This gate proves the key is
#     declared, not that the declared pairs reflect the engine's real
#     behaviour — that parity is the responsibility of the ruleset's own
#     tests, not this structural check.
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

REGISTRY_FILE="app/src/services/rulesets/registry.ts"
CAPABILITIES_FILE="app/src/lib/game/rulesets/capabilities.ts"
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

if [ ! -f "$CAPABILITIES_FILE" ]; then
  echo "FAIL: ruleset capabilities file not found at $CAPABILITIES_FILE" >&2
  exit 1
fi

CAPABILITY_KEYS=$(awk '/^export const RULESET_CAPABILITIES/{flag=1; next} flag && /^};/{flag=0} flag' "$CAPABILITIES_FILE" \
  | grep -oE '^[[:space:]]*"?[A-Z0-9_]+"?:' \
  | sed -E 's/^[[:space:]]*"?([A-Z0-9_]+)"?:$/\1/' \
  | sort -u)
if [ -z "$CAPABILITY_KEYS" ]; then
  echo "FAIL: parsed zero ruleset keys from RULESET_CAPABILITIES in $CAPABILITIES_FILE — cannot verify declared mode support" >&2
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

      if ! printf '%s\n' "$CAPABILITY_KEYS" | grep -qxF "$key"; then
        echo "FAIL: $file names rulesetVersionKey \"$key\" with no entry in RULESET_CAPABILITIES ($CAPABILITIES_FILE)" >&2
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

# --- Resumable ruleset version wiring -----------------------------------
# A game with more than one registered rulesetVersionKey needs its shared
# play page to actually resume all of them, not just the first one ever
# shipped — SHANGHAI_V2 shipped without this and every V2 session silently
# failed to resume (F43).
for file in $MODULES; do
  BASENAME=$(basename "$file" .engine.module.ts)
  PLAY_FILE="app/src/lib/game/${BASENAME}-play.data.ts"
  KEYS=$(grep -oE 'rulesetVersionKey[[:space:]]*[:=][[:space:]]*"[A-Z0-9_]+"' "$file" \
    | grep -oE '"[A-Z0-9_]+"' | tr -d '"' | sort -u)
  KEY_COUNT=$(printf '%s\n' "$KEYS" | grep -c .)
  [ "$KEY_COUNT" -le 1 ] && continue

  if [ ! -f "$PLAY_FILE" ]; then
    echo "FAIL: $file names $KEY_COUNT ruleset versions but $PLAY_FILE does not exist" >&2
    FAIL=1
    continue
  fi
  for key in $KEYS; do
    if ! grep -qF "\"$key\"" "$PLAY_FILE"; then
      echo "FAIL: $PLAY_FILE never references rulesetVersionKey \"$key\" (registered in $file)" >&2
      FAIL=1
    fi
  done
done

if [ "$FAIL" -eq 0 ]; then
  echo "OK: all $CONFORMING game engine module(s) conform to the GameEngine contract."
fi
exit $FAIL

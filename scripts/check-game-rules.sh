#!/usr/bin/env bash
# Guard: docs/game-rules/ rules files match their shape's template contract.
#
# Shape is inferred from the folder. README.md and anything under a _drafts/
# directory are skipped.
#
# Blocking by default: any finding fails the run. Set GAME_RULES_GATE=warn to
# print findings without failing, which is useful mid-edit but is not what CI
# runs. The default was warn until the #464/#465 backfill landed all 12 files
# on the contract (D323).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MODE="${GAME_RULES_GATE:-block}"
FINDINGS=0

note() {
  FINDINGS=$((FINDINGS + 1))
  echo "  $1" >&2
}

# --- shape contracts -------------------------------------------------------
# headings:  required '## ' sections, comma separated
# forbidden: sections that must NOT be present
# applies:   whether the Features table carries an 'Applies to' column
# entry:     whether an 'Entry points:' header field is required
shape_headings() {
  case "$1" in
    game)     echo "Features,Identity,Objective,Config & presets,How to play,Later versions,Capture,Glossary,Open questions" ;;
    exercise) echo "Features,Identity,Exercise type,Objective,Config & presets,How to practise,Later versions,Capture,Glossary,Open questions" ;;
    routine)  echo "Features,Identity,Objective,Steps,Total duration,Config & presets,Ends when,Result,Later versions,Glossary,Open questions" ;;
    trivia)   echo "Features,Identity,Objective,Question model,Answer & feedback,Set structure,Config & presets,Ends when,Result,Persistence,Later versions,Glossary,Open questions" ;;
  esac
}

shape_forbidden() {
  case "$1" in
    routine|trivia) echo "Capture" ;;
    *) echo "" ;;
  esac
}

shape_has_applies() { [ "$1" != "trivia" ]; }
shape_has_entry()   { [ "$1" = "game" ] || [ "$1" = "exercise" ]; }

# --- per-file checks -------------------------------------------------------
check_file() {
  local file="$1" shape="$2"
  local before=$FINDINGS

  # 1. required headings, exact spelling at level 2
  local IFS=','
  read -ra required <<< "$(shape_headings "$shape")"
  unset IFS
  local h
  for h in "${required[@]}"; do
    grep -qE "^## ${h//&/\\&}( |$)" "$file" || note "missing section: ## $h"
  done

  # 1b. forbidden headings
  local forbidden
  forbidden="$(shape_forbidden "$shape")"
  if [ -n "$forbidden" ] && grep -qE "^## $forbidden( |$)" "$file"; then
    note "section not allowed for a $shape: ## $forbidden"
  fi

  # 1c. version-numbered headings
  if grep -qE '^#{2,3} .*\(V[0-9]' "$file"; then
    note "heading carries a version number; headings are version-neutral"
  fi

  # 2/3/4/8. Features table
  local header
  header="$(awk '/^## Features/{f=1;next} f && /^\|/{print; exit}' "$file")"
  if [ -z "$header" ]; then
    note "no Features table"
  else
    grep -q 'Version' <<< "$header" || note "Features table has no Version column"
    grep -q 'Reason'  <<< "$header" || note "Features table has no Reason column"
    if shape_has_applies "$shape"; then
      grep -q 'Applies to' <<< "$header" || note "Features table has no 'Applies to' column"
    fi
    check_feature_rows "$file" "$shape"
  fi

  # 6. header fields
  local cv
  cv="$(grep -m1 '^Current version:' "$file" || true)"
  if [ -z "$cv" ]; then
    note "no 'Current version:' header field"
  elif ! grep -qE '^Current version: (none \(V[0-9]+ in design\)|V[0-9]+ \(shipped [0-9]{4}-[0-9]{2}-[0-9]{2}\))$' <<< "$cv"; then
    note "'Current version:' does not parse: ${cv#Current version: }"
  fi

  if shape_has_entry "$shape"; then
    local ep
    ep="$(grep -m1 '^Entry points:' "$file" || true)"
    if [ -z "$ep" ]; then
      note "no 'Entry points:' header field"
    elif ! grep -qE '^Entry points: (standalone|routine step)(, (standalone|routine step))?$' <<< "$ep"; then
      note "'Entry points:' does not parse: ${ep#Entry points: }"
    fi
  elif grep -q '^Entry points:' "$file"; then
    note "'Entry points:' is not used by a $shape (standalone by definition)"
  fi

  # 7. standalone requirements
  local standalone=0
  case "$shape" in
    routine|trivia) standalone=1 ;;
    *) grep -q '^Entry points:.*standalone' "$file" && standalone=1 ;;
  esac
  if [ "$standalone" -eq 1 ]; then
    grep -qE '^#{2,3} Ends when( |$)' "$file" || note "standalone: no 'Ends when' section"
    grep -qE '^#{2,3} Result( |$)'    "$file" || note "standalone: no 'Result' section"
    local cfg
    cfg="$(awk '/^## Config & presets/{f=1;next} /^## /{f=0} f' "$file" | grep -c '^|' || true)"
    [ "${cfg:-0}" -ge 2 ] || note "standalone: 'Config & presets' has no settings table"
  fi

  # 8. applicability tokens
  if shape_has_applies "$shape"; then
    check_applicability "$file"
  fi

  # 9. Glossary -> Features
  check_glossary "$file"

  if [ "$FINDINGS" -gt "$before" ]; then
    return 1
  fi
  return 0
}

# Version vocabulary + Reason presence, per Features row.
check_feature_rows() {
  local file="$1" shape="$2" line
  while IFS= read -r line; do
    [ -n "$line" ] && note "$line"
  done < <(awk -v shape="$shape" '
    function trim(s) { gsub(/^[ \t]+|[ \t]+$/, "", s); gsub(/\*/, "", s); return s }
    /^## Features/ { inf=1; next }
    /^## / { inf=0 }
    !inf { next }
    /^\|/ {
      if ($0 ~ /^\|[ -]*-+/) next                       # separator row
      if ($0 ~ /Version/ && $0 ~ /Reason/) { hdr=1; next } # header row
      if (!hdr) next
      split($0, c, "|")
      name = trim(c[2]); ver = trim(c[3])
      reason  = (shape == "trivia") ? trim(c[4]) : trim(c[5])
      applies = (shape == "trivia") ? ""         : trim(c[4])
      if (name == "" || name == "\342\200\246") next    # blank or the template ellipsis
      if (ver !~ /^(V[0-9]+|V2\+|Deferred|Dropped)$/)
        print "Features row \"" name "\": invalid Version \"" ver "\""
      else if (ver != "V1" && reason == "")
        print "Features row \"" name "\": " ver " requires a Reason"
      if (shape != "trivia" && applies !~ /^(All|Single|1v1|2\+)$/)
        print "Features row \"" name "\": invalid Applies to \"" applies "\""
    }
  ' "$file")
}

# A non-All "Applies to" on a scheduled row (V1 or V<n>) needs a matching
# token-prefixed statement in the body. Unscheduled rows (V2+/Deferred/Dropped)
# are exempt: their description lives under "Later versions", not as a rule.
check_applicability() {
  local file="$1" tok
  local scheduled
  scheduled="$(awk '
    function trim(s) { gsub(/^[ \t]+|[ \t]+$/, "", s); gsub(/\*/, "", s); return s }
    /^## Features/ { inf=1; next }
    /^## / { inf=0 }
    !inf { next }
    /^\|/ {
      if ($0 ~ /^\|[ -]*-+/) next
      if ($0 ~ /Version/ && $0 ~ /Reason/) { hdr=1; next }
      if (!hdr) next
      split($0, c, "|")
      ver = trim(c[3]); applies = trim(c[4])
      if (ver ~ /^V[0-9]+$/ && applies != "" && applies != "All") print applies
    }
  ' "$file" | sort -u)"

  for tok in Single 1v1 2+; do
    grep -qxF "$tok" <<< "$scheduled" || continue
    grep -qF "**${tok}:**" "$file" \
      || note "Applies to '$tok' on a scheduled feature, but no '**$tok:**' statement in the body"
  done

  if grep -qE '^(1v1|2\+)$' <<< "$scheduled"; then
    if awk '/^## Config & presets/{f=1;next} /^## /{f=0} f' "$file" \
       | grep -qiE '^\|[^|]*Players[^|]*\|[^|]*Single player[^|]*\|[^|]*locked'; then
      note "declares a 1v1/2+ feature but locks Players to single player"
    fi
  fi
}

# Every bold Glossary term must appear verbatim inside a Features row name.
check_glossary() {
  local file="$1"
  local features terms term
  features="$(awk '/^## Features/{f=1;next} /^## /{f=0} f && /^\|/' "$file")"
  terms="$(awk '/^## Glossary/{f=1;next} /^## /{f=0} f && /^\|/' "$file" \
           | grep -oE '\*\*[^*]+\*\*' | sed 's/\*\*//g' | sort -u)"
  [ -z "$terms" ] && return 0
  while IFS= read -r term; do
    [ -z "$term" ] && continue
    [ "$term" = "…" ] && continue
    grep -qF -- "$term" <<< "$features" \
      || note "Glossary term \"$term\" has no Features row"
  done <<< "$terms"
}

# --- walk ------------------------------------------------------------------
declare -a FAILED=()
shapes_for() {
  case "$1" in
    docs/game-rules/rulesets/*)          echo game ;;
    docs/game-rules/training/exercises/*) echo exercise ;;
    docs/game-rules/training/routines/*)  echo routine ;;
    docs/game-rules/training/trivia/*)    echo trivia ;;
  esac
}

CHECKED=0
while IFS= read -r f; do
  case "$f" in */_drafts/*|*/README.md) continue ;; esac
  shape="$(shapes_for "$f")"
  [ -z "$shape" ] && continue
  CHECKED=$((CHECKED + 1))
  before=$FINDINGS
  echo "$f ($shape)"
  check_file "$f" "$shape" || true
  [ "$FINDINGS" -gt "$before" ] && FAILED+=("$f")
done < <(git ls-files 'docs/game-rules/**/*.md' | sort)

echo
echo "check-game-rules: $CHECKED file(s) checked, ${#FAILED[@]} with findings, $FINDINGS finding(s) total"

if [ "$FINDINGS" -eq 0 ]; then
  echo "check-game-rules: PASS"
  exit 0
fi

if [ "$MODE" = "block" ]; then
  echo "check-game-rules: FAIL (GAME_RULES_GATE=block)" >&2
  exit 1
fi

echo "check-game-rules: WARN — not failing (GAME_RULES_GATE=warn)."
echo "                  Unset it to enforce; block is the default."
exit 0

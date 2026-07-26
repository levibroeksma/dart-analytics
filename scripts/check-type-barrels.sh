#!/usr/bin/env bash
# Type-barrel gate (docs/architecture/06-API/03-Shared-Conventions.md, section
# "`types.ts` barrels (type-raising)"). PR #53 review incident: six exported
# types were declared inline in an implementation file, lib/game/types.ts never
# raised ./rulesets/types, and twenty-odd consumers were consequently forced
# onto deep alias paths into the defining folder. Nothing mechanical objected.
#
# Three rules, all checked by parsing syntax rather than prose:
#
#   1. DECLARATION. `export type` / `export interface` never appears in an
#      implementation file. The body lives in that folder's types.ts (for
#      `type`) or interfaces.ts (for `interface`).
#   2. RAISING. Every types.ts/interfaces.ts below an area root is re-raised by
#      its parent folder's matching barrel, and a barrel only ever raises a
#      DIRECT child (`export * from "./<child>/types"`) — never a grandchild,
#      never an alias.
#   3. CONSUMPTION. An aliased barrel import resolves to an area root
#      (`@lib/types`, `@modules/types`, `@services/types`, `@routes/types`, ...)
#      and never to a deeper folder; and a file never reaches its OWN folder's
#      barrel through an alias pointing back at itself (use `./types`).
#
# Area roots are read from app/tsconfig.json's `paths` rather than hardcoded,
# so adding an alias cannot silently desynchronise this gate.
#
# WHAT THIS CANNOT CATCH, stated plainly rather than papered over:
#   * A declaration split across lines (`export\ntype Foo = ...`). Detection is
#     line-based. Prettier never emits that form, and `npm run format:check`
#     gates the tree, so the evasion cannot survive CI — but this script alone
#     would not see it.
#   * Types laundered through a re-export: `export type { X } from "./deep"`
#     in a barrel is the documented named-re-export form (used by
#     lib/client/api/types.ts and pages/api/types.ts for ErrorCode), so it is
#     permitted everywhere a barrel is permitted. Only `export *` is depth-
#     checked. A barrel could therefore name-forward a grandchild's type.
#   * WITHIN-AREA RELATIVE imports (`../types`, `../../types`). Fourteen such
#     imports predate this gate (services/rulesets/*/ validators reaching
#     `../types`, two route handlers reaching `../../types`). They stay inside
#     their own area and never cross an area boundary, which is what rule 3 is
#     about, so they are not flagged. A consumer that wants to dodge rule 3 can
#     therefore use a relative path instead of an alias — but only for types
#     inside its own area, which is the case the convention cares least about.
#   * Whether a raised type is the RIGHT type, or whether a barrel's contents
#     make sense. This is a structural gate, not a design review.
#
# Comments are stripped before matching. That direction is safe: a comment can
# only hide a line from this script, and a comment cannot contain real code, so
# stripping can never turn a genuine violation into a pass. (Contrast the
# refinement-coverage guard, which scanned prose for values and was defeated by
# a comment containing the right numbers.)
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

TSCONFIG="app/tsconfig.json"
SRC_ROOT="app/src"
TEST_ROOT="app/tests"

if [ ! -f "$TSCONFIG" ]; then
  echo "FAIL: $TSCONFIG not found — cannot resolve path aliases" >&2
  exit 1
fi

if [ ! -d "$SRC_ROOT" ]; then
  echo "FAIL: $SRC_ROOT not found" >&2
  exit 1
fi

# alias -> directory, e.g. "lib src/lib", straight from tsconfig paths.
ALIASES=$(grep -oE '"@[A-Za-z0-9]+/\*"[[:space:]]*:[[:space:]]*\[[[:space:]]*"\./[^"]+/\*"' "$TSCONFIG" \
  | sed -E 's#"@([A-Za-z0-9]+)/\*"[[:space:]]*:[[:space:]]*\[[[:space:]]*"\./([^"]+)/\*"#\1 \2#')

if [ -z "$ALIASES" ]; then
  echo "FAIL: no path aliases parsed from $TSCONFIG" >&2
  exit 1
fi

# Every aliased directory is an area root. lib/client/api is the one extra
# barrel root: 03-Shared-Conventions.md "Two barrels at the Worker/browser
# boundary" names @client/api/types as the browser-side barrel by design.
AREA_ROOTS=$(printf '%s\n' "$ALIASES" | awk '{print "app/" $2}' | sort -u)
AREA_ROOTS=$(printf '%s\napp/src/lib/client/api\n' "$AREA_ROOTS" | sort -u)

alias_dir() {
  printf '%s\n' "$ALIASES" | awk -v want="$1" '$1 == want { print "app/" $2; exit }'
}

is_area_root() {
  printf '%s\n' "$AREA_ROOTS" | grep -qxF "$1"
}

# Emits "LINENO<TAB>source" with // and /* */ comments blanked out.
strip_comments() {
  awk '
    { line = $0 }
    in_block {
      if (line ~ /\*\//) { sub(/^.*\*\//, "", line) ; in_block = 0 }
      else { print NR "\t" ; next }
    }
    { sub(/\/\/.*$/, "", line) }
    line ~ /\/\*/ {
      if (line ~ /\*\//) { gsub(/\/\*.*\*\//, "", line) }
      else { sub(/\/\*.*$/, "", line) ; in_block = 1 }
    }
    { print NR "\t" line }
  ' "$1"
}

FAIL=0
DECL_HITS=0
RAISE_HITS=0
IMPORT_HITS=0

# ---------------------------------------------------------------------------
# Rule 1 — no exported type/interface declarations in implementation files.
# Exempt: types.ts / interfaces.ts (the barrels themselves) and *.d.ts ambient
# declaration files (env.d.ts, alpinejs-persist.d.ts). `.astro` `interface Props`
# (D92) is never exported, so the `export` requirement exempts it on its own.
# ---------------------------------------------------------------------------
while IFS= read -r file; do
  base=$(basename "$file")
  case "$base" in
    types.ts | interfaces.ts) continue ;;
    *.d.ts) continue ;;
  esac

  while IFS= read -r hit; do
    [ -z "$hit" ] && continue
    lineno=${hit%%	*}
    body=${hit#*	}
    kind=$(printf '%s' "$body" | grep -oE '\b(type|interface)\b' | head -1)
    target="types.ts"
    [ "$kind" = "interface" ] && target="interfaces.ts"
    echo "FAIL: $file:$lineno declares an exported $kind in an implementation file — move the declaration to $(dirname "$file")/$target and import it back with a relative \"./${target%.ts}\" import" >&2
    FAIL=1
    DECL_HITS=$((DECL_HITS + 1))
  done < <(strip_comments "$file" \
    | grep -E "^[0-9]+	[[:space:]]*export[[:space:]]+(declare[[:space:]]+)?(type|interface)[[:space:]]+[A-Za-z_\$]")
done < <(find "$SRC_ROOT" -type f \( -name "*.ts" -o -name "*.astro" \) | sort)

# ---------------------------------------------------------------------------
# Rule 2 — every barrel is raised by its parent, and only direct children are
# raised.
# ---------------------------------------------------------------------------
while IFS= read -r barrel; do
  dir=$(dirname "$barrel")
  base=$(basename "$barrel" .ts)

  if ! is_area_root "$dir"; then
    parent=$(dirname "$dir")
    child=$(basename "$dir")
    parent_barrel="$parent/$base.ts"
    if [ ! -f "$parent_barrel" ]; then
      echo "FAIL: $barrel is never raised — its parent folder has no $base.ts. Create $parent_barrel containing: export * from \"./$child/$base\";" >&2
      FAIL=1
      RAISE_HITS=$((RAISE_HITS + 1))
    elif ! strip_comments "$parent_barrel" | grep -qF "export * from \"./$child/$base\"" \
      && ! strip_comments "$parent_barrel" | grep -qF "export * from './$child/$base'"; then
      echo "FAIL: $barrel is never raised — add to $parent_barrel: export * from \"./$child/$base\";" >&2
      FAIL=1
      RAISE_HITS=$((RAISE_HITS + 1))
    fi
  fi

  while IFS= read -r hit; do
    [ -z "$hit" ] && continue
    lineno=${hit%%	*}
    spec=$(printf '%s' "${hit#*	}" | grep -oE '"[^"]+"' | head -1 | tr -d '"')
    case "$spec" in
      ./*/types | ./*/interfaces)
        # Direct child only: exactly one folder segment before the barrel name.
        rest=${spec#./}
        rest=${rest%/*}
        case "$rest" in
          */*) ;;
          *) continue ;;
        esac
        ;;
    esac
    echo "FAIL: $barrel:$lineno re-exports \"$spec\" — a barrel may only raise a DIRECT child (export * from \"./<child>/types\"). Raise it one level at a time." >&2
    FAIL=1
    RAISE_HITS=$((RAISE_HITS + 1))
  done < <(strip_comments "$barrel" | grep -E "^[0-9]+	[[:space:]]*export[[:space:]]+\*[[:space:]]+from[[:space:]]+\"")
done < <(find "$SRC_ROOT" -type f \( -name "types.ts" -o -name "interfaces.ts" \) | sort)

# ---------------------------------------------------------------------------
# Rule 3 — aliased barrel imports stop at an area root, and never point a file
# back at its own folder.
# ---------------------------------------------------------------------------
SCAN_ROOTS="$SRC_ROOT"
[ -d "$TEST_ROOT" ] && SCAN_ROOTS="$SRC_ROOT $TEST_ROOT"

while IFS= read -r file; do
  filedir=$(dirname "$file")
  while IFS= read -r hit; do
    [ -z "$hit" ] && continue
    lineno=${hit%%	*}
    body=${hit#*	}
    for spec in $(printf '%s' "$body" | grep -oE '"@[A-Za-z0-9]+/[^"]+"' | tr -d '"'); do
      case "$spec" in
        */types | */interfaces) ;;
        *) continue ;;
      esac

      aliasname=${spec#@}
      aliasname=${aliasname%%/*}
      rest=${spec#@*/}
      dir=$(alias_dir "$aliasname")
      [ -z "$dir" ] && continue

      sub=$(dirname "$rest")
      if [ "$sub" = "." ]; then
        resolved="$dir"
      else
        resolved="$dir/$sub"
      fi

      if ! is_area_root "$resolved"; then
        echo "FAIL: $file:$lineno imports \"$spec\" — that reaches past the area barrel into the defining folder. Import from \"@$aliasname/$(basename "$rest")\" and make sure $resolved's barrel is raised up to it." >&2
        FAIL=1
        IMPORT_HITS=$((IMPORT_HITS + 1))
      elif [ "$resolved" = "$filedir" ]; then
        echo "FAIL: $file:$lineno imports \"$spec\" — a deep alias pointing at its own folder. Use a relative \"./$(basename "$rest")\" import." >&2
        FAIL=1
        IMPORT_HITS=$((IMPORT_HITS + 1))
      fi
    done
  done < <(strip_comments "$file" | grep -E "^[0-9]+	.*(from[[:space:]]*\"@|import[[:space:]]*\([[:space:]]*\"@)")
done < <(find $SCAN_ROOTS -type f \( -name "*.ts" -o -name "*.astro" \) ! -name "*.d.ts" | sort)

if [ "$FAIL" -ne 0 ]; then
  echo "FAIL: type-barrel gate found $DECL_HITS inline declaration(s), $RAISE_HITS raising break(s), $IMPORT_HITS deep barrel import(s)." >&2
  echo "      Rule: docs/architecture/06-API/03-Shared-Conventions.md, \"\`types.ts\` barrels (type-raising)\"." >&2
  exit 1
fi

BARRELS=$(find "$SRC_ROOT" -type f \( -name "types.ts" -o -name "interfaces.ts" \) | wc -l | tr -d ' ')
SCANNED=$(find $SCAN_ROOTS -type f \( -name "*.ts" -o -name "*.astro" \) ! -name "*.d.ts" | wc -l | tr -d ' ')
echo "OK: $BARRELS type barrel(s) fully raised; no inline exported type/interface and no deep barrel import across $SCANNED scanned file(s)."

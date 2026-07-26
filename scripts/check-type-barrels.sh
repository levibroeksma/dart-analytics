#!/usr/bin/env bash
# Type-barrel gate (docs/architecture/06-API/03-Shared-Conventions.md, section
# "`types.ts` barrels (type-raising)"). PR #53 review incident: six exported
# types were declared inline in an implementation file, lib/game/types.ts never
# raised ./rulesets/types, and twenty-odd consumers were consequently forced
# onto deep alias paths into the defining folder. Nothing mechanical objected.
#
# Four rules, all checked by parsing syntax rather than prose:
#
#   1. DECLARATION. `export type` / `export interface` never appears in an
#      implementation file. The body lives in that folder's types.ts (for
#      `type`) or interfaces.ts (for `interface`).
#   2. RAISING. Every types.ts/interfaces.ts below an area root is re-raised by
#      its parent folder's matching barrel, and a barrel only ever raises a
#      DIRECT child (`export * from "./<child>/types"`) — never a grandchild,
#      never an alias.
#   3. ALIASED CONSUMPTION. An aliased barrel TYPE import resolves to an area
#      root (`@lib/types`, `@modules/types`, `@services/types`, `@routes/types`,
#      ...) and never to a deeper folder; and a file never reaches its OWN
#      folder's barrel through an alias pointing back at itself (use `./types`).
#   4. RELATIVE CONSUMPTION. A RELATIVE barrel TYPE import (`./types`,
#      `../types`, `../../interfaces`, `./sibling/types`, ...) resolves only
#      to the importing file's OWN folder — `./types` / `./interfaces` and
#      nothing else. Any relative form that reaches a different folder
#      (a parent, a sibling, a child) is the same "reach past the area
#      barrel" violation rule 3 catches for aliases, just spelled with dots
#      instead of `@`. PR review incident (2026-07-26): fourteen such imports
#      — six rulesets/*/ validators reaching `../interfaces` + `../types`,
#      two sessions route handlers reaching `../types` / `../../types` — hid
#      from rule 3 precisely because they never used an alias. Barrel files
#      (types.ts/interfaces.ts) are exempt from this rule: raising a direct
#      child (`export * from "./<child>/types"`, rule 2) and importing named
#      symbols from a direct child to compose the parent's own exported types
#      (e.g. lib/game/types.ts importing from "./rulesets/types") are both
#      the documented, legitimate mechanics of the raising chain, not a
#      consumer dodging rule 3.
#
# TYPE IMPORTS vs VALUE IMPORTS (rules 3 and 4 only). The raising convention
# governs TYPE imports. A type import is erased at compile time, so the barrel
# hop it takes costs nothing at runtime. A VALUE import — a Zod schema, a const
# object, a class, a function — is exempt and may use its direct module path,
# because a value pulled through a barrel drags that barrel's whole subtree into
# the runtime module graph and can cycle (registry -> validator -> @services/types
# -> back down). Rules 3 and 4 therefore skip any statement that binds a value.
# Classification, per statement (Prettier wraps long lists, so a statement is
# joined onto one line before it is classified):
#
#   type  — `import type ...` (dropped whole by the compiler), or a braced list
#           whose EVERY specifier carries the inline `type` modifier
#           (`import { type A, type B } from ...`). The braced form does still
#           emit a bare `import {} from "..."` under `verbatimModuleSyntax`
#           (on via astro/tsconfigs/base), but the importing file needs no
#           binding out of it, so the reason for the exemption does not apply
#           and the stricter reading is the safe one.
#   value — anything that binds at least one runtime name: a plain named
#           import, a default import, a namespace import, a side-effect import,
#           and — deliberately — a MIXED statement such as
#           `import { type Foo, bar } from ...`. One value binding is enough to
#           create the runtime edge the exemption exists for, so the safe
#           reading is that the whole statement is a value import.
#
# The exemption cannot be used to smuggle a type past rules 3 and 4: with
# `verbatimModuleSyntax` enabled, importing a type without the `type` keyword is
# a compile error (ts(1484)), which `npm run check` fails on. A type import can
# therefore only ever present itself to this gate AS a type import.
#
# Re-export statements (`export * from`, `export type { ... } from`,
# `export { ... } from`) stay fully checked by rule 3 regardless of what they
# carry: they are the raising chain's own mechanics, governed by rule 2's
# raising requirement, not by a consumer's freedom to reach for a value.
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
#   * Anything hiding behind a statement that rule 4 classifies as a re-export.
#     That skip is now keyword-anchored (`export` followed by whitespace at the
#     start of the joined statement), so an identifier merely beginning with
#     "export" no longer triggers it — but a genuine `export ... from` relative
#     specifier is still rule 2's territory and rule 4 does not second-guess it.
#   * Two import statements sharing one source line. Statement joining ends at
#     the first module specifier, so the second statement on that line is not
#     classified or checked. Prettier emits one import per line, so this is
#     theoretical here.
#   * A dynamic `import("@lib/deep/types")`. It is a runtime construct — a value
#     import by definition — so the exemption above covers it by design. The one
#     form this loses is a dynamic import used purely in type position
#     (`typeof import("@lib/deep/types")`), which is erased but reads as a value.
#     No barrel is reached dynamically anywhere in the tree today.
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

# Emits "LINENO<TAB>statement" for every import/export statement in a file, with
# a multi-line statement joined onto one line and LINENO the line it starts on.
# Prettier wraps long specifier lists, so `} from "@services/types";` is often a
# continuation line — classifying it needs the whole statement, not that line.
import_statements() {
  strip_comments "$1" | awk '
    BEGIN { dq = sprintf("%c", 34); sq = sprintf("%c", 39); open = 0 }
    {
      lineno = $0
      sub(/\t.*$/, "", lineno)
      text = $0
      sub(/^[0-9]*\t/, "", text)
      if (!open) {
        if (text !~ /^[[:space:]]*(import|export)([[:space:]]|\{|\*)/) next
        start = lineno
        buf = text
        open = 1
      } else {
        buf = buf " " text
      }
      if (buf ~ ("from[[:space:]]*[" dq sq "]") \
        || buf ~ ("^[[:space:]]*import[[:space:]]*[" dq sq "]") \
        || buf ~ /;[[:space:]]*$/) {
        print start "\t" buf
        open = 0
        buf = ""
      }
    }
    END { if (open) print start "\t" buf }
  '
}

# "type" (binds nothing at runtime), "value" (binds at least one runtime name),
# or "reexport" (an `export ... from` statement). See the TYPE vs VALUE note in
# this file's header for why a mixed statement counts as a value import.
stmt_kind() {
  stmt=$1

  if printf '%s\n' "$stmt" | grep -qE '^[[:space:]]*export[[:space:]]'; then
    printf 'reexport\n'
    return
  fi

  if printf '%s\n' "$stmt" | grep -qE '^[[:space:]]*import[[:space:]]+type[[:space:]{]'; then
    printf 'type\n'
    return
  fi

  # A braced list with nothing between `import` and `{` binds no value only when
  # every specifier carries the inline `type` modifier. `import Foo, { type A }`
  # keeps a default binding, so it never reaches this branch.
  if printf '%s\n' "$stmt" | grep -qE '^[[:space:]]*import[[:space:]]*\{'; then
    inner=${stmt#*\{}
    inner=${inner%%\}*}
    kind=type
    set -f
    old_ifs=$IFS
    IFS=,
    for piece in $inner; do
      case "$piece" in
        *[![:space:]]*) ;;
        *) continue ;;
      esac
      printf '%s\n' "$piece" | grep -qE '^[[:space:]]*type[[:space:]]+[A-Za-z_$]' || kind=value
    done
    IFS=$old_ifs
    set +f
    printf '%s\n' "$kind"
    return
  fi

  printf 'value\n'
}

FAIL=0
DECL_HITS=0
RAISE_HITS=0
IMPORT_HITS=0
RELATIVE_HITS=0

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
# Rule 3 — aliased barrel TYPE imports stop at an area root, and never point a
# file back at its own folder. Value imports are exempt (header: TYPE vs VALUE);
# re-export statements stay checked.
# ---------------------------------------------------------------------------
SCAN_ROOTS="$SRC_ROOT"
[ -d "$TEST_ROOT" ] && SCAN_ROOTS="$SRC_ROOT $TEST_ROOT"

while IFS= read -r file; do
  filedir=$(dirname "$file")
  while IFS= read -r hit; do
    [ -z "$hit" ] && continue
    lineno=${hit%%	*}
    body=${hit#*	}

    # A value import may use its direct module path — the raising rule binds
    # type imports only.
    [ "$(stmt_kind "$body")" = "value" ] && continue

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
  done < <(import_statements "$file" | grep -F '"@')
done < <(find $SCAN_ROOTS -type f \( -name "*.ts" -o -name "*.astro" \) ! -name "*.d.ts" | sort)

# ---------------------------------------------------------------------------
# Rule 4 — relative barrel TYPE imports stop at the importing file's OWN folder.
# Same violation as rule 3 (reaching past the area barrel into a defining
# folder, or past a sibling/child folder), just spelled with "../" or "./x/"
# instead of an "@" alias. Value imports are exempt for the same reason they are
# under rule 3 (header: TYPE vs VALUE). Barrel files (types.ts/interfaces.ts)
# are exempt too: raising a direct child and importing from a direct child to
# compose the parent's own types are both legitimate (rule 2's territory).
# ---------------------------------------------------------------------------
REPO_ROOT=$(pwd -P)

while IFS= read -r file; do
  base=$(basename "$file")
  case "$base" in
    types.ts | interfaces.ts) continue ;;
    *.d.ts) continue ;;
  esac
  filedir=$(dirname "$file")
  filedir_abs=$(cd "$filedir" && pwd -P)

  while IFS= read -r hit; do
    [ -z "$hit" ] && continue
    lineno=${hit%%	*}
    body=${hit#*	}

    # Skip re-export raising lines (rule 2's territory) and value imports (they
    # may use a direct module path) — only type consumption imports are checked.
    [ "$(stmt_kind "$body")" = "type" ] || continue

    spec=$(printf '%s' "$body" \
      | grep -oE "['\"]\.\.?/[^'\"]+['\"]" | head -1 | tr -d "'\"")
    [ -z "$spec" ] && continue
    case "$spec" in
      */types | */interfaces) ;;
      *) continue ;;
    esac
    if [ "$spec" = "./types" ] || [ "$spec" = "./interfaces" ]; then
      continue
    fi

    specdir=$(dirname "$spec")
    target_abs=$(cd "$filedir_abs/$specdir" 2>/dev/null && pwd -P)
    barrel_name=$(basename "$spec")

    if [ -z "$target_abs" ]; then
      echo "FAIL: $file:$lineno imports \"$spec\" — target folder does not resolve." >&2
      FAIL=1
      RELATIVE_HITS=$((RELATIVE_HITS + 1))
      continue
    fi

    if [ "$target_abs" != "$filedir_abs" ]; then
      target_rel=${target_abs#"$REPO_ROOT"/}
      echo "FAIL: $file:$lineno imports \"$spec\" — a relative import of a barrel outside this file's own folder. That reaches past the area barrel the same way a deep alias would (rule 3); import the $barrel_name barrel via its area-root alias instead (its owning folder is $target_rel), or use \"./$barrel_name\" only if that is truly this file's own folder." >&2
      FAIL=1
      RELATIVE_HITS=$((RELATIVE_HITS + 1))
    fi
  done < <(import_statements "$file" | grep -E "from[[:space:]]*['\"]\.\.?/")
done < <(find $SCAN_ROOTS -type f \( -name "*.ts" -o -name "*.astro" \) ! -name "*.d.ts" | sort)

if [ "$FAIL" -ne 0 ]; then
  echo "FAIL: type-barrel gate found $DECL_HITS inline declaration(s), $RAISE_HITS raising break(s), $IMPORT_HITS deep aliased barrel type import(s), $RELATIVE_HITS deep relative barrel type import(s)." >&2
  echo "      Rule: docs/architecture/06-API/03-Shared-Conventions.md, \"\`types.ts\` barrels (type-raising)\"." >&2
  exit 1
fi

BARRELS=$(find "$SRC_ROOT" -type f \( -name "types.ts" -o -name "interfaces.ts" \) | wc -l | tr -d ' ')
SCANNED=$(find $SCAN_ROOTS -type f \( -name "*.ts" -o -name "*.astro" \) ! -name "*.d.ts" | wc -l | tr -d ' ')
echo "OK: $BARRELS type barrel(s) fully raised; no inline exported type/interface and no deep aliased or relative barrel TYPE import across $SCANNED scanned file(s)."

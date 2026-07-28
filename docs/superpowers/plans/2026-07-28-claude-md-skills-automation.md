# CLAUDE.md → Skills & Automation Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mechanize five prose-only Dart Analytics rules into gate scripts, move the existing structural gates left into pre-commit, add two CI-only gates that need remote PR state, and extract three procedural CLAUDE.md sections into on-demand skills.

**Architecture:** Every new gate follows the existing `scripts/check-*.sh` shape (bash, `set -euo pipefail`, `cd` to repo root, `FAIL=`/non-zero-exit, a header comment naming the incident it closes and its stated blind spots) and gets wired into both `.husky/pre-commit` and `.github/workflows/quality.yml`'s `structure` job. The two gates needing live PR state (branch-stack cap, test-repointing heuristic) live directly in `.github/workflows/checks.yml` instead, since that workflow (unlike the reusable `quality.yml`, which `deploy.yml` also calls on plain pushes to `main`) always has `pull_request` event context. Skills follow the existing project-local skill shape (`name`/`description` frontmatter, markdown body, no code unless the skill wraps a command).

**Tech Stack:** bash, python3 (stdlib only — `json`, `re`, `pathlib`), GitHub Actions (`actions/github-script@v7`), Vitest, Zod.

## Global Constraints

- Every new/edited `CLAUDE.md` gets its `AGENT.md` mirror updated byte-for-byte identically in the same step (`scripts/check-agent-mirrors.sh` enforces this).
- Every new script: `set -euo pipefail` (or `set -u` + explicit exit codes, matching the plainer scripts like `check-file-locations.sh`), `cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"` as its first executable line, and a header comment stating what incident it closes and what it cannot catch.
- No script may be wired into `.husky/pre-commit` or `quality.yml` until it has been run against the real current tree and either passes cleanly or its flagged violations have been fixed in the same task.
- Every `DECISIONS.md` entry uses the next sequential `D` number after the ledger's current last entry (`D156`); this plan uses `D157`–`D167` in order.
- Register every new script and skill in `docs/architecture/00-Context-Map.md`'s File Inventory in the same task that creates it.

---

### Task 1: Wire the 7 existing structural gates into pre-commit

**Files:**
- Modify: `.husky/pre-commit`
- Modify: `app/CLAUDE.md` (Formatting section)
- Modify: `app/AGENT.md` (mirror, identical edit)

**Interfaces:**
- Consumes: `scripts/check-file-locations.sh`, `scripts/check-agent-mirrors.sh`, `scripts/check-astro-class-composition.sh`, `scripts/check-astro-conventions.sh`, `scripts/check-game-engines.sh`, `scripts/check-refinement-coverage.sh`, `scripts/check-type-barrels.sh` (all pre-existing, unmodified).
- Produces: nothing new consumed by later tasks — this is a workflow change, not a code interface.

- [ ] **Step 1: Verify all 7 scripts currently pass**

Run: `for s in check-file-locations check-agent-mirrors check-astro-class-composition check-astro-conventions check-game-engines check-refinement-coverage check-type-barrels; do bash scripts/$s.sh || echo "FAILED: $s"; done`
Expected: every script prints an `OK:` line; no `FAILED:` line printed. If any script fails, stop and fix the underlying violation before continuing — do not wire a failing gate into pre-commit.

- [ ] **Step 2: Rewrite `.husky/pre-commit`**

Replace the full file content with:

```sh
#!/usr/bin/env sh
cd app && npx lint-staged
cd .. && bash scripts/check-file-locations.sh \
       && bash scripts/check-agent-mirrors.sh \
       && bash scripts/check-astro-class-composition.sh \
       && bash scripts/check-astro-conventions.sh \
       && bash scripts/check-game-engines.sh \
       && bash scripts/check-refinement-coverage.sh \
       && bash scripts/check-type-barrels.sh
```

- [ ] **Step 3: Verify the hook is executable and runs**

Run: `chmod +x .husky/pre-commit && bash .husky/pre-commit`
Expected: `lint-staged` output (may say "No staged files match any configured task" if nothing is staged) followed by 7 `OK:` lines, exit code 0.

- [ ] **Step 4: Update `app/CLAUDE.md`'s Formatting section**

In `app/CLAUDE.md`, find:

```
- **pre-commit:** husky + lint-staged run Prettier `--write` on staged files (`cd app && npx lint-staged`). Hooks install via `npm install` (`prepare` → repo-root `.husky/`).
```

Replace with:

```
- **pre-commit:** husky + lint-staged run Prettier `--write` on staged files (`cd app && npx lint-staged`), then the 7 structural gates (file-locations, agent-mirrors, astro-class-composition, astro-conventions, game-engines, refinement-coverage, type-barrels) run from repo root. Hooks install via `npm install` (`prepare` → repo-root `.husky/`). (2026-07-28)
```

Apply the identical edit to `app/AGENT.md`.

- [ ] **Step 5: Verify the AGENT.md mirror still matches**

Run: `bash scripts/check-agent-mirrors.sh`
Expected: `OK: every CLAUDE.md/AGENT.md pair is identical.`

- [ ] **Step 6: Add the DECISIONS.md entry**

In `DECISIONS.md`, find the row for `D156` (ends `"...the 61 type imports and 8 declaration/raising breaks all still fail |"`) and the blank line + `## Deferred (open, not rejected)` header immediately after it. Insert this new row between them:

```
| D157 | 2026-07-28 | `.husky/pre-commit` runs the 7 existing structural `check-*.sh` gates (file-locations, agent-mirrors, astro-class-composition, astro-conventions, game-engines, refinement-coverage, type-barrels) in addition to Prettier lint-staged | These gates only ran in CI, after push; violations were caught in PR review instead of at commit time, same latency pattern D136 already fixed for Prettier |
```

- [ ] **Step 7: Commit**

```bash
git add .husky/pre-commit app/CLAUDE.md app/AGENT.md DECISIONS.md
git commit -m "feat: run structural gates in pre-commit, not just CI"
```

---

### Task 2: Add `@icons`/`@layouts` to vitest's alias map

**Files:**
- Modify: `app/vitest.config.ts`

**Interfaces:**
- Produces: `resolve.alias` now has 16 keys (was 14), matching `tsconfig.json`'s 16 `compilerOptions.paths` keys minus the `@styles` exception — this is the prerequisite Task 3's gate depends on to pass cleanly on creation.

- [ ] **Step 1: Confirm the current gap**

Run: `python3 -c "
import json
paths = json.load(open('app/tsconfig.json'))['compilerOptions']['paths']
print(sorted(k.rstrip('/*') for k in paths))
"`
Expected output includes `'@icons'` and `'@layouts'`.

Run: `grep -oE '"@[A-Za-z0-9]+"' app/vitest.config.ts | sort -u`
Expected: no `"@icons"` or `"@layouts"` in the output.

- [ ] **Step 2: Add the two aliases**

In `app/vitest.config.ts`, find:

```ts
      "@server": path.resolve(__dirname, "./src/lib/server"),
    },
  },
});
```

Replace with:

```ts
      "@server": path.resolve(__dirname, "./src/lib/server"),
      "@icons": path.resolve(__dirname, "./src/icons"),
      "@layouts": path.resolve(__dirname, "./src/layouts"),
    },
  },
});
```

- [ ] **Step 3: Verify tests still pass**

Run: `cd app && npm test`
Expected: all tests pass (adding unused resolve aliases cannot break anything that was passing before).

- [ ] **Step 4: Commit**

```bash
git add app/vitest.config.ts
git commit -m "fix: add @icons/@layouts to vitest's alias map to match tsconfig"
```

---

### Task 3: Create `check-alias-sync.sh`

**Files:**
- Create: `scripts/check-alias-sync.sh`
- Modify: `.husky/pre-commit`
- Modify: `.github/workflows/quality.yml` (`structure` job)
- Modify: `docs/architecture/00-Context-Map.md`
- Modify: `DECISIONS.md`

**Interfaces:**
- Consumes: `app/tsconfig.json`'s `compilerOptions.paths`, `app/vitest.config.ts`'s `resolve.alias` (both read-only).
- Produces: exit code 0 (pass) / 1 (fail) + stderr diagnostics, same contract as every other `check-*.sh`.

- [ ] **Step 1: Create the script**

Write `scripts/check-alias-sync.sh`:

```bash
#!/usr/bin/env bash
# tsconfig/vitest alias-sync gate (D113): app/tsconfig.json declared `@lib` in
# compilerOptions.paths before vitest.config.ts's resolve.alias carried a
# matching entry; a test importing `@lib` through vi.mock() never exercised
# real module resolution, so the gap stayed invisible until a genuine
# (non-mocked) import broke. This script fails when the two alias sets ever
# diverge again.
#
# ALLOWLIST: aliases below are TS-path-only by design and never a valid
# import target from a `.ts` test file, so they are exempt from requiring a
# vitest.config.ts counterpart:
#   @styles -> app/src/styles (CSS files; Vitest's node environment cannot
#     import a stylesheet, and nothing under app/tests/ should ever try).
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

TSCONFIG="app/tsconfig.json"
VITEST_CONFIG="app/vitest.config.ts"
ALLOWLIST_TSCONFIG_ONLY="@styles"

for f in "$TSCONFIG" "$VITEST_CONFIG"; do
  if [ ! -f "$f" ]; then
    echo "FAIL: $f not found" >&2
    exit 1
  fi
done

TSCONFIG_ALIASES=$(python3 -c "
import json
with open('$TSCONFIG', encoding='utf-8') as fh:
    data = json.load(fh)
paths = data.get('compilerOptions', {}).get('paths', {})
for key in paths:
    print(key.rstrip('/*'))
" | sort -u)

VITEST_ALIASES=$(grep -oE '"@[A-Za-z0-9]+"[[:space:]]*:' "$VITEST_CONFIG" \
  | grep -oE '"@[A-Za-z0-9]+"' | tr -d '"' | sort -u || true)

FAIL=0

while IFS= read -r alias; do
  [ -z "$alias" ] && continue
  case " $ALLOWLIST_TSCONFIG_ONLY " in
    *" $alias "*) continue ;;
  esac
  echo "FAIL: $alias is in $TSCONFIG's compilerOptions.paths but missing from $VITEST_CONFIG's resolve.alias — a genuine (non-mocked) import through this alias will fail to resolve in tests" >&2
  FAIL=1
done < <(comm -23 <(printf '%s\n' "$TSCONFIG_ALIASES") <(printf '%s\n' "$VITEST_ALIASES"))

while IFS= read -r alias; do
  [ -z "$alias" ] && continue
  echo "FAIL: $alias is in $VITEST_CONFIG's resolve.alias but missing from $TSCONFIG's compilerOptions.paths — TypeScript will not resolve this alias outside tests" >&2
  FAIL=1
done < <(comm -13 <(printf '%s\n' "$TSCONFIG_ALIASES") <(printf '%s\n' "$VITEST_ALIASES"))

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi

COUNT=$(printf '%s\n' "$TSCONFIG_ALIASES" | wc -l | tr -d ' ')
echo "OK: $COUNT alias(es) in sync between $TSCONFIG and $VITEST_CONFIG (allowlisted tsconfig-only: $ALLOWLIST_TSCONFIG_ONLY)."
```

- [ ] **Step 2: Make it executable and run it**

Run: `chmod +x scripts/check-alias-sync.sh && bash scripts/check-alias-sync.sh`
Expected: `OK: 16 alias(es) in sync between app/tsconfig.json and app/vitest.config.ts (allowlisted tsconfig-only: @styles).`

- [ ] **Step 3: Verify it actually catches drift (fixture check)**

Run:
```bash
cp app/vitest.config.ts /tmp/vitest.config.ts.bak
sed -i 's#"@icons": path.resolve(__dirname, "./src/icons"),##' app/vitest.config.ts
bash scripts/check-alias-sync.sh; echo "exit=$?"
cp /tmp/vitest.config.ts.bak app/vitest.config.ts
```
Expected: prints `FAIL: @icons is in app/tsconfig.json's compilerOptions.paths but missing from app/vitest.config.ts's resolve.alias ...` and `exit=1`. After restoring the backup, re-run `bash scripts/check-alias-sync.sh` and confirm it's back to `OK:`.

- [ ] **Step 4: Wire into pre-commit**

In `.husky/pre-commit`, find:

```sh
       && bash scripts/check-type-barrels.sh
```

Replace with:

```sh
       && bash scripts/check-type-barrels.sh \
       && bash scripts/check-alias-sync.sh
```

- [ ] **Step 5: Wire into `quality.yml`'s `structure` job**

In `.github/workflows/quality.yml`, find:

```yaml
      - name: Type-barrel gate
        run: bash scripts/check-type-barrels.sh
```

Replace with:

```yaml
      - name: Type-barrel gate
        run: bash scripts/check-type-barrels.sh
      - name: Alias-sync gate
        run: bash scripts/check-alias-sync.sh
```

- [ ] **Step 6: Register in the context map**

In `docs/architecture/00-Context-Map.md`, find the end of the "Game engine code + mechanical guards" table (the `check-type-barrels.sh` row, ending `"...blind spots documented in its header (2026-07-26) | canonical |"`) immediately followed by a blank line and `## Context & history (repo root, docs/)`. Insert a new table between them:

```

## Cross-cutting mechanical guards (2026-07-28)

Guards not specific to the game-engine contract, registered here for discoverability.

| File | Answers | Status |
| ---- | ------- | ------ |
| `scripts/check-alias-sync.sh` | Guard: `tsconfig.json` compilerOptions.paths and `vitest.config.ts` resolve.alias never diverge (D113); `@styles` allowlisted as TS-only | canonical |
```

- [ ] **Step 7: Add the DECISIONS.md entry**

In `DECISIONS.md`, find the `D157` row added in Task 1 and insert immediately after it:

```
| D158 | 2026-07-28 | New `scripts/check-alias-sync.sh` fails when `tsconfig.json`'s `compilerOptions.paths` and `vitest.config.ts`'s `resolve.alias` diverge (allowlisting `@styles` as CSS-only); `@icons`/`@layouts` added to `vitest.config.ts` to close the real gap the gate found | Closes D113's exact failure mode (an alias declared in one config but not the other, invisible until a genuine non-mocked import breaks) with a standing gate instead of a one-off fix |
```

- [ ] **Step 8: Commit**

```bash
git add scripts/check-alias-sync.sh .husky/pre-commit .github/workflows/quality.yml docs/architecture/00-Context-Map.md DECISIONS.md
git commit -m "feat: add check-alias-sync.sh, close the D113 tsconfig/vitest gap"
```

---

### Task 4: Create `check-constraint-mirror.sh` (closes D149)

**Files:**
- Create: `scripts/check-constraint-mirror.sh`
- Create: `app/tests/pages/api/sessions/constraint-mirror.test.ts`
- Modify: `app/src/pages/api/sessions/types.ts` (add `// MIRRORS:` anchors)
- Modify: `.husky/pre-commit`
- Modify: `.github/workflows/quality.yml`
- Modify: `docs/architecture/00-Context-Map.md`
- Modify: `DECISIONS.md`

**Interfaces:**
- Consumes: `database/migrations/*.sql` (read-only), `app/src/pages/api/sessions/types.ts`'s exported `DartFact`, `TurnFact`, `StageFact` Zod schemas (already exist, unmodified structurally — only comments added).
- Produces: the 10-name required set `{chk_stage_sequence_positive, chk_stage_not_self_parent, chk_turn_sequence_positive, chk_dart_number, chk_dart_number_positive, chk_dart_score_positive, chk_intended_target, chk_hit_target, chk_dart_target_consistency, chk_hit_consistency}`, scoped to the `exercise_stages`/`turns`/`darts` tables only (not every `chk_*` in every migration — D149 scopes the batch-schema mirror to these 3 batch-write tables).

- [ ] **Step 1: Confirm the required constraint set**

Run:
```bash
grep -n "CONSTRAINT chk_" database/migrations/0006_runtime_events.sql database/migrations/0007_constraints.sql
grep -n "migrate:up\|migrate:down" database/migrations/0015_time_semantics_constraints.sql
```
Expected: confirms `chk_dart_number`/`chk_intended_target`/`chk_hit_target` in `0006` (inline `CREATE TABLE darts`), `chk_stage_sequence_positive`/`chk_stage_not_self_parent`/`chk_turn_sequence_positive`/`chk_dart_number_positive`/`chk_dart_score_positive`/`chk_dart_target_consistency`/`chk_hit_consistency` in `0007`, and that `0015`'s `DROP CONSTRAINT chk_turn_completed_after_created` sits in its `migrate:up` section (before the `migrate:down` marker) — meaning that constraint is dropped and excluded from the required set. `0007`'s own `migrate:down` section (a rollback block starting after its own later `-- migrate:down` marker) contains `DROP CONSTRAINT IF EXISTS` lines for several of these names — those must never be scanned, since they are rollback SQL, not the applied-forward schema.

- [ ] **Step 2: Create the script**

Write `scripts/check-constraint-mirror.sh`:

```bash
#!/usr/bin/env bash
# CHECK-constraint mirror gate (D149): a Zod bound that lets a value through
# a SQL CHECK constraint rejects aborts the whole batch write transaction with
# a 500 instead of a VALIDATION_FAILED naming the offending record. D149
# mirrors every CHECK on the 3 batch-write tables (exercise_stages, turns,
# darts) once, in the shared batch schema — this script proves each one is
# acknowledged there, via a `// MIRRORS: chk_x` anchor comment.
#
# Scope: only CHECK constraints on exercise_stages/turns/darts, sourced from
# each migration's migrate:up region (never migrate:down — that is rollback
# SQL, not the applied-forward schema). A constraint dropped in a later
# migration's migrate:up (chk_turn_completed_after_created, migration 0015)
# is correctly excluded from the required set.
#
# WHAT THIS CANNOT CATCH (stated plainly, same convention as
# check-refinement-coverage.sh): this proves an anchor exists, not that its
# numeric bound is identical to the CHECK expression. Real enforcement of
# bound agreement is app/tests/pages/api/sessions/constraint-mirror.test.ts,
# which executes safeParse against the declared boundary values.
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

SCHEMA_FILE="app/src/pages/api/sessions/types.ts"
if [ ! -f "$SCHEMA_FILE" ]; then
  echo "FAIL: $SCHEMA_FILE not found" >&2
  exit 1
fi

python3 - "$SCHEMA_FILE" <<'PY'
import re
import sys
from pathlib import Path

schema_file = Path(sys.argv[1])
allowed_tables = {"exercise_stages", "turns", "darts"}
migrations_dir = Path("database/migrations")

table_re = re.compile(r"\b(?:ALTER TABLE|CREATE TABLE)\s+([A-Za-z_][A-Za-z0-9_]*)", re.IGNORECASE)
add_re = re.compile(r"ADD CONSTRAINT\s+(chk_[A-Za-z0-9_]+)", re.IGNORECASE)
drop_re = re.compile(r"DROP CONSTRAINT\s+(chk_[A-Za-z0-9_]+)", re.IGNORECASE)
inline_chk_re = re.compile(r"CONSTRAINT\s+(chk_[A-Za-z0-9_]+)\s+CHECK", re.IGNORECASE)


def migrate_up_region(text: str) -> str:
    start = text.find("-- migrate:up")
    if start == -1:
        return text
    start = text.find("\n", start) + 1
    end = text.find("-- migrate:down", start)
    return text[start:] if end == -1 else text[start:end]


files = sorted(migrations_dir.glob("*.sql"))
if not files:
    print(f"FAIL: no migrations found under {migrations_dir}", file=sys.stderr)
    sys.exit(1)

live: set[str] = set()
for path in files:
    region = migrate_up_region(path.read_text(encoding="utf-8"))
    current_table = None
    for line in region.splitlines():
        m = table_re.search(line)
        if m:
            current_table = m.group(1).lower()
            continue
        if current_table not in allowed_tables:
            continue
        m = add_re.search(line)
        if m:
            live.add(m.group(1))
            continue
        m = drop_re.search(line)
        if m:
            live.discard(m.group(1))
            continue
        m = inline_chk_re.search(line)
        if m:
            live.add(m.group(1))

schema_text = schema_file.read_text(encoding="utf-8")
anchored: set[str] = set()
for m in re.finditer(r"//\s*MIRRORS:\s*([a-z0-9_,\s]+)", schema_text):
    for name in m.group(1).split(","):
        name = name.strip()
        if name:
            anchored.add(name)

tables_str = ", ".join(sorted(allowed_tables))
missing = sorted(live - anchored)
stale = sorted(anchored - live)
fail = False

for name in missing:
    print(
        f"FAIL: {name} is a CHECK constraint on {tables_str} in database/migrations/ "
        f"with no `// MIRRORS: {name}` anchor in {schema_file} — bound it beside the "
        f"field it constrains (D149)",
        file=sys.stderr,
    )
    fail = True

for name in stale:
    print(
        f"FAIL: {schema_file} anchors `{name}` but no live migration defines that "
        f"constraint on {tables_str} anymore — remove the stale anchor",
        file=sys.stderr,
    )
    fail = True

if fail:
    sys.exit(1)

names = ", ".join(sorted(live))
print(f"OK: {len(live)} CHECK constraint(s) on {tables_str} all have a `// MIRRORS:` anchor in {schema_file}: {names}.")
print("     Bound agreement is enforced by execution in app/tests/pages/api/sessions/constraint-mirror.test.ts, not by this script.")
PY
```

- [ ] **Step 3: Run it before adding anchors — confirm it fails**

Run: `chmod +x scripts/check-constraint-mirror.sh && bash scripts/check-constraint-mirror.sh; echo "exit=$?"`
Expected: 10 `FAIL:` lines (one per required constraint name) and `exit=1`, since no `// MIRRORS:` anchors exist in `types.ts` yet.

- [ ] **Step 4: Add the anchor comments to `app/src/pages/api/sessions/types.ts`**

Find:

```ts
const TargetNumber = z.number().int().min(1).max(25).nullable();
```

Replace with:

```ts
// MIRRORS: chk_intended_target, chk_hit_target
const TargetNumber = z.number().int().min(1).max(25).nullable();
```

Find:

```ts
export const DartFact = z
  .object({
```

Replace with:

```ts
// MIRRORS: chk_dart_number, chk_dart_number_positive, chk_dart_score_positive, chk_hit_consistency, chk_dart_target_consistency
export const DartFact = z
  .object({
```

Find:

```ts
export const TurnFact = z.object({
```

Replace with:

```ts
// MIRRORS: chk_turn_sequence_positive
export const TurnFact = z.object({
```

Find:

```ts
export const StageFact = z
  .object({
```

Replace with:

```ts
// MIRRORS: chk_stage_sequence_positive, chk_stage_not_self_parent
export const StageFact = z
  .object({
```

- [ ] **Step 5: Run it again — confirm it passes**

Run: `bash scripts/check-constraint-mirror.sh`
Expected: `OK: 10 CHECK constraint(s) on darts, exercise_stages, turns all have a \`// MIRRORS:\` anchor in app/src/pages/api/sessions/types.ts: chk_dart_number, chk_dart_number_positive, chk_dart_score_positive, chk_dart_target_consistency, chk_hit_consistency, chk_hit_target, chk_intended_target, chk_stage_not_self_parent, chk_stage_sequence_positive, chk_turn_sequence_positive.`

- [ ] **Step 6: Verify it catches a stale anchor (fixture check)**

Run:
```bash
cp app/src/pages/api/sessions/types.ts /tmp/types.ts.bak
sed -i 's/chk_turn_sequence_positive$/chk_turn_sequence_positive_TYPO/' app/src/pages/api/sessions/types.ts
bash scripts/check-constraint-mirror.sh; echo "exit=$?"
cp /tmp/types.ts.bak app/src/pages/api/sessions/types.ts
bash scripts/check-constraint-mirror.sh
```
Expected: the middle run prints both a `FAIL: chk_turn_sequence_positive is a CHECK constraint ... no anchor` (the real name is now missing) and a `FAIL: ... anchors \`chk_turn_sequence_positive_TYPO\` but no live migration defines that constraint` (the typo'd name is stale), `exit=1`. The final run after restoring the backup prints `OK:` again.

- [ ] **Step 7: Write the companion test**

Create `app/tests/pages/api/sessions/constraint-mirror.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DartFact, StageFact, TurnFact } from "@routes/sessions/types";

// Executes the boundary values each `// MIRRORS: chk_x` anchor in
// app/src/pages/api/sessions/types.ts declares agreement with.
// Unlike check-constraint-mirror.sh (which only proves an anchor exists),
// this runs safeParse against the real schema and asserts the real
// accept/reject outcome — the same "declared manifest, executed boundary"
// split as refinement-contract.test.ts.

const validDart = {
  sequence: 1,
  intendedTargetNumber: null,
  intendedZoneKey: null,
  hitTargetNumber: 20,
  hitZoneKey: "SINGLE",
  score: 20,
};

describe("darts CHECK constraint mirrors", () => {
  it("chk_dart_number / chk_dart_number_positive: sequence must be positive", () => {
    expect(DartFact.safeParse({ ...validDart, sequence: 1 }).success).toBe(true);
    expect(DartFact.safeParse({ ...validDart, sequence: 0 }).success).toBe(false);
    expect(DartFact.safeParse({ ...validDart, sequence: -1 }).success).toBe(false);
  });

  it("chk_dart_score_positive: score must be non-negative", () => {
    expect(DartFact.safeParse({ ...validDart, score: 0 }).success).toBe(true);
    expect(DartFact.safeParse({ ...validDart, score: -1 }).success).toBe(false);
  });

  it("chk_intended_target / chk_hit_target: target numbers bound to 1..25 or null", () => {
    expect(DartFact.safeParse({ ...validDart, hitTargetNumber: 1 }).success).toBe(true);
    expect(DartFact.safeParse({ ...validDart, hitTargetNumber: 25 }).success).toBe(true);
    expect(DartFact.safeParse({ ...validDart, hitTargetNumber: null }).success).toBe(true);
    expect(DartFact.safeParse({ ...validDart, hitTargetNumber: 0 }).success).toBe(false);
    expect(DartFact.safeParse({ ...validDart, hitTargetNumber: 26 }).success).toBe(false);
    expect(DartFact.safeParse({ ...validDart, intendedTargetNumber: 0 }).success).toBe(false);
  });

  it("chk_dart_target_consistency: an intended target requires an intended zone", () => {
    expect(
      DartFact.safeParse({ ...validDart, intendedTargetNumber: 20, intendedZoneKey: null })
        .success,
    ).toBe(false);
    expect(
      DartFact.safeParse({ ...validDart, intendedTargetNumber: 20, intendedZoneKey: "DOUBLE" })
        .success,
    ).toBe(true);
  });

  it("chk_hit_consistency: hitZoneKey is always required (never null or missing)", () => {
    expect(DartFact.safeParse({ ...validDart, hitZoneKey: undefined }).success).toBe(false);
  });
});

describe("turns CHECK constraint mirror", () => {
  const base = {
    clientKey: "turn-1",
    participantRef: "p-1",
    sequence: 1,
    totalScore: 0,
    completedAt: null,
    darts: [],
  };

  it("chk_turn_sequence_positive: sequence must be positive", () => {
    expect(TurnFact.safeParse(base).success).toBe(true);
    expect(TurnFact.safeParse({ ...base, sequence: 0 }).success).toBe(false);
  });
});

describe("exercise_stages CHECK constraint mirrors", () => {
  const base = {
    clientKey: "stage-1",
    stageTypeKey: "EXERCISE_BLOCK",
    parentClientKey: null,
    sequence: 1,
    turns: [],
  };

  it("chk_stage_sequence_positive: sequence must be positive", () => {
    expect(StageFact.safeParse(base).success).toBe(true);
    expect(StageFact.safeParse({ ...base, sequence: 0 }).success).toBe(false);
  });

  it("chk_stage_not_self_parent: a stage cannot be its own parent", () => {
    expect(StageFact.safeParse({ ...base, parentClientKey: "stage-1" }).success).toBe(false);
  });
});
```

- [ ] **Step 8: Run the test suite**

Run: `cd app && npx vitest run tests/pages/api/sessions/constraint-mirror.test.ts`
Expected: all `it` blocks pass (9 assertions across 7 `it` blocks).

- [ ] **Step 9: Wire into pre-commit**

In `.husky/pre-commit`, find:

```sh
       && bash scripts/check-type-barrels.sh \
       && bash scripts/check-alias-sync.sh
```

Replace with:

```sh
       && bash scripts/check-type-barrels.sh \
       && bash scripts/check-alias-sync.sh \
       && bash scripts/check-constraint-mirror.sh
```

- [ ] **Step 10: Wire into `quality.yml`**

In `.github/workflows/quality.yml`, find:

```yaml
      - name: Alias-sync gate
        run: bash scripts/check-alias-sync.sh
```

Replace with:

```yaml
      - name: Alias-sync gate
        run: bash scripts/check-alias-sync.sh
      - name: Constraint-mirror gate
        run: bash scripts/check-constraint-mirror.sh
```

- [ ] **Step 11: Register in the context map**

In `docs/architecture/00-Context-Map.md`, find the "Cross-cutting mechanical guards" table row added in Task 3 and insert immediately after it:

```
| `scripts/check-constraint-mirror.sh` | Guard: every live CHECK constraint on `exercise_stages`/`turns`/`darts` has a `// MIRRORS: chk_x` anchor in `app/src/pages/api/sessions/types.ts` (D149); bound agreement executed in `constraint-mirror.test.ts`, not by this script | canonical |
```

- [ ] **Step 12: Add the DECISIONS.md entry**

In `DECISIONS.md`, insert after the `D158` row:

```
| D159 | 2026-07-28 | New `scripts/check-constraint-mirror.sh` requires every live `chk_*` CHECK constraint on `exercise_stages`/`turns`/`darts` to have a `// MIRRORS: chk_x` anchor comment in the shared batch schema (`app/src/pages/api/sessions/types.ts`); a companion `constraint-mirror.test.ts` executes the boundary agreement | Mechanizes D149 (constraints mirrored once, in the batch schema) the same way `check-refinement-coverage.sh` mechanizes refinement coverage — manifest-matched, not text-scanned |
```

- [ ] **Step 13: Commit**

```bash
git add scripts/check-constraint-mirror.sh app/src/pages/api/sessions/types.ts app/tests/pages/api/sessions/constraint-mirror.test.ts .husky/pre-commit .github/workflows/quality.yml docs/architecture/00-Context-Map.md DECISIONS.md
git commit -m "feat: mechanize D149's CHECK-constraint mirror rule"
```

---

### Task 5: Fix pre-existing inline-comment violations, create `check-no-inline-comments.sh`

**Files:**
- Modify: `app/src/lib/client/alpine/register-stores.ts`
- Modify: `app/src/lib/game/score-training-setup.data.ts`
- Create: `scripts/check-no-inline-comments.sh`
- Modify: `.husky/pre-commit`
- Modify: `.github/workflows/quality.yml`
- Modify: `docs/architecture/00-Context-Map.md`
- Modify: `DECISIONS.md`

**Interfaces:**
- Consumes: nothing new — scans `app/src/**/*.ts` text directly.
- Produces: exit 0/1 + stderr diagnostics.

This task's gate would fail immediately on the current tree — a prototype run found 3 real pre-existing violations of app/CLAUDE.md's existing "never comment inside function/method bodies" rule (never mechanically checked until now). Fix them first, in the same commit as the gate that would otherwise block on them.

- [ ] **Step 1: Fix `register-stores.ts`**

Find:

```ts
export function registerStores(Alpine: Alpine) {
  Alpine.store("auth", authStore());
  // Alpine.`$persist` getter returns a fresh persist() per access — required so
  // each store field gets its own `.as()` alias closure.
  const persist = () => (Alpine as unknown as { $persist: Persist }).$persist;
  Alpine.store("game", gameStore(persist));
}
```

Replace with:

```ts
export function registerStores(Alpine: Alpine) {
  Alpine.store("auth", authStore());
  /**
   * Alpine's `$persist` getter returns a fresh persist() per access —
   * required so each store field gets its own `.as()` alias closure.
   */
  const persist = () => (Alpine as unknown as { $persist: Persist }).$persist;
  Alpine.store("game", gameStore(persist));
}
```

- [ ] **Step 2: Fix `score-training-setup.data.ts`'s two violations**

Find:

```ts
    async init(this: ScoreTrainingSetupContext) {
      this.loadingReconciliation = true;
      try {
        const [presets, activeSessions] = await Promise.all([
          fetchConfigurationPresets(GAME_TYPE_KEY),
          fetchActiveSessions(),
        ]);

        this.presets = presets;
        this.selectedTemplateId = presets[0]?.configurationTemplateId ?? "";

        await this.reconcile(activeSessions);
      } catch {
        // Preset/active-session fetch itself failed — keep user on setup with
        // a visible error (toast-equivalent for this UI) and the picker fallback.
        this.showActiveSessionModal = false;
        this.error =
          "Could not load setup. Check your connection and try again.";
      } finally {
        this.loadingReconciliation = false;
      }
    },
```

Replace with:

```ts
    /**
     * On fetch failure, keeps the user on setup with a visible error and the
     * picker fallback rather than the active-session modal.
     */
    async init(this: ScoreTrainingSetupContext) {
      this.loadingReconciliation = true;
      try {
        const [presets, activeSessions] = await Promise.all([
          fetchConfigurationPresets(GAME_TYPE_KEY),
          fetchActiveSessions(),
        ]);

        this.presets = presets;
        this.selectedTemplateId = presets[0]?.configurationTemplateId ?? "";

        await this.reconcile(activeSessions);
      } catch {
        this.showActiveSessionModal = false;
        this.error =
          "Could not load setup. Check your connection and try again.";
      } finally {
        this.loadingReconciliation = false;
      }
    },
```

Find:

```ts
      if (result.action === "match") {
        this.activeSession = result.activeSession;
        this.showActiveSessionModal = true;
        this.reconciliationFailed = false;
      } else if (result.action === "abandon_failed") {
        // Block: do not show the picker, do not allow session creation.
        this.showActiveSessionModal = false;
        this.reconciliationFailed = true;
      } else {
        this.showActiveSessionModal = false;
        this.reconciliationFailed = false;
      }
    },
```

Replace with:

```ts
      if (result.action === "match") {
        this.activeSession = result.activeSession;
        this.showActiveSessionModal = true;
        this.reconciliationFailed = false;
      } else if (result.action === "abandon_failed") {
        this.showActiveSessionModal = false;
        this.reconciliationFailed = true;
      } else {
        this.showActiveSessionModal = false;
        this.reconciliationFailed = false;
      }
    },
```

And find the `reconcile` method's opening line:

```ts
    async reconcile(
      this: ScoreTrainingSetupContext,
      activeSessions: SessionActiveData[],
    ) {
```

Replace with:

```ts
    /**
     * `abandon_failed` blocks session creation instead of silently
     * resetting: the orphan session is still ACTIVE server-side, so
     * showing the picker would let a new session violate the
     * single-active-session constraint (D118).
     */
    async reconcile(
      this: ScoreTrainingSetupContext,
      activeSessions: SessionActiveData[],
    ) {
```

- [ ] **Step 3: Run existing tests to confirm no behavior changed**

Run: `cd app && npx vitest run tests/lib/game/score-training-setup.data.test.ts`
Expected: all tests pass (only comments moved; no logic changed). `register-stores.ts` has no dedicated test file, so also run the full suite to catch any indirect regression: `npm test`.

- [ ] **Step 4: Create the script**

Write `scripts/check-no-inline-comments.sh`:

```bash
#!/usr/bin/env bash
# No-inline-comments gate (app/CLAUDE.md "TypeScript comments"): no `//` or
# non-JSDoc `/* */` comment inside a function/method body under
# app/src/**/*.ts; detail belongs in a JSDoc block (`/** */`) above the
# declaration instead — JSDoc is always exempt, matching that existing rule's
# "prefer names that read naturally; put necessary detail in JSDoc above the
# declaration." Also exempt: `// fallow-ignore-next-line ...` tool
# directives, `///` triple-slash references. Out of scope, per the existing
# rule: app/tests/, app/scripts/.
#
# A `{` counts as opening a function/method body only when the token
# immediately before it (ignoring whitespace) is `)` or `=>` — this is what
# tells a function/method/arrow body apart from an interface body, a class
# body, a type literal, or an object literal, all of which also use `{}` but
# are not "function bodies" under this rule.
#
# BLIND SPOT: this is a lexical heuristic, not an AST. A bare block statement
# `{ ... }` at module level (not preceded by `)`/`=>`) is treated as
# non-function, so a top-level scoping block would not be checked; and a
# `switch (x) { ... }` at module level (rare in this codebase) would be
# treated as a function body since its `{` is preceded by `)`. Neither shape
# appears in this codebase's current style.
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

python3 - <<'PY'
import sys
from pathlib import Path

ROOT = Path("app/src")
EXEMPT_PREFIXES = ("app/tests/", "app/scripts/")


def is_function_open(preceding: str) -> bool:
    p = preceding.rstrip()
    return p.endswith(")") or p.endswith("=>")


fail = False


def scan(path: Path) -> None:
    global fail
    text = path.read_text(encoding="utf-8")
    stack: list[bool] = []
    i = 0
    n = len(text)
    line = 1
    in_string = None
    preceding_buf = ""

    def in_func() -> bool:
        return any(stack)

    while i < n:
        ch = text[i]
        nxt = text[i + 1] if i + 1 < n else ""
        if ch == "\n":
            line += 1
            i += 1
            continue
        if in_string:
            if ch == "\\":
                i += 2
                continue
            if ch == in_string:
                in_string = None
            i += 1
            continue
        if ch in "\"'`":
            in_string = ch
            i += 1
            continue
        if ch == "/" and nxt == "/":
            end = text.find("\n", i)
            comment = text[i : end if end != -1 else n]
            if in_func() and not comment.startswith("///") and "fallow-ignore-next-line" not in comment:
                print(f"FAIL: {path}:{line}: `//` comment inside a function/method body — move detail to a JSDoc block above the declaration", file=sys.stderr)
                fail = True
            i = end if end != -1 else n
            continue
        if ch == "/" and nxt == "*":
            end = text.find("*/", i + 2)
            comment = text[i : (end + 2) if end != -1 else n]
            is_jsdoc = comment.startswith("/**")
            if in_func() and not is_jsdoc:
                print(f"FAIL: {path}:{line}: `/* */` comment inside a function/method body — use a `/** */` JSDoc block above the declaration instead", file=sys.stderr)
                fail = True
            line += comment.count("\n")
            i = (end + 2) if end != -1 else n
            continue
        if ch == "{":
            stack.append(is_function_open(preceding_buf))
            preceding_buf = ""
            i += 1
            continue
        if ch == "}":
            if stack:
                stack.pop()
            preceding_buf = ""
            i += 1
            continue
        if not ch.isspace():
            preceding_buf = (preceding_buf + ch)[-4:]
        i += 1


files = [
    p
    for p in sorted(ROOT.rglob("*.ts"))
    if not any(str(p).startswith(prefix) for prefix in EXEMPT_PREFIXES)
]
if not files:
    print("FAIL: no .ts files found under app/src", file=sys.stderr)
    sys.exit(1)

for p in files:
    scan(p)

if fail:
    sys.exit(1)

print(f"OK: no inline // or non-JSDoc /* */ comments inside function/method bodies across {len(files)} file(s) under app/src.")
PY
```

- [ ] **Step 5: Run it and confirm it passes now**

Run: `chmod +x scripts/check-no-inline-comments.sh && bash scripts/check-no-inline-comments.sh`
Expected: `OK: no inline // or non-JSDoc /* */ comments inside function/method bodies across 87 file(s) under app/src.` (file count may differ slightly if the tree has changed since this plan was written — any count is fine as long as no `FAIL:` lines print).

- [ ] **Step 6: Verify it catches a real violation (fixture check)**

Run:
```bash
cp app/src/lib/client/alpine/register-stores.ts /tmp/register-stores.ts.bak
python3 -c "
import re
p = 'app/src/lib/client/alpine/register-stores.ts'
text = open(p).read()
text = text.replace(
    'const persist = () =>',
    '// inline note that should not be here\n  const persist = () =>',
    1,
)
open(p, 'w').write(text)
"
bash scripts/check-no-inline-comments.sh; echo "exit=$?"
cp /tmp/register-stores.ts.bak app/src/lib/client/alpine/register-stores.ts
bash scripts/check-no-inline-comments.sh
```
Expected: the middle run prints `FAIL: app/src/lib/client/alpine/register-stores.ts:N: \`//\` comment inside a function/method body ...` and `exit=1`. The final run after restoring the backup prints `OK:` again.

- [ ] **Step 7: Wire into pre-commit**

In `.husky/pre-commit`, find:

```sh
       && bash scripts/check-alias-sync.sh \
       && bash scripts/check-constraint-mirror.sh
```

Replace with:

```sh
       && bash scripts/check-alias-sync.sh \
       && bash scripts/check-constraint-mirror.sh \
       && bash scripts/check-no-inline-comments.sh
```

- [ ] **Step 8: Wire into `quality.yml`**

In `.github/workflows/quality.yml`, find:

```yaml
      - name: Constraint-mirror gate
        run: bash scripts/check-constraint-mirror.sh
```

Replace with:

```yaml
      - name: Constraint-mirror gate
        run: bash scripts/check-constraint-mirror.sh
      - name: No-inline-comments gate
        run: bash scripts/check-no-inline-comments.sh
```

- [ ] **Step 9: Register in the context map**

In `docs/architecture/00-Context-Map.md`, find the `check-constraint-mirror.sh` row added in Task 4 and insert immediately after it:

```
| `scripts/check-no-inline-comments.sh` | Guard: no `//` or non-JSDoc `/* */` comment inside a function/method body under `app/src/**/*.ts`; JSDoc `/** */` above a declaration stays exempt | canonical |
```

- [ ] **Step 10: Add the DECISIONS.md entry**

In `DECISIONS.md`, insert after the `D159` row:

```
| D160 | 2026-07-28 | New `scripts/check-no-inline-comments.sh` fails on a `//` or non-JSDoc `/* */` comment lexically inside a function/method body under `app/src/**/*.ts` (JSDoc `/**` above a declaration stays exempt, matching the existing "JSDoc above the declaration" rule); found and fixed 3 pre-existing violations (`register-stores.ts`, two in `score-training-setup.data.ts`) that had shipped under the same rule as prose only | The rule existed since app/CLAUDE.md's TypeScript comments section but was never mechanically checked; the gate's first real run caught real violations, confirming the prose-only gap |
```

- [ ] **Step 11: Commit**

```bash
git add app/src/lib/client/alpine/register-stores.ts app/src/lib/game/score-training-setup.data.ts scripts/check-no-inline-comments.sh .husky/pre-commit .github/workflows/quality.yml docs/architecture/00-Context-Map.md DECISIONS.md
git commit -m "feat: mechanize the TS inline-comment ban, fix 3 pre-existing violations"
```

---

### Task 6: Create `check-style-tokens.sh`

**Files:**
- Create: `scripts/check-style-tokens.sh`
- Modify: `.husky/pre-commit`
- Modify: `.github/workflows/quality.yml`
- Modify: `app/CLAUDE.md` / `app/AGENT.md` (Style non-negotiables pointer)
- Modify: `docs/architecture/00-Context-Map.md`
- Modify: `DECISIONS.md`

**Interfaces:**
- Consumes: `app/src/**/*.astro`, `app/src/**/*.css` (read-only, grep).
- Produces: exit 0/1 + stderr diagnostics.

- [ ] **Step 1: Confirm the current tree is clean**

Run:
```bash
grep -rnE 'font-medium' app/src --include="*.astro" --include="*.css" || echo "none"
grep -rnE '\{\.\.\.rest\}' app/src --include="*.astro" || echo "none"
grep -rnE '\b(bg-bg[a-z0-9-]*|text-fg[a-z0-9-]*)\b' app/src --include="*.astro" --include="*.css" || echo "none"
```
Expected: `none` printed for all three.

- [ ] **Step 2: Create the script**

Write `scripts/check-style-tokens.sh`:

```bash
#!/usr/bin/env bash
# Style-token gate (app/CLAUDE.md "Style non-negotiables" / D108, D126, D128):
# no font-medium, no {...rest} spread, no raw bg-bg*/text-fg* palette
# utilities across app/src/**/*.astro and *.css. Previously enforced only by
# human review of the diff.
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

FAIL=0

FONT_MEDIUM=$(grep -rnE 'font-medium' app/src --include="*.astro" --include="*.css")
if [ -n "$FONT_MEDIUM" ]; then
  echo "FAIL: font-medium found — use font-normal/font-semibold/font-bold instead:" >&2
  echo "$FONT_MEDIUM" >&2
  FAIL=1
fi

REST_SPREAD=$(grep -rnE '\{\.\.\.rest\}' app/src --include="*.astro")
if [ -n "$REST_SPREAD" ]; then
  echo "FAIL: {...rest} found — forward leftover attributes as {...props} instead:" >&2
  echo "$REST_SPREAD" >&2
  FAIL=1
fi

RAW_PALETTE=$(grep -rnE '\b(bg-bg[a-z0-9-]*|text-fg[a-z0-9-]*)\b' app/src --include="*.astro" --include="*.css")
if [ -n "$RAW_PALETTE" ]; then
  echo "FAIL: raw palette utility found — use semantic tokens (surface/foreground/muted*/accent*/states) instead:" >&2
  echo "$RAW_PALETTE" >&2
  FAIL=1
fi

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi
echo "OK: no font-medium, {...rest}, or raw bg-bg*/text-fg* palette utilities under app/src."
```

- [ ] **Step 3: Run it**

Run: `chmod +x scripts/check-style-tokens.sh && bash scripts/check-style-tokens.sh`
Expected: `OK: no font-medium, {...rest}, or raw bg-bg*/text-fg* palette utilities under app/src.`

- [ ] **Step 4: Verify it catches a violation (fixture check)**

Run:
```bash
TESTFILE=$(find app/src/components -name "*.astro" | head -1)
cp "$TESTFILE" /tmp/style-fixture.astro.bak
echo '<div class="font-medium">test</div>' >> "$TESTFILE"
bash scripts/check-style-tokens.sh; echo "exit=$?"
cp /tmp/style-fixture.astro.bak "$TESTFILE"
bash scripts/check-style-tokens.sh
```
Expected: the middle run prints `FAIL: font-medium found ...` and `exit=1`; the final run prints `OK:` again.

- [ ] **Step 5: Wire into pre-commit**

In `.husky/pre-commit`, find:

```sh
       && bash scripts/check-constraint-mirror.sh \
       && bash scripts/check-no-inline-comments.sh
```

Replace with:

```sh
       && bash scripts/check-constraint-mirror.sh \
       && bash scripts/check-no-inline-comments.sh \
       && bash scripts/check-style-tokens.sh
```

- [ ] **Step 6: Wire into `quality.yml`**

In `.github/workflows/quality.yml`, find:

```yaml
      - name: No-inline-comments gate
        run: bash scripts/check-no-inline-comments.sh
```

Replace with:

```yaml
      - name: No-inline-comments gate
        run: bash scripts/check-no-inline-comments.sh
      - name: Style-tokens gate
        run: bash scripts/check-style-tokens.sh
```

- [ ] **Step 7: Update `app/CLAUDE.md`'s Style non-negotiables**

In `app/CLAUDE.md`, find:

```
- Full rules: `docs/architecture/07-Frontend/07-Style-Guide.md` (visual) and `07-Frontend/05-Astro-Components.md` (class composition / props)
```

Replace with:

```
- Full rules: `docs/architecture/07-Frontend/07-Style-Guide.md` (visual) and `07-Frontend/05-Astro-Components.md` (class composition / props); `font-medium`/`{...rest}`/raw palette utilities mechanically enforced by `scripts/check-style-tokens.sh` (2026-07-28)
```

Apply the identical edit to `app/AGENT.md`.

- [ ] **Step 8: Register in the context map**

In `docs/architecture/00-Context-Map.md`, find the `check-no-inline-comments.sh` row added in Task 5 and insert immediately after it:

```
| `scripts/check-style-tokens.sh` | Guard: no `font-medium`, `{...rest}`, or raw `bg-bg*`/`text-fg*` palette utilities under `app/src/**/*.{astro,css}` | canonical |
```

- [ ] **Step 9: Add the DECISIONS.md entry**

In `DECISIONS.md`, insert after the `D160` row:

```
| D161 | 2026-07-28 | New `scripts/check-style-tokens.sh` bans `font-medium`, `{...rest}`, and raw `bg-bg*`/`text-fg*` palette utilities across `app/src/**/*.{astro,css}` | Mechanizes the Style non-negotiables in app/CLAUDE.md (D108/D126/D128), previously enforced only by human review of the diff |
```

- [ ] **Step 10: Commit**

```bash
git add scripts/check-style-tokens.sh .husky/pre-commit .github/workflows/quality.yml app/CLAUDE.md app/AGENT.md docs/architecture/00-Context-Map.md DECISIONS.md
git commit -m "feat: mechanize the style-token non-negotiables"
```

---

### Task 7: Add the branch-stack cap CI job (closes D147)

**Files:**
- Modify: `.github/workflows/checks.yml`
- Modify: `CLAUDE.md` / `AGENT.md` (root, Hard Invariants pointer)
- Modify: `DECISIONS.md`

**Interfaces:**
- Consumes: GitHub REST API via `actions/github-script@v7` (`github.rest.pulls.list`), `context.payload.pull_request`, `context.payload.repository.default_branch`.
- Produces: a failing `branch-stack-cap` job status check on any PR whose base branch is itself one level deep in an existing open-PR stack.

- [ ] **Step 1: Read the current `checks.yml`**

Run: `cat .github/workflows/checks.yml`
Expected (current content, for reference before editing):
```yaml
name: checks

on:
  pull_request:
    branches: [main]

jobs:
  quality:
    uses: ./.github/workflows/quality.yml
```

- [ ] **Step 2: Add the `branch-stack-cap` job**

In `.github/workflows/checks.yml`, find:

```yaml
jobs:
  quality:
    uses: ./.github/workflows/quality.yml
```

Replace with:

```yaml
jobs:
  quality:
    uses: ./.github/workflows/quality.yml

  branch-stack-cap:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: read
    steps:
      - name: Fail if this PR's base is already one level deep in an open-PR stack
        uses: actions/github-script@v7
        with:
          script: |
            const { data: openPRs } = await github.rest.pulls.list({
              owner: context.repo.owner,
              repo: context.repo.repo,
              state: "open",
              per_page: 100,
            });
            const baseByHead = new Map(openPRs.map((pr) => [pr.head.ref, pr.base.ref]));
            const defaultBranch = context.payload.repository.default_branch;
            const thisBase = context.payload.pull_request.base.ref;

            if (thisBase !== defaultBranch) {
              const basesBase = baseByHead.get(thisBase);
              if (basesBase && basesBase !== defaultBranch) {
                core.setFailed(
                  `This PR targets '${thisBase}', which is itself an open PR targeting ` +
                  `'${basesBase}' (not '${defaultBranch}'). That is already one branch ` +
                  `targeting another; this PR would add a second, stacking three deep. ` +
                  `At most one open branch may target another task branch (root CLAUDE.md ` +
                  `Hard Invariant) — land '${thisBase}' first, or merge the work into one branch.`
                );
              }
            }
```

- [ ] **Step 3: Validate the YAML syntax locally**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/checks.yml'))" 2>&1 || node -e "require('js-yaml') && console.log('use python3 with pyyaml, or eyeball the indentation')"`
Expected: no exception. If `pyyaml` isn't installed in this environment, at minimum re-read the file with the Read tool and confirm indentation is consistent 2-space YAML (jobs → branch-stack-cap → runs-on/permissions/steps, each step's `with.script` block indented under a YAML block scalar `|`).

- [ ] **Step 4: Update root `CLAUDE.md`'s Hard Invariants**

In `CLAUDE.md`, find:

```
- At most one open task branch may target another task branch. A third stacked branch means the first must land, or the work merges into one branch. (2026-07-26)
```

Replace with:

```
- At most one open task branch may target another task branch. A third stacked branch means the first must land, or the work merges into one branch. Mechanically enforced on every PR by the `branch-stack-cap` job in `.github/workflows/checks.yml`. (2026-07-26; gate added 2026-07-28)
```

Apply the identical edit to `AGENT.md` (repo root).

- [ ] **Step 5: Add the DECISIONS.md entry**

In `DECISIONS.md`, insert after the `D161` row:

```
| D162 | 2026-07-28 | New `checks.yml` job `branch-stack-cap` fails a PR whose base branch is itself the head of another open PR targeting a non-default branch | Mechanizes D147 (at most one open branch may target another) against live PR state, which a local script cannot see reliably |
```

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/checks.yml CLAUDE.md AGENT.md DECISIONS.md
git commit -m "feat: mechanize the D147 branch-stack cap as a PR-time CI gate"
```

- [ ] **Step 7: Note the verification limit**

This job cannot be fully verified until a real PR against a stacked base branch exists in GitHub — running it locally isn't possible (it depends on live `context.payload` and the GitHub API). Record in the completion report that this job's logic was verified by code review and by the two-level-nesting trace in this plan's Background, not by a live PR firing, and ask the user to confirm its behavior the next time a stacked-branch PR actually opens.

---

### Task 8: Add the test-repointing heuristic CI job (closes D148, non-blocking)

**Files:**
- Modify: `.github/workflows/checks.yml`
- Modify: `DECISIONS.md`

**Interfaces:**
- Consumes: `git diff` against the PR's base ref, GitHub REST API via `actions/github-script@v7` (`github.rest.issues.createComment`).
- Produces: a non-blocking PR comment (job never fails) listing test files where an assertion literal changed but no `describe`/`it` title changed in the same diff.

- [ ] **Step 1: Add the `test-repointing-heuristic` job**

In `.github/workflows/checks.yml`, find:

```yaml
  branch-stack-cap:
```

and locate the end of that job (the `core.setFailed(...)` closing and the script block's end — i.e., the last line of Task 7's addition). Append this new job after it, at the same indentation level as `quality:` and `branch-stack-cap:`:

```yaml

  test-repointing-heuristic:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Diff app/tests for changed assertions with no changed describe/it title
        id: scan
        run: |
          BASE_REF="${{ github.event.pull_request.base.ref }}"
          git fetch origin "$BASE_REF" --depth=1
          CHANGED_FILES=$(git diff --name-only "origin/$BASE_REF"...HEAD -- 'app/tests/**/*.test.ts' || true)
          : > /tmp/flagged.txt
          for f in $CHANGED_FILES; do
            ASSERTION_HUNKS=$(git diff -U0 "origin/$BASE_REF"...HEAD -- "$f" | grep -E '^\+.*(\.toBe\(|\.toEqual\(|\.parse\(|expect\()' || true)
            if [ -z "$ASSERTION_HUNKS" ]; then continue; fi
            TITLE_HUNKS=$(git diff -U0 "origin/$BASE_REF"...HEAD -- "$f" | grep -E '^[+-].*\b(describe|it)\(' || true)
            if [ -z "$TITLE_HUNKS" ]; then
              echo "$f: assertion literal(s) changed, no describe/it title changed in the same diff" >> /tmp/flagged.txt
            fi
          done
          if [ -s /tmp/flagged.txt ]; then
            echo "flagged=true" >> "$GITHUB_OUTPUT"
          else
            echo "flagged=false" >> "$GITHUB_OUTPUT"
          fi
      - name: Post non-blocking review nudge
        if: steps.scan.outputs.flagged == 'true'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require("fs");
            const body =
              "**Test-repointing check (non-blocking):** these changed test files have a " +
              "changed assertion literal but no changed `describe`/`it` title in the same " +
              "diff — worth a human look per D148 (a dropped constraint can hide behind a " +
              "test quietly repointed at a different input):\n\n```\n" +
              fs.readFileSync("/tmp/flagged.txt", "utf8") +
              "\n```";
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.payload.pull_request.number,
              body,
            });
```

- [ ] **Step 2: Verify the diff-scan logic locally against this repo's own history**

Run:
```bash
git diff --name-only HEAD~5...HEAD -- 'app/tests/**/*.test.ts'
```
Expected: prints whichever test files (if any) changed in the last 5 commits — confirms the glob and diff syntax work in this repo without erroring. This does not exercise the GitHub Actions context (job ID outputs, PR comment), which can only be verified on a real PR.

- [ ] **Step 3: Add the DECISIONS.md entry**

In `DECISIONS.md`, insert after the `D162` row:

```
| D163 | 2026-07-28 | New `checks.yml` job `test-repointing-heuristic` posts a non-blocking PR comment when a changed `app/tests/**` assertion literal has no changed `describe`/`it` title in the same diff | Nudges human review toward D148's exact failure shape (a dropped constraint hidden behind a quietly repointed test) without hard-failing legitimate test updates |
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/checks.yml DECISIONS.md
git commit -m "feat: add the D148 test-repointing heuristic as a non-blocking CI nudge"
```

---

### Task 9: Create the `context-maintenance` skill, shrink root CLAUDE.md/AGENT.md

**Files:**
- Create: `.claude/skills/context-maintenance/SKILL.md`
- Modify: `CLAUDE.md` / `AGENT.md` (root)
- Modify: `docs/architecture/00-Context-Map.md`
- Modify: `DECISIONS.md`

**Interfaces:**
- Consumes: the `run-all-gates` skill by name (created in Task 12 — this skill's step 5 references it by name even though it doesn't exist yet at this task's commit; that's acceptable since it's a documentation reference, not a runtime dependency, and Task 12 lands later in this same plan).
- Produces: a skill invocable via the Skill tool as `context-maintenance`.

- [ ] **Step 1: Create the skill**

Write `.claude/skills/context-maintenance/SKILL.md`:

```markdown
---
name: context-maintenance
description: Use before claiming any Dart Analytics task done — runs the mandatory context-upkeep steps (CLAUDE.md/AGENT.md sync, context-map registration, DECISIONS.md entry, knowledge-graph refresh, gate scripts, branch/PR check, self-learning gate) so the context system never goes stale.
---

# Context Maintenance

Before claiming any task done on this repository:

1. **CLAUDE.md/AGENT.md sync.** Update the `CLAUDE.md` nearest to what you changed if your change adds, alters, or invalidates a rule in it — and its `AGENT.md` mirror in the same directory, if one exists, kept byte-for-byte identical (repo root, `app/`, `app/src/db/`, `app/src/pages/api/`, `database/`, `docs/`).
2. **Context map.** Register new, moved, renamed, or deleted docs in `docs/architecture/00-Context-Map.md` in the same change.
3. **Decision ledger.** Record new architectural decisions as one-line entries in `DECISIONS.md`.
4. **Dates.** Add an ISO date (`YYYY-MM-DD`) to every newly added or changed docs row entry.
5. **Gate scripts.** Invoke the `run-all-gates` skill and confirm every script it runs passes.
6. **Knowledge graph.** Refresh: `bash scripts/refresh-graph.sh`, then stage `graphify-out/graph.json` (AST-only — no API cost). Git hooks automate this at commit; this step is the backstop when hooks are not installed. If graphify is not set up in this environment, say so in the completion report rather than skipping silently.
7. **Branch/PR.** Confirm the work is on `main` or an open PR targets `main`; report the PR link (or the reason none exists) in the completion report.
8. **Self-learning gate.** If this task surfaced a rule that was ambiguous, missing, unenforced, or contradicted by the real code/config — beyond what step 1 already requires for the change itself — propose the specific `CLAUDE.md`/`AGENT.md` sharpening in chat and get the user's explicit approval before writing it. Never apply a rule change unilaterally. If the user declines, leave the rule as-is and move on; the gate exists to keep rule evolution deliberate, not to force a change.

A change that leaves the context map, CLAUDE.md files, decision ledger, or knowledge graph stale is incomplete, even if the code works.
```

- [ ] **Step 2: Shrink root `CLAUDE.md`'s Context Maintenance section**

In `CLAUDE.md`, find the entire section from `# Context Maintenance (mandatory, every task)` through the paragraph ending `...or knowledge graph stale is incomplete, even if the code works.` (i.e., replace the whole section between that heading and the next `---`):

```
# Context Maintenance (mandatory, every task)

The context system is part of every deliverable. Before claiming any task done:

1. Update the `CLAUDE.md` nearest to what you changed if your change adds, alters, or invalidates a rule in it — and its `AGENT.md` mirror in the same directory, if one exists, kept byte-for-byte identical (repo root, `app/`, `app/src/db/`, `app/src/pages/api/`, `database/`, `docs/`).
2. Register new, moved, renamed, or deleted docs in `00-Context-Map.md` in the same change.
3. Record new architectural decisions as one-line entries in `DECISIONS.md`.
4. Add an ISO date (`YYYY-MM-DD`) to every newly added or changed docs row entry.
5. Run `scripts/check-context-map.sh`, `scripts/check-file-locations.sh`, `scripts/check-agent-mirrors.sh`, `scripts/check-astro-class-composition.sh`, `scripts/check-astro-conventions.sh`, `scripts/check-doc-links.sh`, and `scripts/check-context-budget.sh` — all seven must pass.
6. Refresh the knowledge graph: `bash scripts/refresh-graph.sh`, then stage `graphify-out/graph.json` (AST-only — no API cost). Git hooks automate this at commit; this gate item is the backstop when hooks are not installed. If graphify is not set up in this environment, say so in the completion report rather than skipping silently.
7. Confirm the work is on `main` or an open PR targets `main`; report the PR link (or the reason none exists) in the completion report.
8. **Self-learning gate:** if this task surfaced a rule that was ambiguous, missing, unenforced, or contradicted by the real code/config — beyond what step 1 already requires for the change itself — propose the specific `CLAUDE.md`/`AGENT.md` sharpening in chat and get the user's explicit approval before writing it. Never apply a rule change unilaterally. If the user declines, leave the rule as-is and move on; the gate exists to keep rule evolution deliberate, not to force a change.

A change that leaves the context map, CLAUDE.md files, decision ledger, **or knowledge graph** stale is incomplete, even if the code works.
```

Replace with:

```
# Context Maintenance (mandatory, every task)

The context system is part of every deliverable. Before claiming any task done, run the `context-maintenance` skill.

A change that leaves the context map, CLAUDE.md files, decision ledger, or knowledge graph stale is incomplete, even if the code works. (procedure moved to `.claude/skills/context-maintenance/SKILL.md`, 2026-07-28)
```

Apply the identical edit to `AGENT.md` (repo root).

- [ ] **Step 3: Verify the mirror still matches and word count dropped**

Run: `bash scripts/check-agent-mirrors.sh && wc -w CLAUDE.md`
Expected: `OK: every CLAUDE.md/AGENT.md pair is identical.` and a word count measurably lower than the pre-edit 1147 words.

- [ ] **Step 4: Register the skill in the context map**

In `docs/architecture/00-Context-Map.md`, find:

```
| `.claude/skills/graphify/SKILL.md` | Graphify skill — build/query the codebase knowledge graph | canonical |
```

Replace with:

```
| `.claude/skills/graphify/SKILL.md` | Graphify skill — build/query the codebase knowledge graph | canonical |
| `.claude/skills/context-maintenance/SKILL.md` | Context Maintenance 8-step procedure, invoked before claiming any task done (2026-07-28) | canonical |
```

- [ ] **Step 5: Add the DECISIONS.md entry**

In `DECISIONS.md`, insert after the `D163` row:

```
| D164 | 2026-07-28 | New skill `.claude/skills/context-maintenance/SKILL.md` holds the 8-step Context Maintenance procedure verbatim; root `CLAUDE.md`/`AGENT.md` keep only the invariant and a pointer to the skill | Procedure prose was loaded on every session regardless of relevance; skills load on demand |
```

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/context-maintenance/SKILL.md CLAUDE.md AGENT.md docs/architecture/00-Context-Map.md DECISIONS.md
git commit -m "feat: extract Context Maintenance into an on-demand skill"
```

---

### Task 10: Create the `validate-app` skill, shrink app/CLAUDE.md/AGENT.md

**Files:**
- Create: `.claude/skills/validate-app/SKILL.md`
- Modify: `app/CLAUDE.md` / `app/AGENT.md`
- Modify: `docs/architecture/00-Context-Map.md`
- Modify: `DECISIONS.md`

**Interfaces:**
- Produces: a skill invocable via the Skill tool as `validate-app`.

- [ ] **Step 1: Create the skill**

Write `.claude/skills/validate-app/SKILL.md`:

```markdown
---
name: validate-app
description: Use before claiming any app/ change done — runs the Dart Analytics validate:app sequence (db:status, db:migrate, db:introspect, fallow, tests, astro check, graph refresh) and states when to also run it mid-task.
---

# Validate App

The sole validation procedure for `app/` changes:

```bash
cd app && npm run validate:app
```

This executes, in order: `db:status` → `db:migrate` → `db:introspect` → `npx fallow` → `npm test` → `npm run check` (`rm -rf .astro && astro check`) → `bash ../scripts/refresh-graph.sh` (graph refresh warns instead of failing when the graphify CLI is absent — record that warning in the completion report). Stage `graphify-out/graph.json` when it changed. Seeding (`npm run db:seed`) is environment provisioning, not validation — see `docs/architecture/05-Database/11-Neon-Integration.md`.

**Mid-task gate (multi-step / multi-commit work):** a focused vitest file going green is not enough to claim a task done when the change touches services, repositories, middleware, or shared client API code. Before that claim, also run `npx fallow` and `npm run check` and fix any new failures they surface — plan-faithful code can still leave type or maintainability gates red. The full sequence above remains the completion bar for the whole change set.
```

- [ ] **Step 2: Shrink `app/CLAUDE.md`'s Validation Standard Procedure section**

In `app/CLAUDE.md`, find:

```
## Validation Standard Procedure (sole definition)

Run for `app/` changes before claiming completion:

```
npm run validate:app
```

This executes, in order: `db:status` → `db:migrate` → `db:introspect` → `npx fallow` → `npm test` → `npm run check` (`rm -rf .astro && astro check`) → `bash scripts/refresh-graph.sh` (graph refresh warns instead of failing when the graphify CLI is absent — record that warning in the completion report). Stage `graphify-out/graph.json` when it changed. Seeding (`npm run db:seed`) is environment provisioning, not validation — see `docs/architecture/05-Database/11-Neon-Integration.md`. (2026-07-22)

**Mid-task gate (multi-step / multi-commit work):** a focused vitest file going green is not enough to claim a task done when the change touches services, repositories, middleware, or shared client API code. Before that claim, also run `npx fallow` and `npm run check` and fix any new failures they surface — plan-faithful code can still leave type or maintainability gates red. The full `validate:app` remains the completion bar for the whole change set. (2026-07-22)
```

Replace with:

```
## Validation Standard Procedure (sole definition)

Run for `app/` changes before claiming completion — full procedure and mid-task gate condition in the `validate-app` skill:

```
npm run validate:app
```

(2026-07-22; procedure moved to `.claude/skills/validate-app/SKILL.md`, 2026-07-28)
```

Apply the identical edit to `app/AGENT.md`.

- [ ] **Step 3: Verify the mirror and word count**

Run: `bash scripts/check-agent-mirrors.sh && wc -w app/CLAUDE.md`
Expected: `OK: every CLAUDE.md/AGENT.md pair is identical.` and a word count lower than the pre-edit 1366 words.

- [ ] **Step 4: Register the skill in the context map**

In `docs/architecture/00-Context-Map.md`, find:

```
| `.claude/skills/context-maintenance/SKILL.md` | Context Maintenance 8-step procedure, invoked before claiming any task done (2026-07-28) | canonical |
```

Replace with:

```
| `.claude/skills/context-maintenance/SKILL.md` | Context Maintenance 8-step procedure, invoked before claiming any task done (2026-07-28) | canonical |
| `.claude/skills/validate-app/SKILL.md` | `validate:app` sequence + mid-task gate condition for `app/` changes (2026-07-28) | canonical |
```

- [ ] **Step 5: Add the DECISIONS.md entry**

In `DECISIONS.md`, insert after the `D164` row:

```
| D165 | 2026-07-28 | New skill `.claude/skills/validate-app/SKILL.md` holds the `validate:app` sequence and mid-task gate condition; `app/CLAUDE.md`/`AGENT.md` keep only the bare command and a pointer | Same context-budget rationale as D164, scoped to `app/` tasks |
```

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/validate-app/SKILL.md app/CLAUDE.md app/AGENT.md docs/architecture/00-Context-Map.md DECISIONS.md
git commit -m "feat: extract the validate:app procedure into an on-demand skill"
```

---

### Task 11: Fold TDD procedure into `verification-before-completion`, trim app/CLAUDE.md

**Files:**
- Modify: `.claude/skills/verification-before-completion/SKILL.md`
- Modify: `app/CLAUDE.md` / `app/AGENT.md`
- Modify: `DECISIONS.md`

**Interfaces:**
- Produces: the existing `verification-before-completion` skill now also covers this repo's TDD cycle.

- [ ] **Step 1: Add the Dart Analytics addendum to `verification-before-completion`**

In `.claude/skills/verification-before-completion/SKILL.md`, find:

```
## When To Apply

**ALWAYS before:**
- ANY variation of success/completion claims
- ANY expression of satisfaction
- ANY positive statement about work state
- Committing, PR creation, task completion
- Moving to next task
- Delegating to agents

**Rule applies to:**
- Exact phrases
- Paraphrases and synonyms
- Implications of success
- ANY communication suggesting completion/correctness

## The Bottom Line
```

Replace with:

```
## When To Apply

**ALWAYS before:**
- ANY variation of success/completion claims
- ANY expression of satisfaction
- ANY positive statement about work state
- Committing, PR creation, task completion
- Moving to next task
- Delegating to agents

**Rule applies to:**
- Exact phrases
- Paraphrases and synonyms
- Implications of success
- ANY communication suggesting completion/correctness

## Dart Analytics: red→green→refactor

Every `app/` behavior change follows this cycle:

1. Write a failing test that names the expected behavior.
2. Run `npm test` — confirm the **new** test fails for the right reason.
3. Implement the minimal code to pass.
4. Run `npm test` — all tests pass.
5. Refactor only with tests green.

Commands: `npm test` (CI), `npm run test:watch` (local), both from `app/`. Do not commit production code without its failing test written first (except greenfield scaffold commits that only add test infrastructure).

## The Bottom Line
```

- [ ] **Step 2: Trim `app/CLAUDE.md`'s TDD section**

In `app/CLAUDE.md`, find:

```
## Test-Driven Development (mandatory)

Every `app/` behavior change follows **red → green → refactor**:

1. Write a failing test that names the expected behavior.
2. Run `npm test` — confirm the **new** test fails for the right reason.
3. Implement the minimal code to pass.
4. Run `npm test` — all tests pass.
5. Refactor only with tests green.

Rules:

- Place tests under `app/tests/`, mirroring `app/src/`'s (and `app/scripts/`'s) directory structure — never colocated beside the module under test.
- Test pure functions, stores, clients, and utilities with Vitest mocks — no real network or Neon calls in unit tests.
- `.astro` markup: keep variant/branching logic inline in the component's own frontmatter. This logic is not unit-tested — there is no Astro-component test runner in this project — so do not extract a separate helper file solely to make it testable (D101).
- Do not commit production code without its failing test written first (except greenfield scaffold commits that only add test infrastructure).

Framework: **Vitest** (`vitest.config.ts` at `app/` root). Commands: `npm test` (CI), `npm run test:watch` (local).

Ground rules beyond the command sequence above (shared-mock promotion threshold, full-suite-always-runs policy): `docs/architecture/07-Frontend/06-Test-Strategy.md`.
```

Replace with:

```
## Test-Driven Development (mandatory)

Full red→green→refactor procedure: `verification-before-completion` skill, "Dart Analytics" section.

Rules:

- Place tests under `app/tests/`, mirroring `app/src/`'s (and `app/scripts/`'s) directory structure — never colocated beside the module under test.
- Test pure functions, stores, clients, and utilities with Vitest mocks — no real network or Neon calls in unit tests.
- `.astro` markup: keep variant/branching logic inline in the component's own frontmatter. This logic is not unit-tested — there is no Astro-component test runner in this project — so do not extract a separate helper file solely to make it testable (D101).

Framework: **Vitest** (`vitest.config.ts` at `app/` root).

Ground rules beyond the command sequence above (shared-mock promotion threshold, full-suite-always-runs policy): `docs/architecture/07-Frontend/06-Test-Strategy.md`. (procedure moved to `verification-before-completion` skill, 2026-07-28)
```

Apply the identical edit to `app/AGENT.md`.

- [ ] **Step 3: Verify the mirror**

Run: `bash scripts/check-agent-mirrors.sh`
Expected: `OK: every CLAUDE.md/AGENT.md pair is identical.`

- [ ] **Step 4: Add the DECISIONS.md entry**

In `DECISIONS.md`, insert after the `D165` row:

```
| D166 | 2026-07-28 | TDD red→green→refactor procedure folded into the existing project-local `verification-before-completion` skill as a Dart-Analytics addendum; `app/CLAUDE.md`/`AGENT.md`'s TDD section keeps only the non-procedural rules (test location, Vitest-only mocks, `.astro` inline-logic exemption D101) | Same principle (evidence before claims) already lived in that skill; folding avoids a third near-duplicate procedure skill |
```

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/verification-before-completion/SKILL.md app/CLAUDE.md app/AGENT.md DECISIONS.md
git commit -m "feat: fold the TDD procedure into verification-before-completion"
```

---

### Task 12: Create the `run-all-gates` skill

**Files:**
- Create: `.claude/skills/run-all-gates/SKILL.md`
- Modify: `docs/architecture/00-Context-Map.md`
- Modify: `DECISIONS.md`

**Interfaces:**
- Consumes: every `scripts/check-*.sh` script created across Tasks 1–6 plus the pre-existing 3 (`check-context-map.sh`, `check-doc-links.sh`, `check-context-budget.sh`) — 11 total by this point.
- Produces: a skill invocable via the Skill tool as `run-all-gates`, referenced by name from `context-maintenance` (Task 9, step 5).

- [ ] **Step 1: Create the skill**

Write `.claude/skills/run-all-gates/SKILL.md`:

```markdown
---
name: run-all-gates
description: Use before claiming any Dart Analytics task done that touched app/, database/, or docs/ — dispatches the right check-*.sh scripts and validate:app/database checklist by changed area and reports each script's pass/fail explicitly.
---

# Run All Gates

Identifies and runs the gate scripts that apply to what changed, and reports every result explicitly — the "identify the command that proves the claim, then run it" step `verification-before-completion` demands.

## Always run

```bash
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-file-locations.sh
```

## If `app/` changed, also run

```bash
cd app && npm run validate:app && cd ..
bash scripts/check-astro-class-composition.sh
bash scripts/check-astro-conventions.sh
bash scripts/check-game-engines.sh
bash scripts/check-refinement-coverage.sh
bash scripts/check-type-barrels.sh
bash scripts/check-alias-sync.sh
bash scripts/check-constraint-mirror.sh
bash scripts/check-no-inline-comments.sh
bash scripts/check-style-tokens.sh
```

## If `database/` changed, also run

```bash
bash scripts/check-constraint-mirror.sh
```

Then work through the Validation Checklist in `database/CLAUDE.md` by hand (migration numbering, index rationale, spec sync) — it is not fully mechanized.

## Reporting

State each script's result (`OK` or `FAIL` and why) explicitly in the completion report. Do not summarize as "gates pass" without having actually run every applicable script in this session.
```

- [ ] **Step 2: Dry-run it against the current tree**

Run every command the skill lists (both "Always run" and "If `app/` changed"):
```bash
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-file-locations.sh
bash scripts/check-astro-class-composition.sh
bash scripts/check-astro-conventions.sh
bash scripts/check-game-engines.sh
bash scripts/check-refinement-coverage.sh
bash scripts/check-type-barrels.sh
bash scripts/check-alias-sync.sh
bash scripts/check-constraint-mirror.sh
bash scripts/check-no-inline-comments.sh
bash scripts/check-style-tokens.sh
cd app && npm run validate:app && cd ..
```
Expected: every script prints `OK:`; `npm run validate:app` completes with no new failures (if `db:status`/`db:migrate` fail because no Neon connection is configured in this environment, note that in the completion report — it is an environment limitation, not a plan defect).

- [ ] **Step 3: Register the skill in the context map**

In `docs/architecture/00-Context-Map.md`, find:

```
| `.claude/skills/validate-app/SKILL.md` | `validate:app` sequence + mid-task gate condition for `app/` changes (2026-07-28) | canonical |
```

Replace with:

```
| `.claude/skills/validate-app/SKILL.md` | `validate:app` sequence + mid-task gate condition for `app/` changes (2026-07-28) | canonical |
| `.claude/skills/run-all-gates/SKILL.md` | Dispatches the right `check-*.sh` scripts by changed area, reports each result explicitly (2026-07-28) | canonical |
```

- [ ] **Step 4: Add the DECISIONS.md entry**

In `DECISIONS.md`, insert after the `D166` row:

```
| D167 | 2026-07-28 | New skill `.claude/skills/run-all-gates/SKILL.md` dispatches the right `check-*.sh` scripts and `validate:app`/database checklist by changed area (`app/`, `database/`, `docs/`) and reports each result explicitly | Which gate applies to a given change was previously a memory burden; this makes it a lookup, and gives `verification-before-completion` a concrete command to point at |
```

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/run-all-gates/SKILL.md docs/architecture/00-Context-Map.md DECISIONS.md
git commit -m "feat: add the run-all-gates skill"
```

---

### Task 13: Final validation pass

**Files:** none created or modified — this task only runs verification and reports results.

**Interfaces:**
- Consumes: the `run-all-gates` skill (Task 12) and the `context-maintenance` skill (Task 9).

- [ ] **Step 1: Run every gate script**

Run:
```bash
for s in check-context-map check-doc-links check-context-budget check-agent-mirrors check-file-locations check-astro-class-composition check-astro-conventions check-game-engines check-refinement-coverage check-type-barrels check-alias-sync check-constraint-mirror check-no-inline-comments check-style-tokens; do
  echo "=== $s ==="
  bash "scripts/$s.sh" || echo "FAILED: $s"
done
```
Expected: 14 `OK:` lines total (one per script, some scripts may print more than one `OK`-prefixed line), zero `FAILED:` lines.

- [ ] **Step 2: Run the full app test suite and type check**

Run: `cd app && npm test && npm run check`
Expected: all tests pass; `astro check` reports 0 errors.

- [ ] **Step 3: Refresh the knowledge graph**

Run: `bash scripts/refresh-graph.sh`
Expected: either a successful refresh (stage `graphify-out/graph.json` if it changed) or, if the `graphify` CLI is not installed in this environment, a warning rather than a failure — record which happened in the completion report.

- [ ] **Step 4: Confirm word-count reduction (Success Criterion 3 from the spec)**

Run: `wc -w CLAUDE.md app/CLAUDE.md`
Expected: both counts measurably below their pre-plan baselines (root `CLAUDE.md`: 1147 words; `app/CLAUDE.md`: 1366 words).

- [ ] **Step 5: Confirm the context map lists all 14 gate scripts and 3 new skills**

Run: `grep -c "scripts/check-" docs/architecture/00-Context-Map.md`
Expected: at least 14 (11 pre-existing entries in the "Game engine code + mechanical guards" table plus the 3 new ones added in the "Cross-cutting mechanical guards" table this plan introduced — exact count depends on how many of the original 11 scripts were already listed there versus only referenced in CLAUDE.md prose; cross-check by eye against the table if the count looks low).

Run: `grep -c "\.claude/skills/" docs/architecture/00-Context-Map.md`
Expected: at least 4 (`graphify`, `context-maintenance`, `validate-app`, `run-all-gates`).

- [ ] **Step 6: Confirm branch/PR status**

Run: `git status --short -b && git log --oneline -15`
Expected: working tree clean, all 12 commits from Tasks 1–12 present, current branch is the one this plan's tasks were executed on (not `main`).

- [ ] **Step 7: Report completion**

State in the completion report: which of the 14 gate scripts passed, whether `npm run validate:app` needed a live Neon connection this environment doesn't have (and if so, which specific steps were skipped/warned rather than run), the before/after word counts for both `CLAUDE.md` files, and whether an open PR targets `main` (or the reason none exists yet) — matching the `context-maintenance` skill's own step 7 and step 8 (self-learning gate: only propose further rule changes if this pass surfaced something new; do not apply any unilaterally).

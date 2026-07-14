# Repository Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One `docs/` tree, top-level `database/`, `DECISIONS.md` and a new `README.md` at repo root, `architecture/` gone.

**Architecture:** `git mv` everything in one atomic commit together with every reference rewrite, so `scripts/check-context-map.sh` passes at that commit and no intermediate broken state exists in history. Historical documents keep their old-path text untouched.

**Tech Stack:** git, bash/sed, dbmate, graphifyy.

**Spec:** `docs/superpowers/specs/2026-07-14-repo-restructure-design.md`

## Global Constraints

- **Prerequisite:** the graphify-signal-hardening plan is DONE (`scripts/refresh-graph.sh` exists) — the post-move graph rebuild depends on it.
- **One commit** for Tasks 2–6 (spec D-F). Tasks are staged and verified incrementally but committed once.
- Migration/seed file **contents are byte-identical** — only paths move. Never edit an applied migration.
- Historical files are never rewritten: everything under `docs/superpowers/`, and `05-Database/07`–`09` (front-matter `status: historical` — verify before skipping anything else).
- `sed` replacement map (applies to canonical docs only): `architecture/docs/database` → `database` · `architecture/docs/architecture` → `docs/architecture` · `architecture/DECISIONS.md` → `DECISIONS.md` · `architecture/000_master_context.md` → (remove the sentence/row that references it).

---

### Task 1: Preflight inventory

**Files:** none (read-only)

**Interfaces:**
- Produces: `/tmp/refs_before.txt` — the definitive list of files that reference old paths, consumed by Task 4's completeness check.

- [ ] **Step 1: Record every old-path reference outside historical dirs**

```bash
cd "$(git rev-parse --show-toplevel)"
grep -rln "architecture/docs\|architecture/DECISIONS\|000_master_context" \
  --include="*.md" --include="*.sh" --include="*.json" --include="*.jsonc" \
  --include="*.ts" --include="*.mjs" --include="*.code-workspace" . \
  | grep -v node_modules | grep -v "^./docs/superpowers/" | grep -v graphify-out \
  | tee /tmp/refs_before.txt
```

Expected (baseline; exact list may include a few more — that is the point of recording it): `CLAUDE.md`, `app/CLAUDE.md`, `app/src/db/CLAUDE.md`, `app/src/pages/api/CLAUDE.md`, `app/package.json`, `app/.env.example`, `scripts/check-context-map.sh`, `dart-analytics.code-workspace`, `.github/pull_request_template.md` (maybe), and under `architecture/`: `CLAUDE.md`, `DECISIONS.md`, `docs/CLAUDE.md`, `docs/architecture/README.md`, `00-Context-Map.md`, `03-Engineering-Workflow`/`099` (maybe), `05-Database/{03,10,11}`, `06-API/00` (0012 path), `07-Frontend` docs (maybe).

- [ ] **Step 2: Confirm dbmate state before the move (comparison point)**

```bash
cd app && npm run db:status | tail -3; cd ..
```

Expected: `Applied: 16` (or equivalent status listing all 16). If the database is unreachable, note it and re-run this comparison in Task 6 against the same unavailable state (skip both, do not skip only one).

---

### Task 2: Move files, delete legacy, merge the two docs CLAUDE.md files

**Files:**
- Move: `architecture/docs/architecture/` → `docs/architecture/` · `architecture/docs/database/` → `database/` · `architecture/DECISIONS.md` → `DECISIONS.md`
- Delete: `architecture/000_master_context.md`, `architecture/CLAUDE.md`, `architecture/docs/CLAUDE.md`
- Create: `docs/CLAUDE.md` (merged)
- Modify: `database/CLAUDE.md` (absorb 3 SQL-safety bullets from the deleted `architecture/CLAUDE.md`)

- [ ] **Step 1: Moves**

```bash
git mv architecture/docs/architecture docs/architecture
git mv architecture/docs/database database
git mv architecture/DECISIONS.md DECISIONS.md
git rm architecture/000_master_context.md architecture/CLAUDE.md architecture/docs/CLAUDE.md
rmdir architecture/docs architecture 2>/dev/null; git status --short | head -8
```

Expected: renames (`R`) not delete+add for the moved trees; `architecture/` gone from the working tree.

- [ ] **Step 2: Create merged `docs/CLAUDE.md`**

```markdown
# Agent Rules — `docs/`

Scope: all documentation under `docs/` (foundation docs, database handbook, API/frontend docs; `docs/superpowers/` is historical). Global rules, authority order, and context packs live in `docs/architecture/00-Context-Map.md` — not repeated here. SQL migration/seed rules live in `database/CLAUDE.md`. (2026-07-14)

## Editing Workflow

1. Identify the canonical target doc for the change (use the context-map inventory).
2. Apply a minimal diff in the canonical doc first; align secondary docs to it.
3. Propagate only required consistency edits.

## Task Routing (edit the canonical doc first, then cascade)

- **Principles/System:** `01-Principles.md` / `02-System-Architecture.md`
- **Workflow/process:** `03-Engineering-Workflow.md` + `099-engineering-workflow-and-decision-framework.md`
- **Pattern-level:** `04-Architecture-patterns.md`, then impacted domain docs
- **Database model:** `05-Database/06-Database-Specification.md` (+ `06-Spec/` chapter), then `database/` migrations/seeds, then related `05-Database/*` guides
- **API contract:** `06-API/00-Overview.md` before or with implementation changes; implementation guidance in `06-API/01`–`02`
- **Frontend:** `07-Frontend/00-Overview.md` for integration; handbook `07-Frontend/01`–`05` + `10-Frontend-Agent-Guide.md`

## Strict Rules

- Documentation-first: update design docs before implementation guidance.
- Preserve folder hierarchy and numbering conventions.
- Keep terminology stable across files (`activity`, `exercise_session`, `turn`, `dart`, …).
- Do not mark speculative ideas as decisions; use explicit "Open Decisions" sections.
- Historical records stay historical: `05-Database/07`–`09`, `docs/superpowers/**` — status notes only, never rewrites.
- Keep the Worker/Neon/PostgreSQL responsibility split explicit in API docs.
- Keep naming conventions stable (`v_*`, `idx_*`, `fk_*`, `uq_*`, `chk_*`).

## Consistency Checks Before Finish

- No contradiction between architecture docs and the migration/seed chain (`0001`–`0016`).
- ID ownership consistent: Worker/API generates UUIDv7 for runtime entities.
- CQRS-lite intact: writes to runtime tables, reads from `v_*` views.
- Context Maintenance protocol (root `CLAUDE.md`) completed — ISO dates, map registration, checker pass.
```

- [ ] **Step 3: Absorb the SQL-safety deltas into `database/CLAUDE.md`**

In `database/CLAUDE.md` under `## Hard Constraints`, after the existing four bullets, add:

```markdown
- One responsibility per migration file; schema in migrations, controlled data in seeds.
- Explicit deterministic IDs in seeds where required.
- No indexes without a concrete query/access-path reason.
```

And in its header line, update the pack pointer path: `architecture/docs/architecture/00-Context-Map.md` → `docs/architecture/00-Context-Map.md` (the rest of that file's path fixes happen in Task 4's sweep; this one is called out because the file is being edited here anyway).

- [ ] **Step 4: Stage (no commit yet — atomic commit is Task 6)**

```bash
git add docs/CLAUDE.md database/CLAUDE.md
git status --short | wc -l   # sanity: large rename set staged
```

---

### Task 3: Rewrite the checker and the tooling configs

**Files:**
- Modify: `scripts/check-context-map.sh` (full replacement below)
- Modify: `app/package.json:15-16`
- Modify: `app/.env.example:35-36`

**Interfaces:**
- Produces: a checker whose resolver bases and globs match the new tree; consumed by every later plan's verification steps.

- [ ] **Step 1: Replace `scripts/check-context-map.sh` with the path-updated version**

```bash
#!/usr/bin/env bash
# Context-map consistency checker — part of the mandatory Context Maintenance
# protocol (root CLAUDE.md). Fails when the context system has gone stale:
#   1. a path referenced from a CLAUDE.md / README.md / 00-Context-Map.md does not exist
#   2. a doc quotes a migration range that disagrees with database/migrations/
#   3. a canonical doc under docs/architecture/ or database/ lacks a status front-matter header
#   4. a doc under docs/architecture/ is not registered in 00-Context-Map.md
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

MAP="docs/architecture/00-Context-Map.md"
FAIL=0
err() { echo "FAIL: $*" >&2; FAIL=1; }

# --- 1. Referenced paths resolve -------------------------------------------
ROUTING_FILES=$(git ls-files '*CLAUDE.md' '*README.md' "$MAP" | grep -v node_modules | grep -v '^docs/superpowers/')
for f in $ROUTING_FILES; do
  refs=$(grep -oE '`[A-Za-z0-9_./-]+\.(md|sql|sh)`' "$f" 2>/dev/null | tr -d '`' | sort -u)
  for ref in $refs; do
    found=0
    for base in "" "docs/architecture/" "docs/architecture/05-Database/" \
                "docs/architecture/06-API/" "docs/architecture/07-Frontend/" \
                "docs/" "database/" "$(dirname "$f")/"; do
      [ -e "${base}${ref}" ] && { found=1; break; }
    done
    [ $found -eq 1 ] || err "$f references missing file: $ref"
  done
done

# --- 2. Migration range consistency ----------------------------------------
ACTUAL_MAX=$(ls database/migrations/ | grep -oE '^[0-9]{4}' | sort | tail -1)
if [ -n "$ACTUAL_MAX" ]; then
  for f in CLAUDE.md DECISIONS.md $(git ls-files 'docs/architecture/*.md' 'database/*.md'); do
    head -6 "$f" | grep -q '^status: historical' && continue
    for q in $(grep -hoE '0001.?[–-].?.?[0-9]{4}' "$f" 2>/dev/null | grep -oE '[0-9]{4}$' | sort -u); do
      [ "$q" \> "0002" ] && [ "$q" != "$ACTUAL_MAX" ] \
        && err "$f quotes migration range ending $q but chain ends at $ACTUAL_MAX"
    done
  done
fi

# --- 3. Front-matter headers -----------------------------------------------
for f in $(git ls-files 'docs/architecture/*.md' 'database/*.md' | grep -v 'CLAUDE.md'); do
  head -1 "$f" | grep -q '^<!--' && head -6 "$f" | grep -q '^status:' \
    || err "$f lacks status front-matter header"
done

# --- 4. Map registration ----------------------------------------------------
for f in $(git ls-files 'docs/architecture/*.md' | grep -v 'CLAUDE.md'); do
  base=$(basename "$f")
  grep -q "$base" "$MAP" || err "$f is not registered in $MAP"
done

if [ $FAIL -eq 0 ]; then
  echo "OK: context map, references, migration ranges, and front-matter are consistent."
fi
exit $FAIL
```

Notes on deltas from the old script: `MAP` path; the seven resolver bases; migration dir `database/migrations/`; scan list now `CLAUDE.md DECISIONS.md docs/architecture/*.md database/*.md` (the old `architecture/*.md` glob covered DECISIONS and the master context — DECISIONS is now explicit, master context is deleted); routing-file scan excludes `docs/superpowers/` (historical specs/plans reference old paths by design).

- [ ] **Step 2: `app/package.json` — dbmate paths**

Replace both occurrences of `../architecture/docs/database/migrations` with `../database/migrations` in the `db:status` and `db:migrate` scripts.

- [ ] **Step 3: `app/.env.example` — DBMATE override comments**

```
# DBMATE_MIGRATIONS_DIR=../database/migrations
# DBMATE_SCHEMA_FILE=../database/schema.sql
```

- [ ] **Step 4: `dart-analytics.code-workspace` — update or confirm**

```bash
grep -n "architecture" dart-analytics.code-workspace || echo "no old paths"
```

If it defines folder entries for `architecture/`, replace them with `docs` and `database` entries (keep the existing JSON shape).

---

### Task 4: Reference sweep across canonical docs

**Files:**
- Modify: every file in `/tmp/refs_before.txt` that still exists post-move (root `CLAUDE.md`, `app/CLAUDE.md`, `app/src/db/CLAUDE.md`, `app/src/pages/api/CLAUDE.md`, `docs/architecture/**`, `database/README.md`, `.github/pull_request_template.md` if listed)

- [ ] **Step 1: Apply the mechanical map to canonical docs (never `docs/superpowers/`)**

```bash
FILES=$(grep -rl "architecture/docs\|architecture/DECISIONS" \
  --include="*.md" CLAUDE.md app docs/architecture database .github 2>/dev/null | grep -v superpowers)
for f in $FILES; do
  head -6 "$f" | grep -q '^status: historical' && { echo "skip historical: $f"; continue; }
  sed -i 's|architecture/docs/database|database|g; s|architecture/docs/architecture|docs/architecture|g; s|architecture/DECISIONS.md|DECISIONS.md|g' "$f"
done
```

- [ ] **Step 2: Hand-fix what the map cannot catch**

1. `docs/architecture/05-Database/11-Neon-Integration.md` — relative links gained a level: `../../database/README.md` → `../../../database/README.md` (2 places) and `../../../../app/CLAUDE.md` → `../../../app/CLAUDE.md`.
2. Root `CLAUDE.md` — "Where Everything Lives" table: delete the `architecture/000_master_context.md` row entirely (file deleted); the remaining rows were fixed by Step 1.
3. Root `CLAUDE.md` — Context Loading Protocol step 1 now reads `docs/architecture/00-Context-Map.md` (verify Step 1 caught it).
4. `DECISIONS.md` header — replace the lineage sentence:
   - old: `For deeper lineage consult \`architecture/000_master_context.md\` (historical, non-authoritative).`
   - new: `The raw design journey (master context) was retired 2026-07-14; deeper lineage lives in git history only.`
5. `docs/architecture/README.md` — "Repository Structure" code block: change `architecture/docs/` root to `docs/` + sibling `database/`, and the line `Application code lives outside \`architecture/docs/\`.` → `Application code lives in \`app/\`; executable schema in \`database/\`.`
6. `docs/architecture/00-Context-Map.md`:
   - path-convention note → `Paths are relative to \`docs/architecture/\` unless they start with \`docs/\`, \`database/\`, or \`app/\`.`
   - section headers: `## Foundation (\`docs/architecture/\`)`, `## SQL (\`database/\`)`, `## Context & history (repo root, \`docs/\`)`
   - "Why was X decided?" pack row → `\`DECISIONS.md\` (repo root); deeper lineage: git history`
   - inventory: `DECISIONS.md` row path updated; **delete** the `architecture/000_master_context.md` row; add row `| \`docs/CLAUDE.md\` | Docs-tree editing rules | canonical |` and update the `app/CLAUDE.md` row's description if it names old paths
   - header version bump: `> **Version:** 1.6.0 (2026-07-14 — repository restructure: docs/ + database/ + root ledger)`

- [ ] **Step 3: Completeness check (the failing-test moment)**

```bash
grep -rn "architecture/docs\|architecture/DECISIONS\|000_master_context" \
  --include="*.md" --include="*.sh" --include="*.json" --include="*.jsonc" \
  --include="*.mjs" --include="*.code-workspace" . 2>/dev/null \
  | grep -v node_modules | grep -v "^./docs/superpowers/" | grep -v graphify-out \
  | grep -v "07-Data-Model-Review\|08-Physical-Schema\|09-Pre-Implementation"
```

Expected: **empty**. Every hit is a missed reference — fix it with the map from Global Constraints and re-run.

---

### Task 5: Root README and ledger entry

**Files:**
- Create: `README.md`
- Modify: `DECISIONS.md` (append D94)

- [ ] **Step 1: Create `README.md`**

```markdown
# Dart Analytics

Personal darts scoring and long-term progression tracking. Architecture-first: every change is designed in the docs before it is implemented — the docs are the source of truth, and **"store what happened, derive what it means"** governs the data model.

**Stack:** Astro.js · TypeScript · Alpine.js · PostgreSQL (Neon) · Cloudflare Workers

## Layout

| Folder | Contents |
| ------ | -------- |
| `app/` | The application — Astro frontend + Worker API |
| `database/` | Executable schema: dbmate migrations (`0001`–`0016`) and seeds |
| `docs/` | Architecture documentation (`docs/architecture/`) and point-in-time design records (`docs/superpowers/`) |
| `scripts/` | Repo checks (`check-context-map.sh`, `refresh-graph.sh`) |
| `graphify-out/` | Committed AST-only codebase knowledge graph |

## Getting started

1. `cd app && cp .env.example .env` — fill in Neon values (see `app/README.md`)
2. `npm install && npm run db:status`
3. `npm run dev`
4. Before finishing any change: `npm run validate:app`

## Where to read next

- Architecture & documentation philosophy: `docs/architecture/README.md`
- Why decisions were made: `DECISIONS.md`
- Agent operating rules: `CLAUDE.md`
```

- [ ] **Step 2: Append D94 to the `Context & documentation system` table in `DECISIONS.md`**

```markdown
| D94 | 2026-07-14 | Repository restructure: single `docs/` tree (`docs/architecture/`, `docs/superpowers/`), executable SQL promoted to top-level `database/`, ledger at repo root, master context retired (git history only), root `README.md` added | Kill the `architecture/docs/architecture` stutter and the duplicate doc roots |
```

---

### Task 6: Verify everything, rebuild the graph, single atomic commit

**Files:**
- Modify: `graphify-out/graph.json` (rebuilt)

**Interfaces:**
- Consumes: `scripts/refresh-graph.sh` from the graphify plan.

- [ ] **Step 1: Checker**

```bash
bash scripts/check-context-map.sh
```

Expected: `OK: context map, references, migration ranges, and front-matter are consistent.`

- [ ] **Step 2: dbmate is path-agnostic — prove it**

```bash
cd app && npm run db:status | tail -3; cd ..
```

Expected: identical applied-count to Task 1 Step 2 (all 16 applied; the move is invisible to dbmate).

- [ ] **Step 3: Rebuild the knowledge graph (paths changed ⇒ full rebuild)**

```bash
rm -f graphify-out/graph.json
bash scripts/refresh-graph.sh
python3 -c "
import json
g = json.load(open('graphify-out/graph.json'))
files = {n.get('source_file','') for n in g['nodes']}
assert not any(f.startswith('architecture/') for f in files), 'stale paths in graph'
assert any(f.startswith('database/migrations/') for f in files), 'migrations missing'
print('graph OK:', len(g['nodes']), 'nodes')"
```

- [ ] **Step 4: The single atomic commit**

```bash
git add -A
git commit -m "refactor(repo): single docs/ tree, top-level database/, root README + ledger

- architecture/docs/architecture -> docs/architecture (git mv, history preserved)
- architecture/docs/database -> database/ (contents byte-identical; dbmate unaffected)
- DECISIONS.md -> repo root; 000_master_context.md retired (D94, git history only)
- merged architecture/CLAUDE.md + architecture/docs/CLAUDE.md -> docs/CLAUDE.md
- checker, dbmate scripts, env comments, and all canonical doc references updated
- knowledge graph fully rebuilt on new paths"
```

- [ ] **Step 5: Post-commit sanity**

```bash
git show --stat HEAD | tail -5
bash scripts/check-context-map.sh && echo "restructure complete"
```

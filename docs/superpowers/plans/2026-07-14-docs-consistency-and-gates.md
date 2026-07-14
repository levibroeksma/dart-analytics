# Docs Consistency Sweep & Quality-Gate Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the nine remaining point defects from the 2026-07-14 review, put the quality gates in CI, and de-duplicate the README's document index.

**Architecture:** Grep-first for every defect (prove it exists), minimal targeted edit, checker pass, commit per logical group. CI is one new GitHub Actions workflow running the free gates (checker, `astro check`, `fallow`); DB-backed gates stay local.

**Tech Stack:** Markdown, bash, GitHub Actions, Node 22.

**Spec:** `docs/superpowers/specs/2026-07-14-docs-consistency-and-gates-design.md` (item 5, CHECKLIST.md, already resolved by deletion 2026-07-14)

## Global Constraints

- **Prerequisite:** the repo-restructure plan is DONE — all paths below are POST-restructure (`docs/architecture/...`, `database/...`). If executing before the restructure, substitute `architecture/docs/architecture/` for `docs/architecture/` throughout.
- Minimal diffs; never regenerate a doc.
- Every changed doc row/reference gets an ISO date per Context Maintenance; `bash scripts/check-context-map.sh` must pass before every commit.
- Historical docs (`docs/superpowers/**`, `05-Database/07`–`09`) are never edited.

---

### Task 1: Foundation-doc fixes (spec items 1–4)

**Files:**
- Modify: `docs/architecture/README.md`
- Modify: `docs/architecture/00-Context-Map.md`
- Modify: `docs/architecture/04-Architecture-patterns.md`

- [ ] **Step 1: Prove the defects exist**

```bash
grep -n "00–04, 10\|00-04, 10" docs/architecture/README.md           # item 1: expect 1 hit
grep -n "05-Astro-Components" docs/architecture/README.md            # item 1: expect 0 hits in hierarchy/index
grep -n "15 recurring design patterns\|15 key rules" docs/architecture/00-Context-Map.md   # items 2–3: expect 2 hits
grep -n "^# Pattern 4\|^# Pattern 5" docs/architecture/04-Architecture-patterns.md          # item 4: both titled "Configuration Snapshot"
```

- [ ] **Step 2: `README.md` — register `05-Astro-Components.md` (item 1)**

Three edits:

1. Repository Structure block: `│   └── 07-Frontend/     # Frontend handbook (00–04, 10)` → `│   └── 07-Frontend/     # Frontend handbook (00–05, 10)`
2. Documentation Hierarchy `07-Frontend/` block — after the `04-Modules-And-OOP.md` line, insert:

```
  05-Astro-Components.md         ← .astro authoring conventions (2026-07-14)
```

3. Document Index — handled by Task 2 (the index is being replaced by a pointer; do not add a row here just to delete it in the next task).

- [ ] **Step 3: `00-Context-Map.md` — drop the rotting counts (items 2–3)**

- `| \`01-Principles.md\` | What we believe (core values, 15 key rules) | ...` → `| \`01-Principles.md\` | What we believe (core values + decision priorities) | ...`
- `| \`04-Architecture-patterns.md\` | 15 recurring design patterns + anti-patterns | ...` → `| \`04-Architecture-patterns.md\` | Recurring design patterns + anti-patterns | ...`

- [ ] **Step 4: `04-Architecture-patterns.md` — de-duplicate the pattern title (item 4)**

`# Pattern 4 — Configuration Snapshot` → `# Pattern 4 — Template → Snapshot Lifecycle` (Pattern 5 keeps "Configuration Snapshot"; it owns the JSONB modelling). Then verify nothing links to the old anchor:

```bash
grep -rn "Pattern 4" docs/ CLAUDE.md app --include="*.md" | grep -v superpowers | grep -v "04-Architecture-patterns.md"
```

Expected: no hits (fix any that appear to say "Pattern 4 — Template → Snapshot Lifecycle").

- [ ] **Step 5: Check + commit**

```bash
bash scripts/check-context-map.sh
git add docs/architecture/README.md docs/architecture/00-Context-Map.md docs/architecture/04-Architecture-patterns.md
git commit -m "docs: register 05-Astro-Components in README, drop stale counts, de-dup pattern title"
```

---

### Task 2: README index de-duplication (spec Decision 3.2)

**Files:**
- Modify: `docs/architecture/README.md` (Document Index section)

- [ ] **Step 1: Replace the entire `# Document Index` table with a pointer**

Delete the `# Document Index` heading's table (all ~24 rows) and the sentence above it, replacing the section body with:

```markdown
# Document Index

The per-file inventory (what each document answers, status, token budget) lives in **`00-Context-Map.md`** and is maintained under the Context Maintenance protocol. This README deliberately does not duplicate it — one registry, one place to go stale.

Every migration, view, API endpoint, and frontend component should be explainable by referring back to these documents.
```

- [ ] **Step 2: Prove the checker guards pack targets (spec Decision 3.1 — negative test)**

Temporarily break a pack reference, expect the checker to FAIL, then restore:

```bash
sed -i 's|`05-Database/05-Views.md`|`05-Database/05-Viewz.md`|' docs/architecture/00-Context-Map.md
bash scripts/check-context-map.sh; echo "exit=$?"          # expect FAIL + exit=1
git checkout -- docs/architecture/00-Context-Map.md
bash scripts/check-context-map.sh                           # expect OK again
```

If the broken reference does NOT fail, the resolver bases in `scripts/check-context-map.sh` are wrong for pack rows — fix the base list before proceeding (rule 1 is the load-bearing check of the whole context system).

- [ ] **Step 3: Check + commit**

```bash
bash scripts/check-context-map.sh
git add docs/architecture/README.md
git commit -m "docs: README defers document inventory to context map (single registry)"
```

---

### Task 3: API/DB doc fixes (spec items 6–8)

**Files:**
- Modify: `docs/architecture/06-API/02-Middleware-And-Layering.md`
- Modify: `docs/architecture/05-Database/03-Migrations.md`

- [ ] **Step 1: item 6 — DB client path heading**

In `06-API/02-Middleware-And-Layering.md`, `## \`lib/db/client.ts\`` → `## \`db/client.ts\`` (matches the doc's own tree, D78, and the code).

- [ ] **Step 2: item 7 — one name for the provision route class**

Same file, Middleware Flow diagram: `├─ provision-exempt route? → set locals.auth (authUserId only) → next()` → `├─ authenticated-unprovisioned route? → set locals.auth (authUserId only) → next()`. Then in the Route classes table's Authenticated-unprovisioned row description, append: `(historically "provision-exempt", D62)`. Verify no other live doc uses the old name unaliased:

```bash
grep -rn "provision-exempt" docs/architecture CLAUDE.md app --include="*.md" | grep -v superpowers
```

Expected: only the aliased mention above and the immutable D62 ledger row.

- [ ] **Step 3: item 8 — renumber colliding hypothetical examples in `03-Migrations.md`**

- `0013_add_dart_coordinates.sql` → `0017_add_dart_coordinates.sql` (Changing Existing Tables example)
- `0013_add_nickname_column.sql` → `0017_add_nickname_column.sql` and `0014_migrate_existing_nicknames.sql` → `0018_migrate_existing_nicknames.sql` (Data Migrations example)
- `0013_runtime_update.sql` → `0017_runtime_update.sql` (Anti-Patterns example)

```bash
grep -n "0013_add\|0013_runtime\|0014_migrate" docs/architecture/05-Database/03-Migrations.md
```

Expected after edits: no hits.

- [ ] **Step 4: Check + commit**

```bash
bash scripts/check-context-map.sh
git add docs/architecture/06-API/02-Middleware-And-Layering.md docs/architecture/05-Database/03-Migrations.md
git commit -m "docs(api,db): fix db client path heading, unify route-class name, renumber colliding examples"
```

---

### Task 4: Frontend structure truth (spec item 9)

**Files:**
- Modify: `docs/architecture/07-Frontend/02-Folder-Structure.md`
- Move: `app/src/lib/shared/nav/is-nav-active.ts` → `app/src/utils/is-nav-active.ts`
- Modify: every importer of the moved file

- [ ] **Step 1: Document `icons/`, `styles/` and the legacy `@lib` alias**

In the Authoritative Tree of `02-Folder-Structure.md`, add under `├── components/`'s sibling level:

```
├── icons/                           # @icons — SVG sources (astro-icon style imports)
├── styles/                          # @styles — global.css, Tailwind layers
```

In the Path Aliases table, add rows:

```
| `@icons/*` | `src/icons/*` |
| `@styles/*` | `src/styles/*` |
| `@lib/*` | `src/lib/*` (legacy — browser code migrates to `@client`, D66/D78) |
```

- [ ] **Step 2: Move the stray helper to its documented home**

```bash
grep -rln "is-nav-active" app/src --include="*.ts" --include="*.astro"   # find importers first
mkdir -p app/src/utils
git mv app/src/lib/shared/nav/is-nav-active.ts app/src/utils/is-nav-active.ts
rmdir app/src/lib/shared/nav app/src/lib/shared 2>/dev/null
```

Update each importer found above from its old relative/`@lib/shared/nav/...` path to `@utils/is-nav-active` (the `@utils` alias already exists in `app/tsconfig.json`).

- [ ] **Step 3: Type-check proves the move**

```bash
cd app && npx astro check 2>&1 | tail -3; cd ..
```

Expected: 0 errors (same count as before the move).

- [ ] **Step 4: Check + commit**

```bash
bash scripts/check-context-map.sh
git add -A
git commit -m "docs(frontend)+refactor: document icons/styles/@lib; move is-nav-active to @utils per structure doc"
```

---

### Task 5: Cosmetic fence collapse (spec item 10)

**Files:**
- Modify: `docs/architecture/05-Database/00-OVERVIEW.md` (Runtime Event Model section, lines ~237–273)

- [ ] **Step 1: Replace the broken per-word code fences**

The section currently renders each hierarchy word in its own fence. Replace the entire fenced sequence between "Gameplay is represented as an event hierarchy." and "The dart is the smallest recorded gameplay event." with one block:

```
Exercise Session
    ↓
Exercise Stage
    ↓
Turn
    ↓
Dart
```

(single fenced code block). Also collapse the same defect in the same file's "Database Philosophy" and "Technology" sections if their fences wrap single words (`Normalize first…`, `PostgreSQL`, `public`) — one fence per logical block.

- [ ] **Step 2: Check + commit**

```bash
bash scripts/check-context-map.sh
git add docs/architecture/05-Database/00-OVERVIEW.md
git commit -m "docs(db): collapse broken one-word code fences in overview"
```

---

### Task 6: CI workflow (spec Decision 2)

**Files:**
- Create: `.github/workflows/checks.yml`

**Interfaces:**
- Produces: a required PR gate running checker + `astro check` + `fallow`. DB-backed steps intentionally excluded (need Neon secrets — deferred, recorded in the spec).

- [ ] **Step 1: Write the workflow**

```yaml
name: checks

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  context-map:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Context-map consistency
        run: bash scripts/check-context-map.sh

  app:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: app
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: app/package-lock.json
      - name: Install
        run: npm ci
      - name: Type gate
        run: npx astro check
      - name: Stale-usage gate
        run: npx fallow
```

- [ ] **Step 2: Validate the YAML locally**

```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/checks.yml')); print('yaml ok')"
```

Expected: `yaml ok`. (If PyYAML is unavailable: `npx --yes yaml-lint .github/workflows/checks.yml` or visual inspection — indentation is the only risk.)

- [ ] **Step 3: Commit and verify on the PR**

```bash
git add .github/workflows/checks.yml
git commit -m "ci: run context-map checker, astro check, and fallow on every PR to main"
git push
```

After pushing the branch and opening/updating the PR, confirm both jobs go green in the PR checks UI. If `astro check` or `fallow` fails in CI but passes locally, the failure is environmental (missing `.env` is expected — neither gate needs DB credentials; `astro check` needs no env vars for this codebase). Fix forward, do not delete the workflow.

- [ ] **Step 4: Mark the workflow required (user action)**

GitHub → Settings → Branches → protection rule for `main` → require `context-map` and `app` checks. Record in the completion report that this needs the repo owner if the executing agent lacks admin.

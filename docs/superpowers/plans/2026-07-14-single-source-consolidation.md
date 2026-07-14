# Single-Source Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One executable validation procedure (owned by `npm run validate:app`) and one DB connection-string contract (owned by the Neon integration doc); every other document references, never redefines.

**Architecture:** Make `validate:app` the full gate including the guarded graph refresh, rewrite the four prose copies into references, then align the connection-variable story to observed Neon CLI ground truth (with a documented fallback if the environment can't be probed).

**Tech Stack:** npm scripts, bash, Markdown, TypeScript (one 3-line change), Neon CLI (one probe).

**Spec:** `docs/superpowers/specs/2026-07-14-single-source-consolidation-design.md`

## Global Constraints

- **Prerequisites:** graphify-signal-hardening plan DONE (`scripts/refresh-graph.sh` exists) and repo-restructure plan DONE (paths below are POST-restructure).
- The validation gate must degrade loudly, never silently: missing graphify CLI prints a WARN and exits 0.
- `npm run db:seed` is NOT part of standard validation (spec Decision 1.4) — it mutates shared dev data.
- Checker (`bash scripts/check-context-map.sh`) passes before every commit; ISO dates on changed doc lines.

---

### Task 1: `validate:app` becomes the full gate

**Files:**
- Modify: `app/package.json:20` (the `validate:app` script)
- Modify: `app/CLAUDE.md` (Validation Standard Procedure section)

**Interfaces:**
- Consumes: `scripts/refresh-graph.sh` (always exits 0; warns when CLI absent).
- Produces: `npm run validate:app` as THE validation command — referenced by Tasks 2 and by the mainline-governance plan's completion-gate wording.

- [ ] **Step 1: Prove the current script is incomplete (failing check)**

```bash
grep -o '"validate:app": "[^"]*"' app/package.json
```

Expected: current value ends at `astro check` — no graph refresh step.

- [ ] **Step 2: Extend the script**

In `app/package.json`, replace:

```json
"validate:app": "npm run db:status && npm run db:migrate && npm run db:introspect && npx fallow && astro check"
```

with:

```json
"validate:app": "npm run db:status && npm run db:migrate && npm run db:introspect && npx fallow && astro check && bash ../scripts/refresh-graph.sh"
```

- [ ] **Step 3: Run it**

```bash
cd app && npm run validate:app; echo "exit=$?"; cd ..
```

Expected: all five steps run, then either a graph refresh or the WARN line; `exit=0`. (If the DB is unreachable in this environment, `db:status` fails first — note that in the report and verify the script *tail* by running `bash ../scripts/refresh-graph.sh` directly from `app/`.)

- [ ] **Step 4: `app/CLAUDE.md` — the procedure becomes semantics + one command**

Replace the entire numbered list under `## Validation Standard Procedure (sole definition)` with:

```markdown
Run for `app/` changes before claiming completion:

```
npm run validate:app
```

This executes, in order: `db:status` → `db:migrate` → `db:introspect` → `npx fallow` → `astro check` → `bash scripts/refresh-graph.sh` (graph refresh warns instead of failing when the graphify CLI is absent — record that warning in the completion report). Stage `graphify-out/graph.json` when it changed. Seeding (`npm run db:seed`) is environment provisioning, not validation — see `docs/architecture/05-Database/11-Neon-Integration.md`. (2026-07-14)
```

- [ ] **Step 5: Commit**

```bash
bash scripts/check-context-map.sh
git add app/package.json app/CLAUDE.md
git commit -m "chore(validate): validate:app is the full gate incl. guarded graph refresh; CLAUDE.md defers to it"
```

---

### Task 2: The three prose copies become references

**Files:**
- Modify: `docs/architecture/05-Database/10-Database-Agent-Guide.md` (§Application Validation Procedure)
- Modify: `docs/architecture/05-Database/03-Migrations.md` (§Migration Execution (Application Workflow))
- Modify: `docs/architecture/05-Database/11-Neon-Integration.md` (§Migration Workflow (dbmate))

- [ ] **Step 1: Prove the drift (failing check)**

```bash
grep -c "db:status" docs/architecture/05-Database/10-Database-Agent-Guide.md \
  docs/architecture/05-Database/03-Migrations.md \
  docs/architecture/05-Database/11-Neon-Integration.md
```

Expected: ≥1 hit in each — three step-list copies.

- [ ] **Step 2: `10-Database-Agent-Guide.md`**

Replace the whole `# Application Validation Procedure` section body (the intro line + 5 numbered steps) with:

```markdown
For DB-related work that touches `app/` integration, run the Validation Standard Procedure: `npm run validate:app` (sole definition: `app/CLAUDE.md`). <!-- 2026-07-14 -->
```

- [ ] **Step 3: `03-Migrations.md`**

In §Migration Execution (Application Workflow), replace the "Standard validation sequence" fenced block (the 6 commands including `npm run db:seed`) with:

```markdown
Standard validation: `npm run validate:app` (sole definition: `app/CLAUDE.md`). Seeding is a provisioning step, not validation — `npm run db:seed` runs when creating or resetting an environment (see `11-Neon-Integration.md`). <!-- 2026-07-14 -->
```

- [ ] **Step 4: `11-Neon-Integration.md`**

Replace its "Standard workflow" fenced block (6 commands) with:

```markdown
Provision a fresh branch: `npm run db:migrate && npm run db:seed`.
Validate changes: `npm run validate:app` (sole definition: `app/CLAUDE.md`). <!-- 2026-07-14 -->
```

- [ ] **Step 5: Verify single-definition, commit**

```bash
grep -rn "db:status && \|db:status$\|db:migrate$" docs/architecture --include="*.md" | grep -v superpowers
```

Expected: no multi-step sequences remain in docs (references only).

```bash
bash scripts/check-context-map.sh
git add docs/architecture/05-Database/10-Database-Agent-Guide.md docs/architecture/05-Database/03-Migrations.md docs/architecture/05-Database/11-Neon-Integration.md
git commit -m "docs(db): validation step lists replaced by references to the sole definition"
```

---

### Task 3: Probe the Neon ground truth

**Files:** none (read-only probe; result feeds Task 4)

**Interfaces:**
- Produces: the answer to "what does `neon env pull` actually write into `DATABASE_URL` — pooled or direct?" recorded in the task notes for Task 4.

- [ ] **Step 1: Probe (requires the user's Neon-linked environment)**

```bash
cd app && neon env pull --dry-run 2>/dev/null || neon env dev 2>/dev/null | grep -E "^DATABASE_URL" | sed 's/:[^@]*@/:***@/'
```

Look at the `DATABASE_URL` hostname: contains `-pooler` → Neon writes the **pooled** URL; no `-pooler` → **direct**.

- [ ] **Step 2: Decision rule**

- **Direct** (matches `.env.example`'s claim): Task 4 keeps the contract exactly as in the spec table and *removes* the "copy the pooled `DATABASE_URL`" wording from `11-Neon-Integration.md` (that wording is then wrong).
- **Pooled**: `.env.example`'s comment "Hostname does NOT include -pooler" is wrong for the Neon-pulled value; Task 4 then rewrites `.env.example` comments to say `DATABASE_URL` as pulled is pooled and must be replaced with the direct URL for the Worker runtime (contract itself is unchanged: direct-for-runtime, pooled-for-tooling).
- **Environment can't run the Neon CLI** (agent session): record "unverified" and take the **Direct** branch — it is what the committed `.env.example`, npm scripts, and `db/CLAUDE.md` already embody — and add `<!-- verify against neon env pull; 2026-07-14 -->` next to the edited table so the user can confirm on their machine.

---

### Task 4: One connection contract, code follows docs

**Files:**
- Modify: `docs/architecture/05-Database/11-Neon-Integration.md` (§Connection String Rules + §Environment Variables)
- Modify: `docs/architecture/05-Database/03-Migrations.md` (§Migration Execution env block)
- Modify: `app/src/db/client.ts`
- Modify: `app/src/db/CLAUDE.md`

- [ ] **Step 1: `11-Neon-Integration.md` — rewrite the contract table**

Replace the §Connection String Rules table + the paragraph under it with (Direct branch; adjust the second sentence per Task 3's outcome):

```markdown
| Use case | Variable | Notes |
| --- | --- | --- |
| Worker runtime (`getDb()`) | `DATABASE_URL` | Direct connection — hostname WITHOUT `-pooler` |
| Migrations / seeds / introspection | `DATABASE_URL_POOLED` | Pooled — hostname WITH `-pooler`; consumed by the dbmate npm scripts and `drizzle.config.ts` |

`DATABASE_URL_UNPOOLED` is **not part of the contract** — no code or script may read it. This table is the sole owner of connection-variable semantics; `app/.env.example` mirrors it. <!-- 2026-07-14 -->
```

In §Environment Variables, delete `DATABASE_URL_UNPOOLED` from the "Neon-pulled keys" list or annotate it `(ignored by this project)`.

- [ ] **Step 2: `03-Migrations.md` — fix the env block**

Replace:

```
DATABASE_URL=<pooled connection string>
DBMATE_MIGRATIONS_DIR=../database/migrations
DBMATE_SCHEMA_FILE=../database/schema.sql
```

with:

```
DATABASE_URL_POOLED=<pooled connection string>   # consumed via --url in the npm scripts
# migrations dir is passed as a script flag (--migrations-dir ../database/migrations);
# DBMATE_* env vars are optional overrides only (see app/.env.example)
```

and change the sentence "Required environment settings:" → "Environment contract (sole owner: `11-Neon-Integration.md` §Connection String Rules):".

- [ ] **Step 3: `app/src/db/client.ts` — drop the un-contracted variable**

Replace:

```typescript
export function getDb() {
  const url = env.postgres.databaseUrlUnpooled ?? env.postgres.databaseUrl;
  neonConfig.fetchConnectionCache = true;
  const client = neon(url);
  return drizzle(client, { schema });
}
```

with:

```typescript
export function getDb() {
  // Contract: DATABASE_URL = direct (runtime); pooled is tooling-only.
  // Sole owner: docs/architecture/05-Database/11-Neon-Integration.md
  const url = env.postgres.databaseUrl;
  neonConfig.fetchConnectionCache = true;
  const client = neon(url);
  return drizzle(client, { schema });
}
```

- [ ] **Step 4: `app/src/db/CLAUDE.md` — add the authority pointer**

Append to the `## Rules` list:

```markdown
- Connection-variable semantics are owned by `docs/architecture/05-Database/11-Neon-Integration.md` §Connection String Rules — never redefine them here or in code comments beyond a pointer.
```

- [ ] **Step 5: Verify + commit**

```bash
grep -rn "UNPOOLED" app/src docs/architecture --include="*.ts" --include="*.md" | grep -v superpowers
```

Expected: only the annotated "(ignored by this project)" mention in 11-Neon (if kept) — no code hits.

```bash
cd app && npx astro check 2>&1 | tail -2 && cd ..
bash scripts/check-context-map.sh
git add app/src/db/client.ts app/src/db/CLAUDE.md docs/architecture/05-Database/11-Neon-Integration.md docs/architecture/05-Database/03-Migrations.md
git commit -m "fix(db): one connection contract — direct for runtime, pooled for tooling, UNPOOLED retired"
```

# Decision Ledger Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the 65 KB monolithic `DECISIONS.md` into a router plus 11 focused domain files under `decisions/`, so a task loads only the decisions bearing on it — with every existing decision preserved byte-for-byte and every existing citation unchanged.

**Architecture:** `DECISIONS.md` keeps only front-matter, the authority note, the Source key, a routing table, and the Deferred list. All 163 decisions move into 11 files by a verified mechanical migration driven by an explicit ID→file map. New decisions append as richer blocks; migrated rows keep their existing table shape. Three gate scripts are extended and one new gate is added.

**Tech Stack:** Markdown, Bash, Python 3 (gate scripts).

## Global Constraints

- **IDs are frozen.** `D01`…`D183` keep their exact spelling. ~180 citations across `docs/**`, `app/src/**/*.ts`, `app/src/**/*.astro`, `CLAUDE.md`, `AGENT.md`, `README.md`, `.github/pull_request_template.md` reference decisions **by ID, never by location**, so the split requires zero citation edits. Never renumber, never reuse, never zero-pad differently than the original.
- **IDs are non-contiguous and nothing is missing.** 163 decisions, max ID `D183`; these 20 numbers were never issued: `18 19 29 38 39 42 43 44 45 46 47 48 49 53 54 55 56 57 58 59`. Verification must compare against the extracted ID set, never `range(1, max)`.
- **`D\d+` collides with darts notation.** `D18` also means *double 18*; `app/src/modules/game/checkout-path.module.ts` alone holds ~40 such tokens. All ID tooling must anchor on position (`^| D18 |`, `^### D18`) and must not scan `app/src/**`.
- **Migrated rows are byte-identical.** No re-wording, no re-formatting, no "improving" a rationale. The 4-column table shape (`# | Source | Decision | Rationale`) is preserved.
- **Append-only.** Decisions are never edited or deleted; a reversal is a new decision with `Supersedes:`.
- **Front-matter is the repo's existing HTML-comment style** (`<!-- status: … -->`), extended with `load-when:` / `depends-on:` / `related:`. `status:` stays the first key so `check-context-map.sh`'s header check keeps working.
- **`docs/superpowers/**` is historical** — status notes only, never rewrites (`docs/CLAUDE.md`).
- `CLAUDE.md` and `AGENT.md` pairs must stay byte-identical (`scripts/check-agent-mirrors.sh`).
- Spec: `docs/superpowers/specs/2026-08-02-decision-ledger-split-design.md`.

## File Structure

| File | IDs | Count |
| ---- | --- | ----- |
| `DECISIONS.md` | none (router) | 0 |
| `decisions/architecture.md` | D01–D17 | 17 |
| `decisions/database.md` | D20–D28, D74, D95, D135–D137 | 14 |
| `decisions/api.md` | D30–D37, D60–D73, D75, D76, D78, D131, D132, D149, D172 | 29 |
| `decisions/game-engine.md` | D40, D111, D112, D114, D119, D122, D125, D138–D146, D150–D154, D177, D178, D180, D181, D183 | 26 |
| `decisions/testing.md` | D99, D101, D104, D148, D166 | 5 |
| `decisions/frontend/architecture.md` | D41, D82–D85, D87, D103, D105, D106, D115, D117, D155, D156, D182 | 14 |
| `decisions/frontend/astro.md` | D79, D80, D92, D97, D116, D121, D123, D124, D127, D128, D170, D171, D173, D179 | 14 |
| `decisions/frontend/alpine.md` | D77, D81, D86, D88–D91, D98, D100, D118, D120 | 11 |
| `decisions/frontend/style.md` | D108, D126, D129, D130, D161, D174–D176 | 8 |
| `decisions/context-system.md` | D50–D52, D93, D94, D96, D102, D107, D109, D110, D113, D133, D134, D147, D157–D160, D162–D165, D167–D169 | 25 |

Total 163. This map is **exhaustive and disjoint** — verified: 163 mapped, 163 unique, no duplicates, no ledger ID unmapped, no mapped ID absent from the ledger.

---

### Task 1: The ID→file map as machine-readable data

The map must exist as data before anything moves, so the migration and its verifier read one source rather than each embedding a copy.

**Files:**
- Create: `scripts/decision-map.txt`

**Interfaces:**
- Produces: `scripts/decision-map.txt` — one line per target file, `path: id id id …`, IDs unpadded. Tasks 2 and 3 both read it.

- [ ] **Step 1: Write the map file**

```
architecture: 01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 16 17
database: 20 21 22 23 24 25 26 27 28 74 95 135 136 137
api: 30 31 32 33 34 35 36 37 60 61 62 63 64 65 66 67 68 69 70 71 72 73 75 76 78 131 132 149 172
game-engine: 40 111 112 114 119 122 125 138 139 140 141 142 143 144 145 146 150 151 152 153 154 177 178 180 181 183
testing: 99 101 104 148 166
frontend/architecture: 41 82 83 84 85 87 103 105 106 115 117 155 156 182
frontend/astro: 79 80 92 97 116 121 123 124 127 128 170 171 173 179
frontend/alpine: 77 81 86 88 89 90 91 98 100 118 120
frontend/style: 108 126 129 130 161 174 175 176
context-system: 50 51 52 93 94 96 102 107 109 110 113 133 134 147 157 158 159 160 162 163 164 165 167 168 169
```

Add a leading comment block explaining: the file is the single source for the split, IDs are unpadded here but keep their original padding in the ledger rows, and any future re-filing edits this map and re-runs the verifier.

- [ ] **Step 2: Verify the map against the live ledger**

Run:

```bash
cd /home/user/dart-analytics
grep -oE "^\| D[0-9]+" DECISIONS.md | grep -oE "[0-9]+" | sed 's/^0*//' | sort -n > /tmp/ledger-ids.txt
grep -v '^#' scripts/decision-map.txt | awk -F': ' '{n=split($2,a," "); for(i=1;i<=n;i++) print a[i]}' \
  | sed 's/^0*//' | sort -n > /tmp/map-ids.txt
echo "ledger: $(wc -l < /tmp/ledger-ids.txt)  mapped: $(wc -l < /tmp/map-ids.txt)  unique: $(sort -u /tmp/map-ids.txt | wc -l)"
echo "dupes:      $(sort /tmp/map-ids.txt | uniq -d | tr '\n' ' ')"
echo "unmapped:   $(comm -23 /tmp/ledger-ids.txt /tmp/map-ids.txt | tr '\n' ' ')"
echo "phantom:    $(comm -13 /tmp/ledger-ids.txt /tmp/map-ids.txt | tr '\n' ' ')"
```

Expected: `ledger: 163  mapped: 163  unique: 163`, and the three lists empty. If any line is non-empty, STOP and report — the map is wrong and migrating would lose or duplicate a decision.

- [ ] **Step 3: Commit**

```bash
git add scripts/decision-map.txt
git commit -m "Add the decision ID→file map that drives the ledger split"
```

---

### Task 2: Migration script and its verifier

**Files:**
- Create: `scripts/split-decisions.sh`
- Create: `scripts/verify-decision-split.sh`

**Interfaces:**
- Consumes: `scripts/decision-map.txt` (Task 1)
- Produces: `scripts/split-decisions.sh` (performs the move), `scripts/verify-decision-split.sh` (proves it lossless against a pre-migration snapshot). Task 3 runs both.

- [ ] **Step 1: Write the migration script**

`scripts/split-decisions.sh` must:

1. Snapshot the pre-migration state to `/tmp/decisions-before.tsv`: for every decision row in `DECISIONS.md`, one line of `normalised_id<TAB>full_row_text`. Normalised ID strips zero-padding; the row text is the **complete original line**, unmodified.
2. Read `scripts/decision-map.txt`.
3. For each target file, create `decisions/<path>.md` containing the front-matter block (Task 3 supplies per-file values — the script takes them from a small case statement or a sidecar), the 4-column table header, then that file's rows **in ascending numeric ID order**, copied verbatim from the snapshot.
4. Never write a row it did not read from the snapshot, and never modify a row's text.

Ordering note: rows must be sorted numerically by ID, not lexically — lexical order puts `D100` before `D20`.

- [ ] **Step 2: Write the verifier**

`scripts/verify-decision-split.sh` compares `/tmp/decisions-before.tsv` against the post-migration tree and **fails on any** of these four classes:

| Class | Check |
| ----- | ----- |
| Missing | an ID in the snapshot absent from `decisions/**` |
| Duplicated | an ID appearing in more than one file, or twice in one file |
| Altered | a row's text differing byte-for-byte from its snapshot text |
| Map drift | an ID in the map absent from the ledger, or a ledger ID absent from the map |

Anchor every ID match on `^\| D[0-9]+ \|`. Scan only `decisions/**` and `DECISIONS.md` — never `app/src/**`, where `D18` means double 18.

Print a one-line summary per class and exit non-zero if any fails.

- [ ] **Step 3: Prove the verifier has teeth**

A verifier that cannot fail is worthless. Before trusting it, run all four negative cases against a scratch copy of the migrated tree (`cp -r` to `/tmp`, never the real tree):

1. Delete one row → expect **Missing** failure.
2. Duplicate one row into a second file → expect **Duplicated** failure.
3. Change one character in one row's rationale → expect **Altered** failure.
4. Add a phantom ID to a scratch copy of the map → expect **Map drift** failure.

Record each command and its failing output in your report. Restore/discard the scratch copies afterwards.

- [ ] **Step 4: Commit**

```bash
git add scripts/split-decisions.sh scripts/verify-decision-split.sh
git commit -m "Add ledger split migration script and its lossless-move verifier"
```

---

### Task 3: Execute the migration

**Files:**
- Create: `decisions/architecture.md`, `decisions/database.md`, `decisions/api.md`, `decisions/game-engine.md`, `decisions/testing.md`, `decisions/context-system.md`, `decisions/frontend/architecture.md`, `decisions/frontend/astro.md`, `decisions/frontend/alpine.md`, `decisions/frontend/style.md`
- Modify: `DECISIONS.md` (reduce to router)

**Interfaces:**
- Consumes: `scripts/decision-map.txt`, `scripts/split-decisions.sh`, `scripts/verify-decision-split.sh`
- Produces: the 10 decision files + the router. Task 4 registers them; Task 5 gates them.

- [ ] **Step 1: Author the front-matter for each of the 10 files**

Every file opens with this shape. `load-when` keywords are what an agent matches its task against, so they must be the words a task actually uses:

```
<!--
status: canonical
scope: decisions/frontend/alpine
read-when: Alpine stores, $persist, session recovery, data components
load-when: Alpine, stores, state, persist, recovery, x-data, x-show
depends-on: decisions/architecture.md, decisions/frontend/architecture.md
related: decisions/frontend/astro.md, decisions/api.md
updated: 2026-08-02
-->
```

Per-file values:

| File | load-when | depends-on |
| ---- | --------- | ---------- |
| `architecture.md` | domain model, activity, session, stage, turn, dart, ruleset, platform | — |
| `database.md` | schema, migration, table, column, constraint, index, view, Neon, seed | `architecture.md` |
| `api.md` | endpoint, contract, envelope, auth, middleware, idempotency, batch, Worker | `architecture.md` |
| `game-engine.md` | engine, GameEngine, ruleset, scoring, checkout, fact log, 501, Score Training | `architecture.md`, `database.md` |
| `testing.md` | test, TDD, Vitest, mock, coverage | `architecture.md` |
| `frontend/architecture.md` | layering, folder structure, suffix, barrel, type import, error mapping, API client | `architecture.md` |
| `frontend/astro.md` | .astro, component, prerender, routing, layout, cn(), props, frontmatter | `frontend/architecture.md` |
| `frontend/alpine.md` | Alpine, stores, state, persist, recovery, x-data, x-show | `architecture.md`, `frontend/architecture.md` |
| `frontend/style.md` | style, CSS, token, Tailwind, primitive, typography, spacing, glass, surface | `frontend/architecture.md` |
| `context-system.md` | docs, context map, CLAUDE.md, skill, gate, check script, knowledge graph, CI | — |

- [ ] **Step 2: Run the migration**

```bash
cd /home/user/dart-analytics
bash scripts/split-decisions.sh
```

- [ ] **Step 3: Verify the move is lossless**

```bash
bash scripts/verify-decision-split.sh
```

Expected: all four classes pass, exit 0. If anything fails, STOP — do not hand-patch the output; fix the map or the script and re-run from a clean tree.

- [ ] **Step 4: Reduce `DECISIONS.md` to a router**

Keep, and nothing else:

1. The existing front-matter, with `updated: 2026-08-02` and `read-when` reworded to describe routing.
2. The authority note — the ledger is context, never authority; canonical docs win.
3. The **Source key** verbatim (`P*n*` = design-conversation prompt range · dates = work sessions) — migrated rows carry `P1–10`-style references that only this key explains.
4. The **routing table**: `| Domain | File | Load when |`, one row per decision file, `load-when` copied from Step 1 so an agent picks files without opening them.
5. The **Deferred (open, not rejected)** list, moved verbatim — cross-domain by nature.
6. A **facts vs decisions** rule: durable facts (schemas, contracts, inventories) belong in `docs/architecture/`; this tree records only choices and their rationale. A statement of what *is* is not a decision.
7. A **how to add a decision** note: append a block to the right domain file, next ID after the current maximum (`D183` at time of writing), never reuse an ID, never edit an existing one — reversals cite `Supersedes:`.
8. An **ID-gap note**: the 20 unissued numbers are numbering artifacts from the original distillation, not lost decisions (see the spec's investigation), so nobody hunts for them again.

Also document the new block format for future decisions:

```markdown
### D184 — Short imperative title
Status: Accepted · Date: 2026-08-02
Decision: …
Reason: …
Consequences: …
Supersedes: D86
```

`DECISIONS.md` must contain **no** `^| D\d+ |` rows after this step.

- [ ] **Step 5: Confirm no location-based reference broke**

```bash
cd /home/user/dart-analytics
git grep -nE "(Frontend|API|Database|Domain model|Context) section of .DECISIONS" -- ':!docs/superpowers' || echo "none"
git grep -ncE "^\| D[0-9]+ \|" DECISIONS.md || echo "router clean: no decision rows"
```

Any location-based reference found outside `docs/superpowers/**` must be re-pointed at the specific file. References **by ID** need no change — confirm that too:

```bash
git grep -ohE "\bD1[0-9][0-9]\b|\bD[0-9][0-9]\b" -- 'docs/**' 'CLAUDE.md' 'AGENT.md' 'README.md' | sort -u | wc -l
```

Compare against the same command at the base commit; the count must be unchanged.

- [ ] **Step 6: Commit**

```bash
git add DECISIONS.md decisions/
git commit -m "Split the decision ledger into 11 domain files; DECISIONS.md becomes a router"
```

---

### Task 4: Update consumers

**Files:**
- Modify: `docs/architecture/00-Context-Map.md`
- Modify: `CLAUDE.md` and `AGENT.md` (root — keep byte-identical)
- Modify: `.claude/skills/context-maintenance/SKILL.md`
- Modify: `.github/pull_request_template.md`
- Modify: `README.md`
- Modify: `docs/CLAUDE.md`

- [ ] **Step 1: Context map**

Three edits:

1. **Context Packs table** — replace the `"Why was X decided?"` row (currently `DECISIONS.md` (repo root); deeper lineage: git history | ~15.2k`) with a row pointing at the router plus "load only the domain files your task needs", and a realistic budget for router + 1–2 domain files.
2. **File Inventory** — replace the single `DECISIONS.md` row with 11 rows (router + 10 files), each with its own `~Nk` estimate.
3. **Version** — bump from `1.7.8`, naming the change and demoting the prior note to the "prior" clause, per the file's existing convention.

- [ ] **Step 2: Root `CLAUDE.md` + `AGENT.md`**

In "Where Everything Lives", change the `Why a decision was made` row to point at `DECISIONS.md` (router) and note that domain files live in `decisions/`. In the Context Maintenance section, note that decisions are append-only and domain-scoped.

Apply the identical edit to both files — `scripts/check-agent-mirrors.sh` requires byte-identical siblings. Run it after editing.

- [ ] **Step 3: `context-maintenance` skill**

Step 3 of the skill currently reads "Record new architectural decisions as one-line entries in `DECISIONS.md`." Rewrite it to: pick the domain file from the router's routing table; append a block in the new format; never edit or delete an existing decision; a reversal is a new decision citing `Supersedes:`; run `scripts/check-decision-ids.sh`.

- [ ] **Step 4: PR template, README, `docs/CLAUDE.md`**

- `.github/pull_request_template.md` — the checklist item about adding a DECISIONS.md entry → "the appropriate `decisions/` domain file".
- `README.md` — repo-orientation reference to the ledger → router + `decisions/`.
- `docs/CLAUDE.md` — add `decisions/**` to its scope line and Task Routing, stating the append-only rule and that `DECISIONS.md` is a router that must stay free of decision rows.

- [ ] **Step 5: Verify the mirrors and links**

```bash
cd /home/user/dart-analytics
bash scripts/check-agent-mirrors.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-map.sh
```

All must pass. `check-context-budget.sh` is expected to FAIL here — Task 5 teaches it about the new paths.

- [ ] **Step 6: Commit**

```bash
git add docs/architecture/00-Context-Map.md CLAUDE.md AGENT.md .claude/skills/context-maintenance/SKILL.md .github/pull_request_template.md README.md docs/CLAUDE.md
git commit -m "Point every ledger consumer at the decisions router"
```

---

### Task 5: Extend the gates and add the ID gate

**Files:**
- Modify: `scripts/check-context-map.sh`
- Modify: `scripts/check-context-budget.sh`
- Modify: `scripts/check-doc-links.sh`
- Create: `scripts/check-decision-ids.sh`

- [ ] **Step 1: `check-context-map.sh`**

Its migration-range scan loops over `CLAUDE.md DECISIONS.md $(git ls-files 'docs/architecture/*.md' 'database/*.md')`. Add `$(git ls-files 'decisions/**/*.md')` so a stale `0001–00NN` claim inside a decision file is caught. Also extend the `status:` front-matter check to cover `decisions/**`.

- [ ] **Step 2: `check-context-budget.sh`**

`resolve_pack_md()` special-cases `ref == "DECISIONS.md"`. Extend it so a ref beginning `decisions/` resolves to `ROOT / ref`. The per-file `~Nk` estimates added in Task 4 must then reconcile; if the script reports drift, update the estimates in the context map to the values it reports.

- [ ] **Step 3: `check-doc-links.sh`**

It currently excludes `DECISIONS.md` from the scan set (D133, "DECISIONS history noise"). Add `decisions/**/*.md` to the scan set — the split files are small and their links should resolve. Keep the router's own exclusion if its Source-key prose still trips the scanner; say which you did and why in your report.

- [ ] **Step 4: Write `scripts/check-decision-ids.sh`**

Four checks, all anchored on position, scanning only `decisions/**` and `DECISIONS.md`:

1. Every `D\d+` (row `^| D… |` or block `^### D…`) across `decisions/**` is unique — no ID in two files, none twice in one file.
2. No ID from the recorded baseline set has disappeared. Embed the baseline as the 163 IDs, or derive it from `scripts/decision-map.txt` — state which and why.
3. Every `Supersedes: D\d+` target exists somewhere in `decisions/**`.
4. `DECISIONS.md` contains no `^| D\d+ |` row and no `^### D\d+` heading — it is a router.

Follow the house style of the existing `check-*.sh` scripts: `set -euo pipefail`, `cd` to repo root, a header comment explaining the rule and its blind spots, `OK:`/`FAIL:` output, non-zero exit on failure.

**Document the dart-notation blind spot in the header**: `D18` is also darts notation for double 18, which is why the scan is position-anchored and excludes `app/src/**`.

- [ ] **Step 5: Prove the new gate has teeth**

Against scratch copies only, confirm each check fails when violated:

1. Copy one decision row into a second file → check 1 fails.
2. Delete a row → check 2 fails.
3. Add `Supersedes: D999` → check 3 fails.
4. Paste a decision row into `DECISIONS.md` → check 4 fails.

Then confirm a clean tree passes. Record every command and output.

- [ ] **Step 6: Run the full gate set**

```bash
cd /home/user/dart-analytics
for s in check-context-map check-doc-links check-context-budget check-decision-ids check-agent-mirrors; do
  echo "--- $s"; bash "scripts/$s.sh" || echo "FAILED: $s"
done
cd app && npx vitest run 2>&1 | tail -4
```

The five gates must pass. The test suite is untouched by a docs change — expect the current baseline of **1417 passing**; any deviation means something unrelated broke.

- [ ] **Step 7: Commit**

```bash
git add scripts/
git commit -m "Extend context gates for decisions/ and add check-decision-ids.sh"
```

---

### Task 6: Record the decision and close out

- [ ] **Step 1: Append the decision, in the new format, to its own domain file**

This restructure is itself an architectural decision, and `decisions/context-system.md` is where it belongs — making it the first entry written in the new block format:

```markdown
### D184 — The decision ledger is a router plus domain files, not one document
Status: Accepted · Date: 2026-08-02
Decision: `DECISIONS.md` holds only front-matter, the authority note, the Source key, a routing table, the Deferred list, and the rules for adding a decision. All decisions live in `decisions/**`, one file per ownership domain, each carrying `load-when` / `depends-on` / `related` front-matter.
Reason: At 163 decisions / 65 KB the single file cost every task the entire project history; a frontend task loaded 27 API and 14 database decisions it never read.
Consequences: Decision IDs stay frozen (`D01`–`D183`) because ~180 citations reference them by ID, not location, so the split required no citation edits. Decisions from D184 on use a block format with Reason/Consequences; the 163 migrated rows keep their original terse table form permanently, since back-filling rationale nobody recorded would mean inventing it. `scripts/check-decision-ids.sh` enforces uniqueness, no-disappearance, `Supersedes:` resolution, and a row-free router.
```

Verify the ID is genuinely next: `bash scripts/check-decision-ids.sh` plus a check that `D184` is unused.

- [ ] **Step 2: Status note on the spec**

Append a status note to `docs/superpowers/specs/2026-08-02-decision-ledger-split-design.md` recording that it was implemented on 2026-08-02 and the final file/ID counts. Append only — that tree is historical.

- [ ] **Step 3: Final verification**

```bash
cd /home/user/dart-analytics
bash scripts/verify-decision-split.sh
for s in check-context-map check-doc-links check-context-budget check-decision-ids check-agent-mirrors; do bash "scripts/$s.sh" || echo "FAILED: $s"; done
wc -c DECISIONS.md
find decisions -name '*.md' | wc -l
grep -c '^| D' DECISIONS.md || echo "router has no decision rows (correct)"
```

Expected: verifier and all five gates pass; `DECISIONS.md` is a few KB rather than 65 KB; `find` reports 10 files; the router holds no decision rows.

- [ ] **Step 4: Context maintenance**

Invoke the `context-maintenance` skill for the remaining gate items it owns (mirror sync, graph refresh, branch/PR check, self-learning gate). Note: the `graphify` CLI is absent in this environment, so the knowledge graph will not refresh — disclose that in `DECISIONS.md`'s deferred list alongside the existing per-branch entries, matching their wording.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Record D184 and close out the ledger split"
```

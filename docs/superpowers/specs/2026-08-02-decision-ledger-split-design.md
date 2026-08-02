# Decision Ledger Split — Design

> status: canonical (until superseded)
> scope: `DECISIONS.md` → `decisions/` indexed knowledge base
> updated: 2026-08-02

---

## Problem

`DECISIONS.md` is one file: 163 decisions, 205 lines, **65 KB** (~15.2k tokens per the
context map's own estimate). Any task that needs to know "why was X decided?" pays
for the entire project history — a frontend task loads 27 API decisions and 14
database decisions it will never read. The context map already routes every other
doc type by task; the decision ledger is the last monolith.

## Goal

Turn the ledger into a router plus focused domain files, so a task loads only the
decisions bearing on it. Preserve every existing decision byte-for-byte and every
existing citation.

## Non-goals

- **No renumbering.** IDs stay `D01`…`D183` exactly as written.
- **No retrofitting.** Existing terse rows are not rewritten into a richer format.
- **No `knowledge/` tree.** Facts already have a canonical home (below).
- **No new decisions.** This is a structural move; it does not revisit any decision.

---

## Constraints discovered in the codebase

These shaped the design and must not be violated.

### IDs are cited ~180 times, by ID and never by location

`git grep` finds `D01`–`D183` referenced across `docs/architecture/**`, `docs/game-rules/**`,
`docs/superpowers/**`, `app/src/**/*.ts`, `app/src/**/*.astro`, `CLAUDE.md`, `AGENT.md`,
`README.md`, `.github/pull_request_template.md`, and the gate scripts.

**Therefore:** IDs are frozen, globally unique, and never reused. A decision's *file*
may change; its *ID* may not. This is what lets the split require **zero** citation
updates. (It also rules out the researched `D-001` reformat, which would break all
~180 references for cosmetic gain.)

### IDs are not contiguous — and nothing is missing

163 decisions but the maximum ID is `D183`. Exactly 20 numbers were never issued:

```
18 19 29 38 39 42 43 44 45 46 47 48 49 53 54 55 56 57 58 59
```

**These are numbering artifacts, not lost decisions.** Established by investigation
(2026-08-02), so nobody repeats it:

1. The gap set in the **first** revision of `DECISIONS.md` (`3cc3423`, 2026-07-14) is
   identical to today's within range 1–94 — nothing was deleted after creation.
2. Every commit that ever touched `DECISIONS.md` was searched for these IDs, in table
   form and in any form: zero hits. They never existed in the ledger.
3. The ledger was distilled from `architecture/000_master_context.md` and
   `original-conversation/PROMPT_*.md` (all removed in the 2026-07-14 restructure,
   recoverable from git). The master context at its last living commit
   (`7827765`) is 451 lines of topical prose with **no `D\d+` identifiers at all** —
   the IDs were invented during distillation, not carried from a numbered source.
   There is no upstream decision to recover.
4. No document, script, or source file cites any of the 20.

**Consequences for this work:**

- Verification must compare against the actual extracted ID set, never
  `range(1, max)` — a contiguity assumption reports 20 phantom losses.
- Single digits are zero-padded (`D01`…`D09`); `D10` upward are not. Normalise before
  comparing; migrated rows keep their original spelling.
- The full pre-ledger design history survives only in git (`git log --all --diff-filter=D`
  finds the deleted `original-conversation/` tree and master context). It is the only
  record of *why* the pre-`D94` decisions were made — do not treat that history as
  disposable.

### `D\d+` collides with dart notation

`D18` is both a decision-ID pattern and standard darts notation for *double 18*.
`app/src/modules/game/checkout-path.module.ts` contains ~40 such tokens (`D20`, `D16`,
`D8`, …), and `app/src/**/*.ts` uses the same notation throughout the engines.

**Therefore** `check-decision-ids.sh` and the migration verifier must anchor on
position — `^\| D18 \|` for a table row, `^### D18` for a block heading — and never a
bare `\bD18\b`. An unanchored search reports the checkout table as dozens of duplicate
decision IDs. Any future tooling over decision IDs inherits this constraint.

### Three gate scripts hardcode the single file

| Script | Current coupling |
| ------ | ---------------- |
| `scripts/check-context-map.sh` | Migration-range scan loops over `CLAUDE.md DECISIONS.md docs/architecture/*.md database/*.md` |
| `scripts/check-context-budget.sh` | `resolve_pack_md()` special-cases `ref == "DECISIONS.md"` |
| `scripts/check-doc-links.sh` | Deliberately **excludes** `DECISIONS.md` from the scan set (D133, "DECISIONS history noise") |

### The existing front-matter convention is HTML comments, not YAML

`docs/architecture/**` uses `<!-- status: / scope: / read-when: / updated: -->`, and
`check-context-map.sh` enforces a `status:` header there. The researched YAML `---`
form would introduce a second convention and require the gate to accept both.

### Facts already have a home

The research proposes a `knowledge/` tree to separate durable facts from decisions.
`docs/architecture/` **is** that layer, and the context map's authority order already
ranks it above the ledger ("`DECISIONS.md` is context, never authority"). Adding
`knowledge/` would create a third competing home for facts. Instead this design states
the boundary as a rule in the router.

---

## Structure

```
DECISIONS.md                      router + Deferred list only
decisions/
├── architecture.md               domain model, platform framing
├── database.md                   schema, migrations, Neon, ID strategy
├── api.md                        contracts, envelopes, auth, middleware
├── context-system.md             docs, context map, gates, skills, graph
├── game-engine.md                GameEngine contract, per-game engine decisions
├── testing.md                    TDD policy, test strategy, mocks
└── frontend/
    ├── architecture.md           layering, folder structure, suffixes, type barrels, error mapping
    ├── astro.md                  .astro authoring, prerender/routing, class composition, props
    ├── alpine.md                 factory, stores, $persist, recovery, data components
    └── style.md                  style guide, tokens, CSS primitives, Tailwind v4
```

Eleven files. Rationale for the shape:

- **Flat where decisions cluster; nested only for Frontend.** Frontend is the largest
  group (52 of 163) and the only one with genuinely distinct sub-domains. The
  researched ~25-file tree would leave most files empty or near-empty and force a
  typical frontend task to open 3–4 files instead of 1.
- **`frontend/architecture.md` is the necessary fourth frontend file.** Layering,
  suffix conventions, type-barrel raising, file-location rules, error mapping and the
  API client are none of Astro/Alpine/style; without this file they land in whichever
  of the three is least wrong.
- **`game-engine.md` and `testing.md` start small but non-empty.** Engine decisions
  (the `GameEngine` contract, client-side-engine, per-game engine work) currently sit
  under Frontend only because engines run in the browser; test-policy decisions sit
  there for the same incidental reason. Both get their proper home now so the next
  such decision does not default into `frontend/`.

### Two boundary calls, stated because they are the ones that get mis-filed

- **Prettier / `{/* */}` template comments (D123) → `astro.md`, not `style.md`.** It
  governs markup authoring, not visual design. `style.md` is purely the visual
  contract: tokens, primitives, Tailwind syntax.
- **Engine decisions leave Frontend.** The `GameEngine` contract group, the
  client-side-engine decision, and the per-game engine decisions move to
  `game-engine.md`.

---

## File anatomy

### Front-matter (every decision file)

Extends the existing HTML-comment convention with three routing keys:

```
<!--
status: canonical
scope: decisions/frontend/alpine
read-when: Alpine stores, $persist, session recovery, data components
load-when: Alpine, stores, state, persist, recovery, x-data
depends-on: decisions/architecture.md, decisions/frontend/architecture.md
related: decisions/frontend/astro.md, decisions/api.md
updated: 2026-08-02
-->
```

- `load-when` — trigger keywords an agent matches its task against.
- `depends-on` — files whose decisions this file's decisions assume. Load these too.
- `related` — adjacent files worth loading when the task spans domains. Not implied.

`status:` stays first so `check-context-map.sh`'s existing header check keeps working
unchanged.

### Migrated decisions — verbatim table

Each file carries the same 4-column table as today, with its rows copied
byte-for-byte:

```markdown
| # | Source | Decision | Rationale |
| - | ------ | -------- | --------- |
| D81 | 2026-07-14 | Alpine `app.factory` entry + `register*(Alpine)`; no `x-init`; … | … |
```

The `Source` column is preserved because migrated rows carry `P1–10`-style prompt
references that only the router's Source key explains.

### New decisions — block format

Decisions recorded from 2026-08-02 onward append **below** the table as blocks:

```markdown
### D184 — Alpine stores are the only home for `$persist`
Status: Accepted · Date: 2026-08-02
Decision: …
Reason: …
Consequences: …
Supersedes: D86
```

`Supersedes:` is optional; `Consequences:` is expected. Both forms coexist
**permanently** — there is no migration deadline and no plan to convert the table.
Back-filling `Consequences`/`Reason` for 163 historical rows would mean inventing
rationale nobody recorded, which is worse than its absence.

### Append-only

Decisions are never edited or deleted. A reversal is a **new** decision citing
`Supersedes:`. This mirrors the repo's existing treatment of `docs/superpowers/**`
("status notes only, never rewrites") and the Hard Invariant that completed history
is immutable.

---

## Router — `DECISIONS.md`

Retains, and nothing else:

1. Front-matter (`status: canonical`, `read-when`, `updated`).
2. The authority note — the ledger is context, never authority; canonical docs win.
3. The **Source key** (`P*n*` = design-conversation prompt range · dates = work
   sessions), required to read migrated rows.
4. The **routing table** — domain, file, and `load-when` triggers, so an agent selects
   files without opening them.
5. The **Deferred (open, not rejected)** list — cross-domain by nature; splitting it
   would scatter one paragraph across eleven files.
6. The **facts/decisions rule**: durable facts (schemas, contracts, file inventories)
   belong in `docs/architecture/`; this tree records only choices and their rationale.
   A statement of what *is* is not a decision.

Router routing table shape:

| Domain | File | Load when |
| ------ | ---- | --------- |
| Frontend — Alpine | `decisions/frontend/alpine.md` | stores, `$persist`, recovery, `x-data` |
| Frontend — Astro | `decisions/frontend/astro.md` | `.astro`, prerender, routing, `cn()` |
| … | | |

---

## Gates

### Modified

- **`scripts/check-context-map.sh`** — add `decisions/**/*.md` to the migration-range
  scan loop, so a stale `0001–00NN` claim in a decision file is caught. Also enforce
  the `status:` front-matter header on the new files.
- **`scripts/check-context-budget.sh`** — `resolve_pack_md()` must resolve
  `decisions/**` paths; per-file `~Nk` estimates replace the single `~15.2k` row.
- **`scripts/check-doc-links.sh`** — **include** `decisions/**/*.md` in the scan set.
  D133 excluded the monolith to avoid history noise; the split files are small and
  their links should resolve. This narrows a real blind spot.

### New — `scripts/check-decision-ids.sh`

Makes the append-only and unique-ID rules enforceable rather than aspirational:

1. Every `D\d+` heading/row ID across `decisions/**` is **unique** — no ID in two files.
2. No ID from the pre-split set has **disappeared**.
3. Every `Supersedes: D\d+` target **exists**.
4. `DECISIONS.md` itself contains **no** decision rows (it is a router; a decision
   added there would be invisible to the domain files).

All four checks anchor on position (`^| D18 |`, `^### D18`) — never a bare `\bD18\b`,
per the dart-notation collision above. The script's scan set is `decisions/**` plus
`DECISIONS.md`; it must not scan `app/src/**`.

**Where it runs:** with the three *context-integrity* gates
(`check-context-map.sh`, `check-doc-links.sh`, `check-context-budget.sh`), which the
`context-maintenance` skill invokes — **not** in `.husky/pre-commit`. Pre-commit runs
the 11 *structural* gates (`scripts/` holds 14 in total); adding a docs-shaped gate
there would slow every commit for a check that only matters when decisions change.

---

## Migration integrity — the actual risk

The one-time move of 163 rows into 11 files is where this can go wrong, and a dropped
row is invisible afterward. Recent history in this repo is instructive: a hand-checked
data table shipped with 31 of 162 entries wrong because spot-check tests asserted the
same wrong values. The same failure mode applies here.

Therefore the migration is **mechanical and verified**, not manual:

1. **Snapshot** the pre-migration ID set and each row's exact text from `DECISIONS.md`
   at the base commit.
2. **Author an explicit ID→file map** covering all 163 IDs. The five sections that map
   1:1 (Domain model → `architecture.md`, Database → `database.md`, API → `api.md`,
   Context & documentation → `context-system.md`) need only a section rule; the
   Frontend 52 and the engine/testing extractions need per-ID assignment.
3. **Move rows by script**, driven by that map — never by hand-editing 11 files.
4. **Verify**, and fail the migration on any of:
   - an ID present pre-migration and absent post-migration;
   - an ID appearing in more than one file;
   - any row's text differing byte-for-byte from its original;
   - any ID in the map that does not exist, or any existing ID missing from the map.
5. **Confirm no location-based references break.** `git grep` for references to the
   ledger *by section* (e.g. "the Frontend section of `DECISIONS.md`") and re-point
   them at the specific file. References by ID need no change.
6. **Verify the ~180 ID citations still resolve** — they cite IDs, not paths, so this
   should be a no-op; confirm rather than assume.

The verification script is the deliverable that matters most in this work. It should
remain in the repo (or be folded into `check-decision-ids.sh`) so a future split or
merge of decision files can be re-verified the same way.

---

## Consumers to update

| File | Change |
| ---- | ------ |
| `docs/architecture/00-Context-Map.md` | Replace the single `DECISIONS.md` inventory row and the `"Why was X decided?"` pack row with the router plus 11 files and their budgets; bump version |
| `CLAUDE.md` + `AGENT.md` (root) | "Why a decision was made" row → router; note that decisions are append-only and domain-scoped. Both files must stay byte-identical (`check-agent-mirrors.sh`) |
| `.claude/skills/context-maintenance/SKILL.md` | Step 3 currently says "one-line entries in `DECISIONS.md`" → record in the right domain file, block format, append-only |
| `.github/pull_request_template.md` | Decision-entry checklist item → domain file |
| `README.md` | Repo-orientation reference to the ledger |
| `docs/CLAUDE.md` | Add `decisions/**` to its scope/routing rules |

`docs/superpowers/**` references are **historical** and get status notes only if
touched at all — never rewrites (`docs/CLAUDE.md`).

---

## Verification

- `bash scripts/check-context-map.sh && bash scripts/check-doc-links.sh && bash scripts/check-context-budget.sh && bash scripts/check-decision-ids.sh && bash scripts/check-agent-mirrors.sh`
- The migration verification script passes with zero discrepancies across all four
  failure classes (missing ID, duplicated ID, altered row text, map/actual mismatch).
- `cd app && npm test` — unaffected (docs-only change), expect the current baseline
  of 1417 passing.
- Citation integrity: the set of distinct `D\d+` IDs referenced outside `decisions/**`
  is identical before and after, and every referenced ID resolves to exactly one file.

## Success criteria

A frontend Alpine task loads `DECISIONS.md` (small) + `decisions/frontend/alpine.md` +
its `depends-on` files, instead of 65 KB of full project history. Every one of the 163
existing decisions is still findable by its unchanged ID, and no existing citation
anywhere in the repo needed editing.

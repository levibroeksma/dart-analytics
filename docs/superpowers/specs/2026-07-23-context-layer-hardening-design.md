# Design — Context-Layer Hardening (linking, token budgets, self-learning)

> Status: proposed design (point-in-time task spec; non-canonical).
> Date: 2026-07-23.
> Scope: documentation / context-system layer only. **No application code changes.**
> Base: current `main` (`3c26668`, includes the #35 hardening + D131/D132).

---

## 1. Background & Motivation

A post-merge audit of `main` found the Score Training hardening (#35) correct and complete —
219 tests pass, 0 type errors, all 5 context check scripts pass, and CLAUDE.md ↔ AGENT.md are
fully in sync (6 byte-identical pairs). The remaining opportunities are entirely in the
**docs / context layer**, and map directly to the user's goals: reduce tokens, avoid loading
unnecessary files, and harden the self-learning / improving mechanisms.

### Findings addressed

| ID | Kind | Finding |
| -- | ---- | ------- |
| L1 | Stale ref | `docs/architecture/07-Frontend/03-Alpine-Patterns.md:105` names `modules/ui/timer.module.ts` / "the `Timer` module" — the real file/class is `modules/ui/segment-timer.module.ts` / `SegmentTimer`. |
| L2 | Stale ref | `docs/architecture/06-API/03-Shared-Conventions.md:128` lists `repositories/types.ts` and `routes/types.ts` as area-barrel examples; `repositories/` has only `interfaces.ts`, and the routes barrel is `pages/api/types.ts` (`@routes/types`). |
| T1 | Token drift | The Context Map's own budget estimates are ~2× understated: it rates `00-Context-Map` `~1.5k` (real ~3.5k), `DECISIONS.md` `~2k` (real ~8.5k), `04-Endpoint-Contracts` `~2.9k` (real ~5.1k). The `~Budget` column that drives "load exactly the pack" decisions is unreliable. |
| T2 | Redundancy | Root `CLAUDE.md` (always-loaded, ~1.5k tok) "Forbidden Actions" restates 5 "Hard Invariants" (modify migrations, store stats in tables, template FKs, DB-generated ids, regenerate docs). |
| SL | Un-mechanized rule | L1/L2 (stale refs) and T1 (budget drift) both slipped past every existing check. The project's precedent (D105/D110/D127) is to mechanize discipline-only rules. |

### Decisions taken during brainstorming

1. **Mechanization depth:** mechanize the durable guards — fix L1/L2 + recalibrate budgets + dedup root `CLAUDE.md`, **and** add `check-doc-links.sh` + `check-context-budget.sh`, wired into the Context-Maintenance gate and CI.
2. **Budget guard behavior:** guard + fail with **human-authored** numbers — the script computes a chars/4 estimate, compares to the map's claimed value, and fails (printing the computed numbers) when drift exceeds ~20%. It never rewrites the doc.
3. **§4 dedup:** proceed — each rule is stated once (in Hard Invariants); Forbidden Actions keeps only its 3 genuinely-additional prohibitions plus a pointer.
4. **§3 pack budgets:** guard pack `~Budget` best-effort as the sum of the `.md` files each pack lists (wider tolerance; non-file entries approximated), in addition to the strict per-file guard.

---

## 2. Scope

**In:** L1, L2 (stale-ref fixes); T1 (budget recalibration) + `check-context-budget.sh`;
T2 (root `CLAUDE.md` dedup); `check-doc-links.sh`; wiring both scripts into the
Context-Maintenance gate + CI; decision record D133.

**Out:** application code (none); splitting `DECISIONS.md` (T3 deeper — deferred; the budget
guard merely tells the truth about its size); any change to the historical `docs/superpowers/`
tree; a token *tokenizer* dependency (chars/4 heuristic is sufficient and dependency-free).

---

## 3. Workstreams

### §1 — Stale-reference fixes (L1, L2)

Targeted doc edits (the root-`CLAUDE.md` invariant explicitly allows "validate and fix docs
with targeted edits — never regenerate them").

- **L1** — in `07-Frontend/03-Alpine-Patterns.md`, change `modules/ui/timer.module.ts` → `modules/ui/segment-timer.module.ts` and "the `Timer` module" → "the `SegmentTimer` module". Verify the state-field names on the same line (`timerRemainingMs` / `timerStartedAt`) against `app/src/stores/game.store.ts`; correct them only if they too have drifted (report either way).
- **L2** — in `06-API/03-Shared-Conventions.md`, change the area-barrel example list from `services/types.ts`, `repositories/types.ts`, `routes/types.ts`, `lib/types.ts` to `services/types.ts`, `repositories/interfaces.ts`, `pages/api/types.ts` (`@routes/types`), `lib/types.ts`. Keep the surrounding prose about the raising rule unchanged.

Both are caught by `check-doc-links.sh` (§2) from now on.

### §2 — `scripts/check-doc-links.sh` (mechanizes the L-class)

A new checker (bash wrapper invoking an embedded script — match the style of the existing
`scripts/check-*.sh`). Validates references across the **canonical doc set** and exits non-zero
listing every unresolved reference.

**Canonical scope (scanned):** `docs/architecture/**/*.md`, the six `CLAUDE.md`/`AGENT.md`
pairs, `README.md`.
**Excluded:** `docs/superpowers/**` (historical), `.claude/`, `.cursor/`, `.superpowers/`,
`node_modules/`, `graphify-out/`, and `DECISIONS.md`'s backtick refs (the ledger legitimately
names deleted files — its markdown links are still checked).

**Checks:**
1. Every markdown link `[text](target)` whose target is a local path resolves (strip `#anchor`/`?query`; skip `http(s)://`, `mailto:`).
2. Every **path-like** backtick reference (contains `/`, ends in `.md|.sh|.sql|.ts|.astro|.css`) resolves against the base + alias set below.

**Resolution bases (a ref resolves if any candidate exists):** the file's own directory;
`docs/architecture/`; `docs/architecture/05-Database/` (for `06-Spec/*` refs); `database/`;
`app/`; `app/src/`; repo root; plus **alias expansion**: `@client`→`app/src/lib/client`,
`@server`→`app/src/lib/server`, `@lib`→`app/src/lib`, `@utils`→`app/src/lib/utils`,
`@auth`→`app/src/lib/auth`, `@db`→`app/src/db`, `@services`→`app/src/services`,
`@repositories`→`app/src/repositories`, `@routes`→`app/src/pages/api`,
`@components`→`app/src/components`, `@layouts`→`app/src/layouts`, `@icons`→`app/src/icons`.

**Skips (low-noise rules):** bare filenames without `/` (prose identifiers like `` `Button.astro` ``);
refs containing `*`, `…`, `<`, `>`, `|`, whitespace, or the placeholder token `NN`.

**Acceptance:** on current `main` **after** the §1 fixes, the script prints OK and exits 0.
A negative test (temporarily reintroduce the L1 ref) makes it exit non-zero naming that ref.

### §3 — Budget recalibration (T1) + `scripts/check-context-budget.sh`

**Recalibrate:** update `00-Context-Map.md` so every File-Inventory `~tokens` value and every
Context-Pack `~Budget` value reflects the real chars/4 estimate (e.g. `00-Context-Map` `~1.5k`→`~3.5k`,
`DECISIONS.md` `~2k`→`~8.5k`, `04-Endpoint-Contracts` `~2.9k`→`~5.1k`). The map's self-describing
header note ("~1.5k") is corrected too.

**Guard — `scripts/check-context-budget.sh`:**
- **Per-file (strict):** parse each File-Inventory row that carries a `` `path` `` and a `~Nk`/`~N.Nk` value; compute chars/4 for that file; **fail** (printing `path claimed=X computed=Y`) when `|claimed − computed| / computed > 0.20`.
- **Per-pack (best-effort):** for each Context-Pack row, sum the chars/4 of the `.md` files it lists (resolving abbreviated paths as in §2; non-`.md` entries such as `seeds` or `§"…"` section refs are skipped and the row is flagged `approx`); fail when the claimed `~Budget` drifts > ~30% from that sum. The wider tolerance and `approx` flag acknowledge that packs mix files, seeds, and section refs.
- Numbers are **never rewritten** by the script (decision 2). Exit non-zero on any breach.

**Acceptance:** passes on `main` after recalibration; fails (naming the row) if a guarded number
is reverted to a stale value.

### §4 — Dedup root `CLAUDE.md` (T2)

"Forbidden Actions" currently duplicates these Hard Invariants: modify applied migrations;
store derivable statistics in tables; add template FKs to runtime; use DB-generated ids;
regenerate architecture docs. Resolution — **each rule stated exactly once:**
- Keep "Hard Invariants" as the canonical positive-invariant list (unchanged).
- Trim "Forbidden Actions" to the three prohibitions **not** already invariants — *Expose raw
  database tables through the API*, *Generic EAV / polymorphic FK patterns for gameplay*,
  *Force-push to main/master; commit secrets* — plus a single lead line: *"(These are the
  standalone prohibitions; the Hard Invariants above are equally binding.)"*
- The "Skip documentation/context updates…" item is already covered by the Context-Maintenance
  section and is dropped from Forbidden.

Net: ~6 duplicated lines removed from the always-loaded router; no rule loses its single
canonical statement. Mirror the change to root `AGENT.md`.

### §5 — Wiring + decision record

- **Context-Maintenance gate:** root `CLAUDE.md` step 5 lists the check scripts to run — extend from 5 to 7 (add `check-doc-links.sh`, `check-context-budget.sh`). Mirror to root `AGENT.md`.
- **CI:** add two steps to `.github/workflows/checks.yml` (`run: bash scripts/check-doc-links.sh` and `run: bash scripts/check-context-budget.sh`), matching the existing step style.
- **`00-Context-Map.md`:** bump version/date; note the two new guards under the Maintenance Protocol.
- **`DECISIONS.md` D133:** record the linking + budget-drift mechanization (full text under "New Decision Ledger Entry" below).

---

## 4. New Decision Ledger Entry

- **D133** — Context-integrity guards mechanized: `scripts/check-doc-links.sh` validates every
  markdown link + path-like backtick reference across the canonical doc set (alias/base-aware,
  bare-identifier-skipping, `DECISIONS.md` history-refs and `docs/superpowers/` excluded), and
  `scripts/check-context-budget.sh` fails when the Context Map's per-file `~tokens` (strict) or
  per-pack `~Budget` (best-effort sum) drift >20%/>30% from a chars/4 estimate. Both added to
  Context-Maintenance step 5 and `checks.yml`. Same audit corrected two stale references
  (Alpine-Patterns `Timer`→`SegmentTimer`, Shared-Conventions barrel examples) and de-duplicated
  the always-loaded root `CLAUDE.md` (Forbidden Actions no longer restates Hard Invariants).
  Rationale: linking staleness and budget drift both slipped past every existing check — mechanize
  them per the D105/D110/D127 precedent, and stop the always-loaded router paying for redundancy.

---

## 5. Files Touched

**Create:** `scripts/check-doc-links.sh`, `scripts/check-context-budget.sh`.
**Modify:** `docs/architecture/07-Frontend/03-Alpine-Patterns.md` (L1),
`docs/architecture/06-API/03-Shared-Conventions.md` (L2),
`docs/architecture/00-Context-Map.md` (budgets + maintenance note + version/date),
`CLAUDE.md` + `AGENT.md` (dedup + step-5 wiring; kept byte-identical),
`.github/workflows/checks.yml` (two CI steps), `DECISIONS.md` (D133).

---

## 6. Testing / Verification

- Both new scripts are exercised two ways: **positive** (pass on `main` after the fixes) and
  **negative** (temporarily reintroduce a stale ref / stale budget → the script exits non-zero
  naming it, then revert).
- Full Context-Maintenance gate: all **7** check scripts pass; `check-agent-mirrors.sh` confirms
  the CLAUDE/AGENT edits stayed identical.
- No app code changes, so `npm test` / `astro check` are unaffected (run once to confirm still green).

---

## 7. Non-Goals / Deferred

- Splitting or trimming `DECISIONS.md` (8.5k and growing) — the budget guard surfaces its weight;
  a split is a separate decision.
- Auto-generating the budget numbers (rejected in favor of human-authored + guard).
- Any change to application source, tests, or the frozen API/DB contracts.
- Reducing the CLAUDE.md ↔ AGENT.md on-disk duplication (necessary for dual-tool support; already
  guarded by `check-agent-mirrors.sh`).

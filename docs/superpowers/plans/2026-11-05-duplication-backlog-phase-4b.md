# Duplication Backlog Phase 4b Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the CSS, `.astro` and test-helper clone groups (10 of 17 baseline rows) without changing rendered output or test behaviour.

**Architecture:** Each clone group is folded into one shared unit (CSS custom property / shared component / shared test helper) and the copies are migrated to it. Behaviour is pinned by before/after comparison: computed CSS, built HTML, test counts. The ratchet (`scripts/check-dupes.sh`) proves the groups are gone.

**Tech Stack:** Astro, Tailwind v4 (`global.css`), Alpine.js, Vitest, fallow dupes.

**Spec:** `docs/superpowers/plans/2026-11-05-duplication-backlog-phase-4a.md` (prior phase, same rules); issue #1183 (`global.css`); decisions D513 (rule of three), D524 (design sync).

## Global Constraints

- No visual change. Rendered markup, class strings and computed CSS stay identical (D524: no design sync needed, owner already chose skip for no-visual-change phases; ask again before the PR anyway).
- No `//` or `/* */` comments inside function bodies in `app/src`.
- Never `prettier --write` docs; run `npm run format` in `app/` before the PR.
- Decisions are append-only; next id from `scripts/next-decision-id.sh` (expected D526).
- Exported types go in `types.ts`. New `.astro` components are registered in `docs/architecture/07-Frontend/08-Component-Inventory.md` and `docs/architecture/00-File-Inventory.md`.
- Pre-commit coverage gate needs a test edit for every runtime `.ts` source edit (not for `.astro`/`.css`). Never `--no-verify`.
- `scripts/dupes-baseline.txt` may only be lowered with `bash scripts/check-dupes.sh --update`.
- Out of scope (Phase 4c): engine groups (`bobs27`/`singles-training`, four training exercise engines, `switching-chain`/`target-scoring`), `validateBatch` (#1184), the `statistics.repository.ts` self-clone (1078-1086 vs 2189-2197), the `respond()` route helper.
- Incidental findings become `discovered-work` issues, never fixed here.

## Review Focus

- Alpine passthrough: `{...props}` and attributes (`x-show`, `x-cloak`, `:class`, `@click`) must reach the same root element in every migrated component. Test: built-HTML diff on pages rendering each component.
- Props that differ per copy (`Inning`/`Round` label, `overline`, target-label order, tile lists, bottom-row grid `cols-2`/`cols-3`) must not leak between games. Test: HTML diff covers every game page.
- Reduced-motion media block on the `deck-*` utilities must survive extraction. Test: computed-CSS comparison of built `dist` CSS (all four deck utilities keep the `prefers-reduced-motion` rule).
- Test-helper key order: `dartNumber` first, then the rest of each dart (snapshots/`toEqual` are order-insensitive but replay JSON fixtures may not be). Test: suites using the helpers pass unchanged with identical test counts.
- Integration tests need `DATABASE_URL`; an `itest` migration must still load without it throwing in the unit run (they are excluded from `npm test`). Test: `npx vitest run --config` for itests is not runnable here; verify by `astro check` types plus import resolution.

## Baseline / Expected End State

17 rows → 7 rows. Rows removed: `global.css`, six `.astro` pairs, `replay-games|replay-step-games`, `replay-step-games`, `card-tags|template-difficulty-axis`. Remaining: engine groups (6 rows), `statistics.repository.ts`, `validator` pair.

## File Map

- Modify `app/src/styles/global.css` (T1).
- Modify/create under `app/src/components/layout/games/` (T2–T4); gate-driven registration in `docs/architecture/07-Frontend/08-Component-Inventory.md`.
- Create `app/tests/lib/stats/replay-turns.ts` (T5), modify `replay-games.ts`, `replay-step-games.ts`.
- Create `app/tests/integration/fixtures/rolled-back.ts` (T5), modify the two itests.
- Docs in T6.

---

### Task 1 (I1): global.css clone groups (#1183)

**Files:**
- Modify: `app/src/styles/global.css` (regions ~717-722, ~985-1017, ~1196-1235, ~1283-1295 as of `origin/main` 2abf01f)

**Interfaces:**
- Produces: custom properties in the existing token block (names fixed): `--gradient-accent-feature`, `--shadow-accent-glow`, `--shadow-accent-glow-halo`; and, for the four `deck-*` transitions, one shared `@utility deck-return-transition` (or equivalent) only if `@apply` of it keeps the reduced-motion block. Consumers: `.feature-card`, `.home-feature-card`, `.accent-orb`, `.accent-orb-halo`, `@utility glass-blue`, `.deck-*` utilities.

- [ ] **Step 1: Capture the baseline.** `cd app && npm run build`, copy the built CSS bundle to `<scratchpad>/css-before.css`. Run `bash scripts/check-dupes.sh` and note the four `global.css` groups (4 rows count).
- [ ] **Step 2: Extract.** Replace each duplicated declaration with `var(--…)` using the names above. The three shadow lines (`inset 0 1px 0 …`, `0 0 20px 3px …`, `inset 0 0 0 1px …`) become `--shadow-accent-glow`; the halo variant appends the `0 0 40px 20px …` layer, keeping the original layer order (`inset`, glow, halo, inset ring). The 138deg gradient becomes `--gradient-accent-feature`. `accent-orb`/`glass-blue` already share `--gradient-blue-glass`; reuse it, do not add a duplicate. For the deck group, extract the shared `transition` + reduced-motion tail; tokens defined with `var()`/`color-mix()` stay `code-only` for design sync (no sync change).
- [ ] **Step 3: Prove no visual change.** Rebuild; diff the built CSS against `css-before.css` after expanding custom properties (resolve every `var(--shadow-accent-glow…)`/gradient to its literal) — each selector's resolved declaration must equal the old one, and each `deck-*` rule keeps its `@media (prefers-reduced-motion: reduce)` child. Record the check in the report.
- [ ] **Step 4: Gates.** `bash scripts/check-dupes.sh` reports the `global.css` row as stale (lower it with `--update` only after T6 confirms the full set; for this task just confirm the row count dropped to 0 via the tool output), `bash scripts/check-style-tokens.sh`, `cd app && npx astro check`.
- [ ] **Step 5: Commit** `refactor(styles): share accent glow, feature gradient and deck transition tokens`.

### Task 2 (I2): recreational-input pairs

**Files:**
- Modify: `MickeyMouseRecreationalInput.astro`, `TacticsRecreationalInput.astro`, `FollowTheLeaderRecreationalInput.astro`, `KillerRecreationalInput.astro` (all in `app/src/components/layout/games/`)
- Create: one shared component per pair (names fixed): `TargetTapRecreationalInput.astro`, `NumberPadRecreationalInput.astro`

**Interfaces:**
- Produces: `TargetTapRecreationalInput.astro` — the full body of Mickey/Tactics (they are byte-identical on lines 21-55); the two game inputs render it (thin wrappers keep their file names so gate/wiring references do not move). `NumberPadRecreationalInput.astro` — `RingKeyRow` + the 20-button grid (`flex-4 grid-cols-5`); the root class is a prop (`input-well flex flex-col` for Killer, `flex min-h-0 flex-1 flex-col` for Follow the Leader); the bottom row is a default `<slot />` that each wrapper fills with its own `grid` (`grid-cols-3` + `aria-live="polite"` for FTL, `grid-cols-2` for Killer).
- Consumes: `InputButton.astro`, `RingKeyRow.astro`; `{...props}` spreads onto the root.

- [ ] **Step 1: Capture baseline HTML.** Build; save the built HTML of every page rendering the four components to `<scratchpad>/html-before/` (find via `grep -rl` of a distinctive class in `dist`).
- [ ] **Step 2: Extract and migrate.** Write the two shared components; reduce the four files to wrappers passing only the differing parts.
- [ ] **Step 3: Verify.** Rebuild; `diff -r` of before/after HTML (whitespace-insensitive) must be empty. `bash scripts/check-astro-class-composition.sh`, `check-astro-conventions.sh`, `npx astro check`, `bash scripts/check-dupes.sh` shows both `*RecreationalInput` rows gone.
- [ ] **Step 4: Register** the two components in the Component Inventory and File Inventory.
- [ ] **Step 5: Commit** `refactor(play): share target-tap and number-pad recreational inputs`.

### Task 3 (I3): interface pairs

**Files:**
- Modify: `interfaces/Baseball.astro`, `interfaces/Shanghai.astro`, `interfaces/OneTwentyOne.astro`, `interfaces/TenUpOneDown.astro`
- Create: `RoundTargetPlayScreen.astro` (Baseball/Shanghai; props `roundLabel: { label: string; key: string }`), `AttemptTargetPlayScreen.astro` (OneTwentyOne/TenUpOneDown; shared `big`, `route`, first tile `Target`; per-game extra tiles via a `tiles` prop appended after `Target`)

**Interfaces:**
- Consumes: `SeatedPlayScreen.astro` props `big`, `tiles`, `idle`, `route`; each game's existing `{...props}`.
- Differences to preserve: Baseball tile `{ label: "Inning", value: c("inningLabel") }`, Shanghai `{ label: "Round", value: c("roundLabel") }`; OneTwentyOne's `Visit` tile expression `` `(${c("visitsThisAttempt")} + 1) + ' / 3'` `` vs TenUpOneDown's `Attempts` + `Successes · Failures` tiles. Read both full files before extracting; if the shared part falls below the clone threshold after reading, extract only what fallow flags.

- [ ] **Step 1: Baseline HTML** as in T2 for the four game pages.
- [ ] **Step 2: Extract and migrate.**
- [ ] **Step 3: Verify:** empty HTML diff, gates as T2, `check-dupes.sh` shows both `interfaces/*` rows gone.
- [ ] **Step 4: Register** components in both inventories.
- [ ] **Step 5: Commit** `refactor(play): share round-target and attempt-target play screens`.

### Task 4 (I4): result-modal pairs

**Files:**
- Modify: `result-modals/FollowTheLeaderResults.astro`, `KillerResults.astro`, `MickeyMouseResults.astro`, `TacticsResults.astro`
- Create: `OutOrderRow.astro` (the `Out order` block: `x-show="outOrderLabel() !== ''"`, `x-cloak`, label/value spans), `DartsToCloseSummary.astro` (props `statRows`, `targetLabels`; wraps `SinglePlayerSummary` + `TargetGrid` with `valuesExpr="resultsSnapshot?.seats?.[0]?.dartsToClose"` and `cols={3}`)

**Interfaces:**
- Consumes: `ResultsModalShell`, `ComparisonSummary`, `SinglePlayerSummary`, `TargetGrid`. FTL/Killer keep their own `overline`, `STAT_ROWS`; Tactics keeps its extra `ComparisonSummary` after `DartsToCloseSummary`. The `<h2 slot="title">` block is the same in all four; leave it unless fallow still flags it after the two extractions (then extract `ResultsTitle.astro`).

- [ ] **Step 1: Baseline HTML** for the four result modals.
- [ ] **Step 2: Extract and migrate.**
- [ ] **Step 3: Verify:** empty HTML diff, gates, `check-dupes.sh` shows both `result-modals/*` rows gone.
- [ ] **Step 4: Register** components in both inventories.
- [ ] **Step 5: Commit** `refactor(results): share out-order row and darts-to-close summary`.

### Task 5 (I5): test helpers

**Files:**
- Create: `app/tests/lib/stats/replay-turns.ts` exporting `replayTurns(turns: EngineFacts["turns"], stageIdOf: (turn) => string): ReplayTurnSchemaData[]` (maps `stageId`, `turnSequence`, `participantId`, `turnTotalScore`, `kept ?? false`, `darts` with `sequence` → `dartNumber`); reuse the type imports already in `replay-games.ts`/`replay-step-games.ts`.
- Modify: `app/tests/lib/stats/replay-games.ts` (lines ~135-144), `replay-step-games.ts` (lines ~102-122 and ~359-381; the two step functions also share the engine-play + header tail — extract `playSteps(engine, observations, headerArgs)` inside `replay-step-games.ts` if fallow still flags it).
- Create: `app/tests/integration/fixtures/rolled-back.ts` exporting `class Rollback` (private to module) and `rolledBack(sql: postgres.Sql, body: (tx: postgres.TransactionSql) => Promise<void>): Promise<void>`.
- Modify: `card-tags.itest.ts`, `template-difficulty-axis.itest.ts` to import it and pass their `sql`; also migrate any other `tests/integration/*.itest.ts` that copies `rolledBack` (`grep -l "class Rollback" tests/integration`).

**Interfaces:**
- Produces: `replayTurns`, `rolledBack` (names fixed).

- [ ] **Step 1: Baseline.** `cd app && npx vitest run tests/lib/stats` — record pass counts.
- [ ] **Step 2: Implement `replayTurns`** and use it in all three call sites (single-line map in `replay-games.ts` keeps its `stageIds` lookup via `stageIdOf`).
- [ ] **Step 3: Implement `rolledBack` fixture** and migrate the itests.
- [ ] **Step 4: Verify.** Same vitest run: identical counts, all green. `npx astro check` clean (covers itest types). `bash scripts/check-dupes.sh`: the three test rows gone.
- [ ] **Step 5: Commit** `test: share replay turn mapping and itest rollback helper`.

### Task 6 (I6): close-out

**Files:**
- Modify: `scripts/dupes-baseline.txt` (via `--update`, expect 17 → 7 rows), `decisions/<domain>.md` (new decision, id from `scripts/next-decision-id.sh`, domain per `DECISIONS.md` router — frontend/styling decisions live in the frontend domain file; extends D513, D524), `docs/architecture/00-File-Inventory.md` (rows for new components/helpers; decisions row counts if the budget gate asks), `docs/architecture/07-Frontend/08-Component-Inventory.md`, `docs/architecture/00-Context-Map-History.md` (next minor version).

- [ ] **Step 1:** `bash scripts/check-dupes.sh --update`; confirm only removals via `git diff`.
- [ ] **Step 2:** Write the decision: shared tokens/components/helpers added; what was deliberately left (Phase 4c list above); accepted differences (none expected — record any the earlier tasks ruled).
- [ ] **Step 3:** Update inventories and history; run `context-maintenance` and `run-all-gates` (including `bash scripts/check-context-budget.sh`); `cd app && npm run format && npm run format:check && npm run validate:app` (validate:app needs `DATABASE_URL`; if absent, state which steps were skipped).
- [ ] **Step 4:** File `discovered-work` issues for anything found; ask the owner about the design sync (D524) before the PR; then push and open the PR with `.github/pull_request_template.md`; subscribe to PR activity.
- [ ] **Step 5: Commit** `docs: phase 4b close-out (decision, inventories, baseline)`.

## Self-Review

- Spec coverage: #1183 → T1; six `.astro` pairs → T2 (2), T3 (2), T4 (2); replay helpers + itest pair → T5; ratchet/doc obligations → T6.
- Type/name consistency: `replayTurns`, `rolledBack`, component names are fixed once above and reused unchanged.
- Risk: T2–T4 depend on the built-HTML diff to prove no change; if a page cannot be built without `DATABASE_URL`, the implementer renders the components with the Astro container API instead and says so in the report.

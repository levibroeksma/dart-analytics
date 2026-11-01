# Duplication Backlog Phase 2 and 3a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the setup-screen clones (PR D, Phase 2) and the stats-section-module clones (PR E, Phase 3a) without changing behaviour or output.

**Architecture:** Same method as Phases 0–1: extract typed helpers or parts next to the code, migrate every copy, let the existing tests plus the factory-surface and page-bindings snapshots prove nothing moved, then lower `scripts/dupes-baseline.txt`. Variation goes through callbacks or spec objects, never per-game booleans.

**Tech Stack:** TypeScript, Alpine.js setup factories, Astro components, Vitest, fallow.

**Spec:** `docs/superpowers/specs/2026-10-31-duplication-backlog-design.md` (Phases 2 and 3). Baseline at start: 54 rows, 2,222 duplicated lines (2.5%), from `main` at `9f52d69`.

## Global Constraints

- No behaviour or UI change. Setup factory surfaces identical (`factory-surface.test.ts` snapshot, no update); every Alpine name used by a page resolves (`page-bindings.test.ts`).
- Existing test assertions are never weakened or re-pointed at a different guarantee. Tests may gain additions, new imports, or construction changes only.
- No getters in spread parts. No per-game boolean flags (a lifecycle option with a documented default is a decision, recorded like D517's `uploadIfComplete`, not slipped in).
- Extract only when it removes a baseline row without a flag parameter. A group that cannot be extracted that way is skipped and named, with the reason, in the task report.
- Incidental findings become `discovered-work` issues, never fixes.
- Gates per task: `cd app && npx vitest run <area>`; at PR end `npm test`, `npx astro check --minimumFailingSeverity hint`, `bash ../scripts/fallow-gate.sh`, `npm run format:check`, `bash ../scripts/check-dupes.sh`. Run fallow locally: `validate:app` skips without `DATABASE_URL`.
- Do not run `npm run format` / `prettier --write` on docs; it reflows unrelated tables.
- Owner reviews and merges each PR; work stops after each PR is opened. PR E branches from `main` after PR D lands.
- Markup proof (Task D4): render the affected components through the Astro container API before and after, diff the HTML modulo whitespace, paste the result in the PR. The script is a one-off (D101: no committed `.astro` test runner).

## Review Focus

- A solo ROUNDS/MINUTES setup that starts with an out-of-range or non-numeric `durationValue` still clamps to the same bounds (min on non-finite, floor then clamp otherwise) in all four games.
- `SESSION_ALREADY_ACTIVE` on start still routes to `retryReconciliation`; any other error still sets the same message; `loading` always returns to false.
- Seating a guest or bot in Score Training / TUOD still forces ROUNDS; 121's TARGET mode and 501's match fields still reach the config overrides unchanged.
- A stats series with no rows still returns `[]` (not a bucket with `sampleSize 0`) where it did before, and buckets still sort by start with the same `closed` flag.
- Checkout, bust and double-performance sections still skip visits below the eligibility cut and count the same chances/finishes/busts per starting score.

---

## PR D — Phase 2: setup screens

### Task D1: One duration clamp

**Files:**
- Create: `app/src/lib/game/duration-clamp.ts`
- Modify: `app/src/lib/game/{around-the-clock,one-twenty-one,score-training,tuod}-duration.ts`
- Test: `app/tests/lib/game/duration-clamp.test.ts`

**Interfaces:**
- Produces: `clampToBounds(bounds: { min: number; max: number }, value: unknown): { value: number; clamped: boolean }` — floor finite numbers then clamp into the inclusive bounds; non-finite or non-number clamps to `min` with `clamped: true`.
- Unchanged exports (names and signatures): `clampAroundTheClockDuration`, `clampOneTwentyOneDuration`, `clampScoreTrainingDuration`, `clampTuodDuration`, and the four `*DurationBounds`. Each clamp becomes a one-line call to `clampToBounds`.

- [ ] **Step 1: Write `duration-clamp.test.ts`** — cases: NaN, string, `Infinity` → `{ value: min, clamped: true }`; 5.7 in 1..10 → `{ value: 5, clamped: true }`; 5 in 1..10 → `{ value: 5, clamped: false }`; 0 and 11 clamp to 1 and 10 with `clamped: true`.
- [ ] **Step 2: Run it; expect FAIL** (module missing): `cd app && npx vitest run tests/lib/game/duration-clamp.test.ts`.
- [ ] **Step 3: Implement `clampToBounds` in `duration-clamp.ts`** and re-point the four clamp functions at it. Keep each file's bounds function and doc comment of the contract (not the "mirrors X" history).
- [ ] **Step 4: Run** `npx vitest run tests/lib/game` — the four existing `*-duration.test.ts` files pass unmodified; `bash ../scripts/check-dupes.sh` reports the two duration rows lowered (stale-row notices expected; baseline is updated in D5).
- [ ] **Step 5: Commit** `refactor(setup): one duration clamp`.

### Task D2: Shared session start for preset setups

**Files:**
- Modify: `app/src/lib/game/setup-controller.ts`, `five-oh-one-setup.data.ts`, `one-twenty-one-setup.data.ts`, `score-training-setup.data.ts`, `tuod-setup.data.ts`
- Test: `app/tests/lib/game/setup-controller.test.ts` plus each game's existing `*-setup.data.test.ts`

**Interfaces:**
- Produces, in `setup-controller.ts`: `startPresetSession<Ctx extends PresetSetupContext>(ctx: Ctx, spec: { gameTypeKey: string; rulesetVersionKey: string; playHref: string; preset: ConfigurationPresetData; overrides?: Record<string, unknown> }): Promise<void>` — sets `loading`/`error`, builds the snapshot (`preset.configuration` merged with `overrides`), resolves the mode pair and participants, calls `createSession`, `$store.game.startSession`, navigates to `playHref`; on `SESSION_ALREADY_ACTIVE` awaits `ctx.retryReconciliation()`, otherwise sets `"Could not start the session. Try again."`; always clears `loading`.
- `createPresetSetupController().start` becomes: resolve the preset and ruleset version key, then call `startPresetSession`.

- [ ] **Step 1: Write the failing tests** in `setup-controller.test.ts` for `startPresetSession`: success path (session created with `overrides`, store started, location set), `SESSION_ALREADY_ACTIVE` → `retryReconciliation` called and no error set, other error → message set, `loading` false after each. Mock `@client/api/sessions` as the existing controller tests do.
- [ ] **Step 2: Run; expect FAIL** (export missing).
- [ ] **Step 3: Extract `startPresetSession`** from the `try` body of `createPresetSetupController().start`; make `start` call it. Existing controller tests pass unmodified.
- [ ] **Step 4: Migrate 501, 121, Score Training, TUOD** `start` bodies: each keeps its own pre-steps (preset lookup message, `clamp*Duration`, `durationValue` write-back, 501/121 override building) and then calls `startPresetSession`. Per game, run its `*-setup.data.test.ts` unmodified, then commit `refactor(setup): <game> starts through startPresetSession`.
- [ ] **Step 5: Update the `createPresetSetupController` doc comment** (it states these four "deliberately do not" use the controller) to say they share `startPresetSession` but keep their own pre-start steps and `init`.
- [ ] **Step 6: Run** `npx vitest run tests/lib/game` + `check-dupes.sh` (the 5-file `setup-controller` row should be gone).

### Task D3: Duration setup part for Score Training and TUOD

**Files:**
- Create: `app/src/lib/game/duration-setup.data.ts`
- Modify: `score-training-setup.data.ts`, `tuod-setup.data.ts`, then `one-twenty-one-setup.data.ts` where its members match
- Test: `app/tests/lib/game/duration-setup.data.test.ts`

**Interfaces:**
- Produces: `durationSetupData<TType extends string>(options: { gameTypeKey: string; fallback: Record<TType, number> })` returning `presets`, `durationType`, `durationValue`, `init`, `presetForMode`, `selectMode`, `addGuest`, `addBot`, `forceRoundsIfGuested`, with the exact bodies Score Training and TUOD share today (watch `durationType`, load presets and sessions, default to ROUNDS, fall back to `fallback`, guest/bot forces ROUNDS). Plain object, no getters; spread before the factory's own members so a factory can still override.
- Consumes: `createSetupSession` result is spread by the factory as today.

- [ ] **Step 1: Write the failing test** for `durationSetupData`: `init` loads presets and sets `durationValue` from the ROUNDS preset's `duration_value` or the fallback; a failed fetch sets the connection error and hides the modal; `selectMode` swaps value; `addGuest`/`addBot` force ROUNDS only when a guest or bot is seated.
- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement the part**, then migrate Score Training and TUOD to spread it. Surface snapshot must not change.
- [ ] **Step 4: 121:** diff its `init`/`presetForMode`/`selectMode` against the part. Adopt only if identical for the shared modes (TARGET handling must stay 121's own); if it would need a hook per branch, skip and record why in the report.
- [ ] **Step 5: Run** `npx vitest run tests/lib/game`, `check-dupes.sh`; commit `refactor(setup): duration setup part`.

### Task D4: Shared solo duration markup

**Files:**
- Create: `app/src/components/layout/games/setup/DurationSoloFields.astro`
- Modify: `DurationField.astro`, `OneTwentyOneSetupForm.astro`, `docs/architecture/07-Frontend/08-Component-Inventory.md`

**Interfaces:**
- `DurationSoloFields` props: `{ formatOptions: { value: string; label: string }[]; rounds: { min: number; max: number }; minutes: { min: number; max: number }; soloHint: string }`. Renders the FORMAT toggle plus the ROUNDS/MINUTES sliders (the inner `div` both files carry today), bound to `durationType`/`durationValue` exactly as now.

- [ ] **Step 1: Before-render.** One-off script (scratchpad, not committed) renders `DurationField` (Score Training and TUOD props) and `OneTwentyOneSetupForm` through the Astro container API and saves the HTML.
- [ ] **Step 2: Extract `DurationSoloFields.astro`**; `DurationField` and `OneTwentyOneSetupForm` render it inside their own `x-if` wrappers; the guest/bot branches stay as they are.
- [ ] **Step 3: After-render and diff** modulo whitespace; expect no difference. Paste the result into the PR description.
- [ ] **Step 4: Register the component** in `08-Component-Inventory.md`; `bash ../scripts/check-dupes.sh` should show the `DurationField|OneTwentyOneSetupForm` row gone. Run `npx astro check --minimumFailingSeverity hint` and the astro class-composition gate.
- [ ] **Step 5: Commit** `refactor(setup): shared solo duration fields`.

### Task D5: Close-out and PR D

- [ ] **Step 1:** `bash ../scripts/check-dupes.sh --update` (rows only go down); read the diff.
- [ ] **Step 2: Docs:** decision block via `bash scripts/next-decision-id.sh` in `decisions/frontend/architecture.md` (setup parts; `startPresetSession`; `clampToBounds`); File Inventory rows (`duration-clamp.ts`, `duration-setup.data.ts`, `setup-controller.ts`, `DurationSoloFields.astro`); `09-Adding-A-Game.md` note that preset setups end in `startPresetSession`; `00-Context-Map-History.md` entry; run `scripts/check-context-budget.sh` and bump a drifted claim only if it fails.
- [ ] **Step 3:** full gates (Global Constraints), final whole-branch review, push, open the PR from the repo template (`Closes` the issues the baseline rows came from: #1174, #1185, and the setup rows of #1187 after confirming each), subscribe, schedule the ~50-minute check-in, stop.

---

## PR E — Phase 3a: stats section modules

### Task E1: One bucket accumulator and one close step

**Files:**
- Modify: `app/src/modules/stats/sections/series.module.ts` and the hand-rolled-tail modules: `grouping`, `loose-darts`, `scoring-trend`, `target-accuracy`, `treble-rate`, `volume`, `leg-stats`, `training-result`, `completion`, `session-result` (`*.module.ts`)
- Test: `app/tests/modules/stats/sections/series.module.test.ts` plus each module's existing test

**Interfaces:**
- Produces, in `series.module.ts`: `bucketFor<M>(buckets: Map<string, { end: string; sampleSize: number; metrics: M }>, row: { bucketStart: string; bucketEnd: string }, emptyMetrics: () => M)` — get-or-create the start-keyed accumulator and return it (the caller still mutates it; no `set` needed beyond what `bucketFor` does).
- Consumes: existing `closeBuckets`, which the hand-rolled `Array.from(keys).sort().map(...)` tails reimplement without `dropEmpty`.

- [ ] **Step 1: Write the failing test** for `bucketFor`: first call creates `{ end, sampleSize: 0, metrics: emptyMetrics() }` and stores it under `bucketStart`; second call for the same start returns the same object; different starts get separate objects.
- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement `bucketFor`.** Replace each module's get-or-create and its hand-rolled tail with `bucketFor` + `closeBuckets` (no `dropEmpty`, matching today). Order stays string-ascending by start.
- [ ] **Step 4: Per module,** run its existing test file unmodified; commit per two or three modules: `refactor(stats): <modules> use bucketFor and closeBuckets`.
- [ ] **Step 5: Run** `npx vitest run tests/modules/stats` and `check-dupes.sh`.

### Task E2: Visit-keyed bucket builder (checkout family)

**Files:**
- Modify: `series.module.ts` (or a sibling `visit-buckets.module.ts` if the file passes ~400 lines), `bust-rate.module.ts`, `checkout-path.module.ts`, `checkout-rate.module.ts`, `double-performance.module.ts`
- Test: `app/tests/modules/stats/sections/visit-buckets.test.ts` plus the four existing module tests

**Interfaces:**
- Produces: `visitBuckets<E>(sessions: readonly BucketedSession[], ctx: { to: string; now: Date }, spec: { include: (visit: BucketedVisit) => boolean; keyOf: (visit: BucketedVisit) => string; empty: () => E; add: (entry: E, visit: BucketedVisit) => void }): SeriesBucket<Record<string, E>>[]` — per session bucket, per included visit: get-or-create the keyed entry, `add`, bump `sampleSize`; closes with `closeBuckets(..., { dropEmpty: true })`.

- [ ] **Step 1: Write the failing test** with two sessions in two buckets: filtered visits are skipped, entries accumulate per key, a bucket with no included visit is dropped, results sorted with `closed` set.
- [ ] **Step 2: Run; expect FAIL.**
- [ ] **Step 3: Implement `visitBuckets`;** re-express the four modules as specs. Where a module's loop does something the spec cannot express without a flag (`double-performance` is the likely one), leave it and record why.
- [ ] **Step 4: Run** the four module tests unmodified; commit `refactor(stats): visitBuckets for the checkout family`.

### Task E3: Remaining stats-module families

**Files:** the baseline rows among `routine-completion`/`routine-volume`/`step-volume`, `atc-darts-per-target`/`training-result`, `series`/`training-result`/`leg-stats`, `completion`/`session-result`, `routine-summary.module.ts` (internal), `play-visit-stats.ts`/`visit-stats.module.ts`, `merge-metrics.ts` (internal, 2 rows).

- [ ] **Step 1:** run `npx fallow dupes` on those files; for each group extract a typed helper (local to the file for internal clones, shared in `series.module.ts` for cross-file ones) and migrate every copy; each helper gets its own test.
- [ ] **Step 2:** a group that needs a flag is skipped and listed with its reason.
- [ ] **Step 3:** per group, run the area's existing tests unmodified; commit per family.

### Task E4: Close-out and PR E

- [ ] **Step 1:** `check-dupes.sh --update`; decision block (next id); File Inventory rows for any new file and changed helpers; `00-Context-Map-History.md` entry; `check-context-budget.sh`.
- [ ] **Step 2:** full gates, final whole-branch review, push, open the PR (template; `Closes` only issues whose baseline rows are gone), subscribe, check-in, stop.

---

## Not in these two PRs (next plan, from the then-remaining baseline)

`statistics.repository.ts` (11), `game-stats.store.ts` (6), `statistics.service.ts`, `merge-metrics.ts` cross-file, `schedule`/`session`/`routine` repositories and services, the API route pairs, the validators (`score-training`/`tuod`, `121`/`three-dart`), client `sessions.ts`/`training-sessions.ts`/`statistics.ts`, `rulesets/types.ts`, training exercise engines, then Phase 4 (CSS, `.astro` pairs, test helpers).

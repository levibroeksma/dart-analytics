# Duplication Backlog — Design

Date: 2026-10-31. Status: owner answers folded in 2026-10-31; awaiting approval.

## Intent

The clone ratchet (D513, `scripts/check-dupes.sh`) stops new duplication but leaves the existing backlog: 4,378 duplicated lines (4.9%), 117 clone groups, 73 baseline rows, tracked as issues #1167–#1187. Each copy is a place a fix lands in one game and not the others. Owner: drift is the bigger risk than a deep restructure; go deep, in phases, without breaking anything.

Goal: remove as much duplication as possible, so a rule change to a play screen, setup screen, repository or store is made once.

## Where it comes from (measured 2026-10-31)

- ~60% is in `app/src/lib/game/*-play.data.ts` (15 Alpine factories, ~7k lines). Engines already share kernels and `dart-engine-shell`; the clones are one layer up:
  - the same ~20 state fields (`loading`, `error`, `finished`, `completionStatus`, `playAgain*`, `hiddenTurnKey`, `botThrowing`, `timer`, `engine`, …);
  - ~12 one-line delegations to `play-lifecycle.ts` (`init`, `back`, `abandonAndExit`, `retryReconciliation`, `commitDart`, `maybeRunBotVisit`, `recordDart`, `visitMarkers`, `undoVisit`, `togglePause`, `destroy`, `uploadAndCompleteSession` shell, timer reset in `playAgain`);
  - per-seat pairs (`xFor(seatRef)` + `x()` = `xFor(active seat)`), `state()`/`activeSeatState()`, results title shell.
- Setup factories: score-training / tuod / 121 setup data and `DurationField.astro` vs `OneTwentyOneSetupForm.astro`.
- Rest: internal clones in `statistics.repository.ts`, `schedule.repository.ts`, `game-stats.store.ts`, `merge-metrics.ts`, `routine-summary.module.ts`, `rulesets/types.ts`, stats sections, client `sessions.ts` vs `training-sessions.ts`, validators, `global.css`, `.astro` game interface pairs, ~50 small families (#1187).

## Goals

1. Shared play-screen base: each game's play factory states only what is its own (fold, labels, stats, results title, bot thrower, tap mapping).
2. Same for setup screens and their `.astro` fields.
3. Remove internal and cross-file clones in repositories, stores, stats modules, client API, rulesets types, CSS, `.astro`.
4. Every phase lowers `scripts/dupes-baseline.txt` (`--update`) and closes its issues.
5. End state: every remaining baseline row is a deliberate keep, named in the final PR with why.

## Non-goals

- Behaviour or UI changes. Same pages, same Alpine expressions, same output.
- Engine / kernel changes (`modules/game/*.engine.module.ts`, kernels) — already shared; touched only if a listed clone is there.
- DB, migrations, API contracts.
- Test-file duplication (`app/tests/**`) — only where a src change makes a test helper obvious. *(Claude's call)*

## Anti-goals (failure even if it works)

- A broken play/setup screen. Alpine binds by string (`x-text="accuracy()"`); `astro check` does not see a removed or renamed method. Any phase that changes a factory's public surface by accident is a failure.
- Editing existing behaviour tests to make them pass. Tests may change only imports or factory construction; assertions stay. A test whose subject moves to the shared base is moved with it, never weakened (root invariant on re-pointed tests).
- A base so generic it needs per-game flags for everything (a "god factory"). Variation goes through small typed hooks, not booleans.
- One huge PR.

## Design

### Safety net first (Phase 0)

- A surface test per play and setup factory: the set of keys and their kinds (`function` / value) on the object each `xPlay()` / `xSetup()` returns, frozen as a fixture before any refactor. Later phases must keep it identical. *(Claude's call)* Plus a check that every Alpine expression name used in the game `.astro` pages resolves to a key on its factory, so the template contract is proven, not assumed. Builder chooses the mechanism (vitest reading the `.astro` files, or a `scripts/check-*.sh`).
- Existing `tests/lib/game/*-play.data.test.ts` and `*-setup.data.test.ts` stay as the behaviour proof; they must pass unmodified (imports aside) after each phase.

### Phase 1 — play-screen base (#1167, #1168, #1169, #1170, #1171, #1173, #1175, #1177)

- `lib/game/play-screen.data.ts` (name: builder's call): `playScreenData(spec)` returning the shared fields and lifecycle methods, spread into each factory the way `boardInputData()` and `playAgainStarterData()` already are. Per-seat pair helper (`seatPair`/similar) so `xFor` + `x` are declared once.
- Spec = per-game hooks: game type key, resume, fold/state, stats/results, play-again overrides. Typed.
- *(Claude's call)* Surface stays **identical** per factory — no key added or removed. Optional capabilities are separate composable spreads (e.g. bot-seat, timed-countdown), each added only by the games that have them today (baseball, follow-the-leader, killer, tactics have no bot keys; ten have no timer keys). Composition, not flags.
- *(Claude's call)* Scope: the 15 `lib/game/*-play.data.ts` factories. `quickSubtractPlay` (`lib/training/trivia`) and `routinePlay` (`lib/training/routines`) have no session lifecycle; they are not forced onto the base. Their shared countdown logic with `play-countdown.ts` (#1171) is a helper extraction in this phase; anything else of theirs goes to Phase 4.
- *(Claude's call)* `*PlayContext` types in `lib/game/types.ts` may be re-derived from the base type plus per-game hooks; exported names stay so imports in tests and `.astro` keep working.
- Order: migrate the biggest clone family first (around-the-clock, doubles-training, singles-training, shanghai), then 501/121, tuod/score-training, then the rest so none of the 15 is left on the old shape.
- May split into several PRs (by family). Each PR: all 15 still pass surface + behaviour tests.

### Phase 2 — setup screens (#1174, #1185, setup rows of #1187)

Same pattern for setup factories and the duration/setup `.astro` fields (shared component per the rule of three; register in `08-Component-Inventory.md`).

### Phase 3 — repositories, stores, modules (#1172, #1176, #1178, #1179, #1180, #1181, #1182, #1184, #1186)

Extract local helpers within each file, or a shared helper where the clone crosses files. Repositories keep Controller → Service → Repository layering and view-backed reads.

### Phase 4 — CSS, `.astro`, remainder (#1183, #1187)

`global.css` clones, `.astro` game interface / result-modal / recreational-input pairs (shared components), then the small families. Anything kept is listed with its reason.

*(Claude's call)* Proof for markup/CSS phases (2 and 4): before the change, render each affected component/page via the Astro container API and snapshot the HTML; after, the snapshot must match apart from whitespace. CSS merges keep selector specificity and source order of the rules they replace; a Playwright screenshot of each affected page, before vs after, is attached to the PR.

## Constraints

- TDD per `app/CLAUDE.md`: Phase 0 tests go first; each extracted helper gets its own test.
- `validate:app`, `run-all-gates`, `check-dupes.sh` green per PR; baseline only goes down.
- One PR per phase (or per family within Phase 1); sequential. Owner reviews and merges each PR (merging is blocked for Claude); work stops at each PR until it lands, then the next branch starts from `main`. At most one open PR beyond the one under review (branch-stack cap).
- *(Claude's call)* A clone kept on purpose: its issue is closed as "not planned" with the reason; the row stays in the baseline and is listed in the final PR.
- Context maintenance per PR: `app/src/lib/game` docs/CLAUDE.md and `07-Frontend` pattern docs describe the play-screen base once; decision recorded for the base pattern; File Inventory rows for new files; component inventory for new components.
- Incidental findings → `discovered-work` issues, not fixed in pass.

## Builder's latitude

File and helper names; hook shape of the spec; exact PR split inside Phase 1; surface-test mechanism; whether a tiny two-copy clone is worth a helper (rule: extract if it removes a baseline row without a flag parameter).

## Success

- `scripts/dupes-baseline.txt` reduced to only deliberate keeps; duplication well below the current 4.9%.
- Adding a new game's play screen needs only its own hooks, no copied lifecycle.
- Every play/setup page behaves as before: surface and behaviour tests unchanged and green; issues #1167–#1187 closed.

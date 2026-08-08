# Score Training Visit Stats — Design

> **Date:** 2026-08-08
> **Status:** approved (brainstorming consensus)
> **Scope:** Wire live visit-progress StatRows on Score Training play (`threeDartAverage`, `dartsThrownThisLeg`, `previousScoreThisLeg`) by adding play-data methods and extracting shared pure helpers reused by 501.
> **Out of scope:** Astro markup redesign; results modal / `computeStats` shape; engine, API, or DB changes; renaming ST methods to match 501 (`averageThisLeg`).

---

## Context

`ScoreTraining.astro` already renders three `StatRow`s calling Alpine methods that do not exist on `scoreTrainingPlay()`:

| Label | Expression |
| ----- | ---------- |
| 3 dart avg. | `threeDartAverage()` |
| Darts | `dartsThrownThisLeg()` |
| Previous | `previousScoreThisLeg()` |

501 already implements the last two names plus `averageThisLeg()` in `five-oh-one-play.data.ts`, scoped to `turnsInCurrentLeg()`. Score Training has a single `EXERCISE_BLOCK` stage, so the same stats read from `$store.game.turns` (whole session).

Decisions locked in brainstorming:

| Topic | Choice |
| ----- | ------ |
| Average method name | Keep Astro wiring: `threeDartAverage()` |
| Average formula (ST) | Per-visit: `sum(totalScore) / visitCount`, `.toFixed(1)`; `"0.0"` when empty |
| 501 average | Keep darts-based 3DA: `((sum / dartsThrown) * 3).toFixed(1)` with `dartsThrown = turns.length * maxDartsPerTurn` (current behavior; equals per-visit under that counting rule) |
| Implementation | Play-factory methods + extract shared pure helpers where math is identical |
| Turn scope (ST) | All `$store.game.turns` |
| Empty previous | `"—"` (same as 501) |

Authority: `07-Frontend/02-Folder-Structure.md`, `03-Alpine-Patterns.md`, `04-Modules-And-OOP.md`, `06-Test-Strategy.md`, `06-API/03-Shared-Conventions.md` (type barrels), Pattern 18 (`04-Architecture-patterns.md`), `app/CLAUDE.md`. Precedent: 501 leg-scoped progress stats; game-domain pure helpers `five-oh-one-legs.ts` / `score-training-duration.ts` / `session-recovery.ts`.

---

## Scope

In scope:

- New pure helper module under `app/src/lib/game/` (e.g. `play-visit-stats.ts`)
- Score Training play methods + `ScoreTrainingPlayContext` type members
- Refactor 501 play methods to call the shared helpers (behavior unchanged)
- Unit tests for helpers
- New Score Training play progress-stats tests
- Update 501 play tests as needed after extraction (assertions stay equivalent; any helper-focused coverage may move or stay as integration through the factory)

Out of scope:

- Changing `ScoreTraining.astro` labels/expressions (already correct)
- Results snapshot / completion modal average semantics
- Merging the two average helpers into one (kept as named formulas even though they agree under turn×max dart counting)
- Changing dart counting to actual dart rows (would alter 501 checkout-leg averages)

---

## Architecture

```
ScoreTraining.astro / FiveOhOne.astro
  └─ StatRow value="…()"
       └─ scoreTrainingPlay() / fiveOhOnePlay()
            └─ lib/game/play-visit-stats.ts (pure)
```

| File | Role |
| ---- | ---- |
| `app/src/lib/game/play-visit-stats.ts` | Pure display helpers (game-domain; same home as `five-oh-one-legs.ts` / `score-training-duration.ts` — not `@utils`) |
| `app/src/lib/game/score-training-play.data.ts` | Thin methods over `$store.game.turns` |
| `app/src/lib/game/five-oh-one-play.data.ts` | Thin methods over `turnsInCurrentLeg()` via helpers |
| `app/src/lib/game/types.ts` | Declare ST methods on `ScoreTrainingPlayContext` |
| `app/tests/lib/game/play-visit-stats.test.ts` | Helper unit tests |
| `app/tests/lib/game/score-training-play.data.test.ts` | Session progress-stats cases |
| `app/tests/lib/game/five-oh-one-play.data.test.ts` | Keep / adjust leg-stats suite after refactor |

`ScoreTraining.astro` is already wired; no markup change required for this task.

---

## Helper API

Input turns are `{ totalScore: number }[]` (no full `TurnFact` dependency). Do **not** `export type` / `export interface` from `play-visit-stats.ts` — type-barrel gate (`06-API/03-Shared-Conventions.md`, `scripts/check-type-barrels.sh`). Inline the param shape, or if a named type is needed put it in `lib/game/types.ts` and raise it.

| Helper | Behavior |
| ------ | -------- |
| `previousScoreDisplay(turns)` | `String(last.totalScore)` or `"—"` |
| `dartsThrownCount(turnCount, maxDartsPerTurn)` | `turnCount * maxDartsPerTurn` |
| `perVisitAverageDisplay(turns)` | `"0.0"` if empty; else `(sum / n).toFixed(1)` |
| `threeDartAverageDisplay(turns, maxDartsPerTurn)` | `"0.0"` if no darts; else `((sum / darts) * 3).toFixed(1)` |

For full visits under turn×max dart counting, per-visit and 3DA strings match (algebraically the same). Two helpers remain so each game keeps an explicit formula name; neither factory should invent a different dart-counting rule in this task.

---

## Play-factory wiring

**Score Training**

```
threeDartAverage()      → perVisitAverageDisplay(turns)
dartsThrownThisLeg()    → dartsThrownCount(turns.length, config?.maxDartsPerTurn ?? 3)
previousScoreThisLeg()  → previousScoreDisplay(turns)
```

where `turns = this.$store.game.turns`.

**501**

```
averageThisLeg()        → threeDartAverageDisplay(legTurns, maxDartsPerTurn ?? 3)
dartsThrownThisLeg()    → dartsThrownCount(legTurns.length, maxDartsPerTurn ?? 3)
previousScoreThisLeg()  → previousScoreDisplay(legTurns)
```

where `legTurns = this.turnsInCurrentLeg()`. Existing public method names and return shapes stay identical so Astro and tests keep working.

**Errors:** helpers are pure and never throw. Missing `configSnapshot` defaults `maxDartsPerTurn` to `3`. No new Alpine `error` paths.

---

## Testing (mandatory)

Extraction is incomplete without test updates on **both** games.

### 1. Helper unit tests (`play-visit-stats.test.ts`)

- Empty turns: previous `"—"`, per-visit `"0.0"`, 3DA `"0.0"`, darts `0`
- One / multi visits: previous = last score; darts = `n * max`; both average helpers return the same `.toFixed(1)` string when darts = `n * max` (algebraically identical under that counting rule)
- `dartsThrownCount` with a non-default `maxDartsPerTurn` (e.g. 3 → 6 for two turns)

Note: both factories keep counting darts as `turns.length * maxDartsPerTurn`, not actual dart rows (current 501 behavior). Under that rule, `perVisitAverageDisplay` and `threeDartAverageDisplay` always agree; two helpers still exist so each game names its formula explicitly and either can later switch dart counting without renaming call sites. Helper tests assert both formulas and the shared counting rule so the 501 refactor cannot silently change outcomes.

### 2. Score Training play tests

Add a `describe` for session progress stats (mirror 501’s `"leg-scoped progress stats"`):

- After two visits: darts, `threeDartAverage` (per-visit `.toFixed(1)`), previous score
- Empty session: `"0.0"`, `0`, `"—"`

### 3. FiveOhOne play tests

- Existing `"leg-scoped progress stats"` cases must remain green after the refactor (same expectations: e.g. two turns → darts `6`, average `"52.5"`, previous `"45"`; empty → `"0.0"` / `0` / `"—"`; post leg-win reset)
- If the suite needs mechanical edits (imports, helper spying), update them — do not weaken assertions or re-point cases at different inputs to keep them green
- Prefer keeping factory-level tests as the behavior contract; helper tests own the pure math

### 4. Verification

- Mid-task (red/green): scoped Vitest on the three files above is fine
- Before claiming done (`06-Test-Strategy.md`): full `npm test` (complete suite — not `--bail`, not only touched files) and `npm run validate:app`

---

## Done when

1. `ScoreTraining.astro` StatRows resolve (methods exist on the play factory)
2. ST empty session: avg `"0.0"`, darts `0`, previous `"—"`
3. ST after visits: avg = per-visit `.toFixed(1)`; darts = visits × max; previous = last visit score
4. 501 leg-stats tests pass with unchanged outcomes after helper extraction
5. Helper + ST + 501 targeted Vitest suites green

---

## Doc alignment notes

| Doc rule | Design stance |
| -------- | ------------- |
| Pattern 18 / engines: never store derived averages in facts | Helpers + play methods derive on read from turn facts; engines untouched |
| `00-Overview` Must Not: stats from raw DB tables | N/A — mid-session UI folds the client fact log (same as existing 501 StatRows), not SQL tables |
| `02-Folder-Structure`: domain helpers in `lib/game/` | `play-visit-stats.ts` beside other game pure helpers; not `utils/` |
| Type barrels: no inline `export type` in implementation files | Param shapes stay anonymous (or named only in `types.ts`) |
| D101: do not extract helpers solely for Astro testability | Extraction is for ST↔501 reuse, not to unit-test `.astro` |
| Hard invariant: migrated tests keep the same guarantee | 501 leg-stats expectations unchanged; no re-pointing at different inputs |
| `06-Test-Strategy`: full suite before done | Scoped Vitest mid-task only; full `npm test` + `validate:app` at completion |

## Implementation notes

- No inline comments inside TS function bodies (`app/CLAUDE.md`); JSDoc on exported helpers only
- Minimal diffs: 501 change is a move to helpers, not a formula rewrite
- Dedicated task branch for implementation (do not pile onto unrelated UI work without an explicit stack decision)
- Context maintenance + `writing-plans` after this spec is user-approved

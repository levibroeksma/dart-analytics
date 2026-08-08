# Score Training Visit Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Score Training play StatRows work by adding `threeDartAverage`, `dartsThrownThisLeg`, and `previousScoreThisLeg` on `scoreTrainingPlay()`, backed by shared pure helpers also used by 501.

**Architecture:** Extract display math into `app/src/lib/game/play-visit-stats.ts` (same home as `five-oh-one-legs.ts` / `score-training-duration.ts`). Score Training methods fold `$store.game.turns` (single `EXERCISE_BLOCK`). 501 methods fold `turnsInCurrentLeg()` through the same helpers. Finish the three progress `StatRow`s already started on `ScoreTraining.astro` on branch `ui/setup-forms`.

**Tech Stack:** TypeScript, Alpine.js v3 play factories (`.data.ts`), Vitest (`environment: "node"`).

**Spec:** `docs/superpowers/specs/2026-08-08-score-training-visit-stats-design.md`

**Branch:** Stay on `ui/setup-forms` for the whole plan. Do **not** create `feat/score-training-visit-stats` or check out `main`. (User override of the design’s “dedicated task branch” note.)

## Global Constraints

- Work only on branch `ui/setup-forms` — no new branch, no stash/checkout dance onto `main`
- Leave unrelated uncommitted WIP on this branch alone (`InfoSection.astro`, `ScoreTrainingSetupForm.astro`, etc.) — do not fold it into visit-stats commits
- No `export type` / `export interface` in `play-visit-stats.ts` (type-barrel gate) — inline `{ totalScore: number }[]` param shapes
- No inline `//` comments inside `app/src/**/*.ts` function bodies — JSDoc above exports only; any `// …` in plan snippets are **plan annotations**, do not copy into source
- Helpers are pure; never throw; missing `maxDartsPerTurn` defaults to `3`
- ST average = per-visit (`perVisitAverageDisplay`); 501 average = `threeDartAverageDisplay` (turn×max dart counting — same numeric result under current rule)
- Do **not** change 501 public method names or return shapes; do **not** weaken or re-point 501 leg-stats assertions
- `ScoreTraining.astro` already has uncommitted StatRow markup on this branch — verify, fix indentation to match `FiveOhOne.astro`, do **not** redesign beyond those three rows
- Do **not** edit `FiveOhOne.astro`
- Do **not** change `computeStats` / results modal semantics
- Do **not** change dart counting to actual dart rows
- Tests under `app/tests/` mirroring `app/src/`; TDD red→green→refactor
- Mid-task: scoped Vitest OK; before claiming done: full `npm test` + `npm run validate:app` + `run-all-gates` skill (`06-Test-Strategy.md`, `context-maintenance`, `app/CLAUDE.md`)
- Before PR: `cd app && npm run format` and `npm run format:check` clean
- Worktrees forbidden
- Do not commit unless the user asks (commit steps below are for when they do)
- Out of scope: engine, API, DB, Astro redesign beyond the three StatRows, renaming ST methods to `averageThisLeg`, unrelated setup-form WIP on this branch

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `app/src/lib/game/play-visit-stats.ts` | **New** — `previousScoreDisplay`, `dartsThrownCount`, `perVisitAverageDisplay`, `threeDartAverageDisplay` |
| `app/tests/lib/game/play-visit-stats.test.ts` | **New** — helper unit tests |
| `app/src/lib/game/five-oh-one-play.data.ts` | Refactor three leg-stat methods to call helpers |
| `app/tests/lib/game/five-oh-one-play.data.test.ts` | Existing `"leg-scoped progress stats"` must stay green (assertions unchanged) |
| `app/src/lib/game/types.ts` | Add three methods on `ScoreTrainingPlayContext` |
| `app/src/lib/game/score-training-play.data.ts` | Add three thin methods over `$store.game.turns` |
| `app/tests/lib/game/score-training-play.data.test.ts` | New `"session progress stats"` describe |
| `app/src/components/layout/games/interfaces/ScoreTraining.astro` | Progress slot + three `StatRow`s (uncommitted WIP already on `ui/setup-forms`) |
| Context / decisions | Per `context-maintenance` skill at end |

---

### Task 1: Pure visit-stat helpers

**Files:**
- Create: `app/src/lib/game/play-visit-stats.ts`
- Create: `app/tests/lib/game/play-visit-stats.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `previousScoreDisplay(turns: { totalScore: number }[]): string`
  - `dartsThrownCount(turnCount: number, maxDartsPerTurn: number): number`
  - `perVisitAverageDisplay(turns: { totalScore: number }[]): string`
  - `threeDartAverageDisplay(turns: { totalScore: number }[], maxDartsPerTurn: number): string`

- [ ] **Step 1: Confirm branch and existing Astro WIP**

```bash
git branch --show-current
# Expected: ui/setup-forms

git status -sb
# Expect ScoreTraining.astro modified (StatRows present).
# Leave InfoSection.astro / ScoreTrainingSetupForm.astro alone unless the user says otherwise.
```

Do **not** `git checkout main`, do **not** create `feat/score-training-visit-stats`, do **not** use worktrees.

Verify `ScoreTraining.astro` already imports `StatRow` and calls `threeDartAverage()` / `dartsThrownThisLeg()` / `previousScoreThisLeg()`. If somehow missing, apply the markup from Task 3 Step 1.

- [ ] **Step 2: Write the failing helper tests**

Create `app/tests/lib/game/play-visit-stats.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  previousScoreDisplay,
  dartsThrownCount,
  perVisitAverageDisplay,
  threeDartAverageDisplay,
} from "@lib/game/play-visit-stats";

describe("previousScoreDisplay", () => {
  it('returns "—" when there are no turns', () => {
    expect(previousScoreDisplay([])).toBe("—");
  });

  it("returns the last turn totalScore as a string", () => {
    expect(
      previousScoreDisplay([{ totalScore: 60 }, { totalScore: 45 }]),
    ).toBe("45");
  });
});

describe("dartsThrownCount", () => {
  it("returns 0 for zero turns", () => {
    expect(dartsThrownCount(0, 3)).toBe(0);
  });

  it("multiplies turn count by maxDartsPerTurn", () => {
    expect(dartsThrownCount(2, 3)).toBe(6);
  });

  it("honours a non-default maxDartsPerTurn", () => {
    expect(dartsThrownCount(2, 4)).toBe(8);
  });
});

describe("perVisitAverageDisplay", () => {
  it('returns "0.0" when there are no turns', () => {
    expect(perVisitAverageDisplay([])).toBe("0.0");
  });

  it("returns the per-visit average to one decimal place", () => {
    expect(
      perVisitAverageDisplay([{ totalScore: 60 }, { totalScore: 45 }]),
    ).toBe("52.5");
  });
});

describe("threeDartAverageDisplay", () => {
  it('returns "0.0" when there are no darts', () => {
    expect(threeDartAverageDisplay([], 3)).toBe("0.0");
  });

  it("matches per-visit average under turn×max dart counting", () => {
    const turns = [{ totalScore: 60 }, { totalScore: 45 }];
    expect(threeDartAverageDisplay(turns, 3)).toBe("52.5");
    expect(threeDartAverageDisplay(turns, 3)).toBe(
      perVisitAverageDisplay(turns),
    );
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd app && npx vitest run tests/lib/game/play-visit-stats.test.ts
```

Expected: FAIL — cannot resolve `@lib/game/play-visit-stats` / exports missing.

- [ ] **Step 4: Implement the helpers**

Create `app/src/lib/game/play-visit-stats.ts`:

```typescript
/**
 * Last visit score for progress StatRows, or an em dash when the leg/session
 * has no turns yet.
 */
export function previousScoreDisplay(
  turns: { totalScore: number }[],
): string {
  const last = turns.at(-1);
  return last ? String(last.totalScore) : "—";
}

/**
 * Darts thrown for display, counted as visits × max darts per turn (not
 * actual dart rows). Matches the live 501 / Score Training StatRow rule.
 */
export function dartsThrownCount(
  turnCount: number,
  maxDartsPerTurn: number,
): number {
  return turnCount * maxDartsPerTurn;
}

/**
 * Per-visit average as a one-decimal display string. Used by Score Training's
 * `threeDartAverage()` (full visits make this equal to 3-dart average).
 */
export function perVisitAverageDisplay(
  turns: { totalScore: number }[],
): string {
  if (turns.length === 0) return "0.0";
  const total = turns.reduce((sum, turn) => sum + turn.totalScore, 0);
  return (total / turns.length).toFixed(1);
}

/**
 * Classic 3-dart average as a one-decimal display string, using turn×max
 * dart counting. Used by 501's `averageThisLeg()`.
 */
export function threeDartAverageDisplay(
  turns: { totalScore: number }[],
  maxDartsPerTurn: number,
): string {
  const dartsThrown = dartsThrownCount(turns.length, maxDartsPerTurn);
  if (dartsThrown === 0) return "0.0";
  const total = turns.reduce((sum, turn) => sum + turn.totalScore, 0);
  return ((total / dartsThrown) * 3).toFixed(1);
}
```

Do **not** add `export type` / `export interface` in this file.

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd app && npx vitest run tests/lib/game/play-visit-stats.test.ts
```

Expected: PASS (all helper cases).

- [ ] **Step 6: Commit** (only if the user asked to commit)

```bash
git add app/src/lib/game/play-visit-stats.ts app/tests/lib/game/play-visit-stats.test.ts
git commit -m "$(cat <<'EOF'
Add shared play visit-stat display helpers.

Pure previous/darts/average formatters for Score Training and 501 StatRows.
EOF
)"
```

---

### Task 2: Refactor 501 play methods onto the helpers

**Files:**
- Modify: `app/src/lib/game/five-oh-one-play.data.ts` (the three methods near `dartsThrownThisLeg` / `averageThisLeg` / `previousScoreThisLeg`)
- Test: `app/tests/lib/game/five-oh-one-play.data.test.ts` — **do not change assertion values** in `"leg-scoped progress stats"`

**Interfaces:**
- Consumes: all four helpers from Task 1 (501 uses three of them)
- Produces: unchanged public API on `fiveOhOnePlay()`:
  - `dartsThrownThisLeg(): number`
  - `averageThisLeg(): string`
  - `previousScoreThisLeg(): string`

- [ ] **Step 1: Run existing 501 leg-stats tests (baseline green)**

```bash
cd app && npx vitest run tests/lib/game/five-oh-one-play.data.test.ts -t "leg-scoped progress stats"
```

Expected: PASS — records baseline before refactor.

- [ ] **Step 2: Import helpers and replace the three method bodies**

In `app/src/lib/game/five-oh-one-play.data.ts`, add to the existing imports from `@lib/game/…` / local paths:

```typescript
import {
  dartsThrownCount,
  previousScoreDisplay,
  threeDartAverageDisplay,
} from "@lib/game/play-visit-stats";
```

Replace the three methods with:

```typescript
    dartsThrownThisLeg(this: FiveOhOnePlayContext): number {
      const maxDartsPerTurn =
        this.$store.game.configSnapshot?.maxDartsPerTurn ?? 3;
      return dartsThrownCount(
        this.turnsInCurrentLeg().length,
        maxDartsPerTurn,
      );
    },

    averageThisLeg(this: FiveOhOnePlayContext): string {
      const maxDartsPerTurn =
        this.$store.game.configSnapshot?.maxDartsPerTurn ?? 3;
      return threeDartAverageDisplay(
        this.turnsInCurrentLeg(),
        maxDartsPerTurn,
      );
    },

    previousScoreThisLeg(this: FiveOhOnePlayContext): string {
      return previousScoreDisplay(this.turnsInCurrentLeg());
    },
```

Do not change `turnsInCurrentLeg`, `remainingScore`, `checkoutHint`, or any other method.

- [ ] **Step 3: Re-run 501 leg-stats tests**

```bash
cd app && npx vitest run tests/lib/game/five-oh-one-play.data.test.ts -t "leg-scoped progress stats"
```

Expected: PASS with the **same** expectations:

- two turns → darts `6`, average `"52.5"`, previous `"45"`
- empty → darts `0`, average `"0.0"`, previous `"—"`
- after leg win → previous `"—"`, darts `0`

If anything fails, fix the helper wiring — do **not** edit the test expectations to make them pass.

- [ ] **Step 4: Run the full 501 play test file**

```bash
cd app && npx vitest run tests/lib/game/five-oh-one-play.data.test.ts
```

Expected: PASS (full file).

- [ ] **Step 5: Commit** (only if the user asked to commit)

```bash
git add app/src/lib/game/five-oh-one-play.data.ts
git commit -m "$(cat <<'EOF'
Refactor 501 leg progress stats onto shared helpers.

Behavior unchanged; display math now lives in play-visit-stats.
EOF
)"
```

---

### Task 3: Score Training play methods + Astro StatRows + tests

**Files:**
- Modify: `app/src/lib/game/types.ts` (`ScoreTrainingPlayContext`)
- Modify: `app/src/lib/game/score-training-play.data.ts`
- Modify: `app/tests/lib/game/score-training-play.data.test.ts`
- Modify: `app/src/components/layout/games/interfaces/ScoreTraining.astro`

**Interfaces:**
- Consumes:
  - `previousScoreDisplay`, `dartsThrownCount`, `perVisitAverageDisplay` from Task 1
- Produces on `scoreTrainingPlay()` / `ScoreTrainingPlayContext`:
  - `threeDartAverage(this: ScoreTrainingPlayContext): string`
  - `dartsThrownThisLeg(this: ScoreTrainingPlayContext): number`
  - `previousScoreThisLeg(this: ScoreTrainingPlayContext): string`
- Produces in Astro: progress slot with three `StatRow`s calling those methods (same pattern as `FiveOhOne.astro`)

- [ ] **Step 1: Fix `ScoreTraining.astro` progress-slot indentation**

Markup already exists on this branch. Align indentation with `FiveOhOne.astro` (the `slot="progress"` div attributes are currently under-indented). Final shape:

```astro
  <SinglePlayerDisplay
    isTarget={false}
    score="$store.game.turns.reduce((sum, t) => sum + t.totalScore, 0)"
    class="max-h-2/5"
  >
    <div
      slot="progress"
      class="mt-2 flex w-full flex-col items-center gap-2 px-4"
    >
      <dl class="w-full space-y-1">
        <StatRow
          label="3 dart avg."
          value="threeDartAverage()"
        />
        <StatRow
          label="Darts"
          value="dartsThrownThisLeg()"
        />
        <StatRow
          label="Previous"
          value="previousScoreThisLeg()"
        />
      </dl>
    </div>
  </SinglePlayerDisplay>
```

Keep `import StatRow from "@components/layout/games/StatRow.astro";` in the Components block. Conventions (`05-Astro-Components.md` / style gates): keep `{...props}`; no `font-medium`; semantic tokens only; existing timer `x-show` already has `x-cloak`.

If the StatRows are missing for any reason, insert the block above (do not redesign).

- [ ] **Step 2: Write the failing session progress-stats tests**

Inside the existing `describe("scoreTrainingPlay", () => { … })` in `app/tests/lib/game/score-training-play.data.test.ts`, add a new nested describe (place it near other focused describes — e.g. after resume tests, before `"Completion sequence"` is fine):

```typescript
  describe("session progress stats", () => {
    function makePlay(
      gameOverrides: Partial<GameStub> = {},
    ): ScoreTrainingPlayContext {
      return {
        ...scoreTrainingPlay(),
        $store: {
          game: gameStub({
            configSnapshot: rounds(20),
            ...gameOverrides,
          }),
        },
      };
    }

    it("computes darts thrown, three-dart average, and previous score for the session", async () => {
      const play = makePlay({
        turns: [turnFact("t1", 1, 60), turnFact("t2", 2, 45)],
      });
      await play.init.call(play);

      expect(play.dartsThrownThisLeg.call(play)).toBe(6);
      expect(play.threeDartAverage.call(play)).toBe("52.5");
      expect(play.previousScoreThisLeg.call(play)).toBe("45");
    });

    it('shows "—" for previous score when the session has no turns yet', async () => {
      const play = makePlay({ turns: [] });
      await play.init.call(play);

      expect(play.dartsThrownThisLeg.call(play)).toBe(0);
      expect(play.threeDartAverage.call(play)).toBe("0.0");
      expect(play.previousScoreThisLeg.call(play)).toBe("—");
    });
  });
```

`turnFact`, `gameStub`, `rounds`, and `ScoreTrainingPlayContext` already exist in this file — reuse them. No Astro unit test (D101).

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts -t "session progress stats"
```

Expected: FAIL — `threeDartAverage` / `dartsThrownThisLeg` / `previousScoreThisLeg` are not functions (or TypeScript/runtime undefined).

- [ ] **Step 4: Declare the methods on `ScoreTrainingPlayContext`**

In `app/src/lib/game/types.ts`, add after `remainingLabel(…): string;`:

```typescript
  threeDartAverage(this: ScoreTrainingPlayContext): string;
  dartsThrownThisLeg(this: ScoreTrainingPlayContext): number;
  previousScoreThisLeg(this: ScoreTrainingPlayContext): string;
```

- [ ] **Step 5: Implement the three methods on `scoreTrainingPlay()`**

In `app/src/lib/game/score-training-play.data.ts`, add:

```typescript
import {
  dartsThrownCount,
  perVisitAverageDisplay,
  previousScoreDisplay,
} from "@lib/game/play-visit-stats";
```

Immediately after `remainingLabel`, add:

```typescript
    threeDartAverage(this: ScoreTrainingPlayContext): string {
      return perVisitAverageDisplay(this.$store.game.turns);
    },

    dartsThrownThisLeg(this: ScoreTrainingPlayContext): number {
      const maxDartsPerTurn =
        this.$store.game.configSnapshot?.maxDartsPerTurn ?? 3;
      return dartsThrownCount(
        this.$store.game.turns.length,
        maxDartsPerTurn,
      );
    },

    previousScoreThisLeg(this: ScoreTrainingPlayContext): string {
      return previousScoreDisplay(this.$store.game.turns);
    },
```

Note: `threeDartAverage` calls `perVisitAverageDisplay` by design (spec) — the Astro label is "3 dart avg." and under full visits the numbers match.

- [ ] **Step 6: Run session progress-stats tests**

```bash
cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts -t "session progress stats"
```

Expected: PASS.

- [ ] **Step 7: Run ST + helper + 501 targeted suites together**

```bash
cd app && npx vitest run \
  tests/lib/game/play-visit-stats.test.ts \
  tests/lib/game/score-training-play.data.test.ts \
  tests/lib/game/five-oh-one-play.data.test.ts
```

Expected: PASS (all three files).

- [ ] **Step 8: Commit** (only if the user asked to commit)

```bash
git add \
  app/src/lib/game/types.ts \
  app/src/lib/game/score-training-play.data.ts \
  app/tests/lib/game/score-training-play.data.test.ts \
  app/src/components/layout/games/interfaces/ScoreTraining.astro
git commit -m "$(cat <<'EOF'
Wire Score Training visit progress StatRows.

Adds play methods plus progress-slot markup matching 501's StatRow pattern.
EOF
)"
```

---

### Task 4: Context maintenance + full verification

**Files:**
- Possibly: `docs/architecture/00-Context-Map.md` — only if inventory practice requires it. Peers `five-oh-one-legs.ts` / `score-training-duration.ts` / `session-recovery.ts` are **not** currently inventoried (only `lib/game/rulesets/*` and `lib/game/board/*` are). Do **not** invent a one-off row for `play-visit-stats.ts` unless you also inventory those peers in the same change
- Possibly: `decisions/frontend/architecture.md` or `decisions/frontend/alpine.md` — only if a new decision is warranted; route via `DECISIONS.md` (never add a row to the router). Small DRY extract of display helpers often needs no decision — skip unless the skill’s gate says otherwise
- Follow `.claude/skills/context-maintenance/SKILL.md` exactly
- Follow `.claude/skills/run-all-gates/SKILL.md` for app/ + docs/ changes

**Interfaces:**
- Consumes: completed Tasks 1–3
- Produces: green full suite + validate:app + applicable gate scripts; context system not stale

- [ ] **Step 1: Run context-maintenance skill checklist**

Follow `.claude/skills/context-maintenance/SKILL.md` end-to-end:

- CLAUDE.md/AGENT.md sync only if a rule changed (unlikely for this task)
- Context map: do not one-off-register `play-visit-stats.ts` (see Files note above)
- Decision ledger: append only if warranted; run `scripts/check-decision-ids.sh` if you touch `decisions/**`
- Confirm branch/PR posture: stay on `ui/setup-forms`; PR (when opened) targets `main`; do not open a second stacked branch for this work

- [ ] **Step 2: Format + format check**

```bash
cd app && npm run format && npm run format:check
```

Expected: `format:check` clean (`app/CLAUDE.md` / Frontend Agent Guide). Commit formatting diffs only if the user asked to commit.

- [ ] **Step 3: Full test suite**

```bash
cd app && npm test
```

Expected: complete suite green — no `--bail`, not scoped to touched files only (`06-Test-Strategy.md`).

- [ ] **Step 4: validate:app + run-all-gates**

```bash
cd app && npm run validate:app
```

Then run the `run-all-gates` skill for an `app/` + `docs/` change set and report each script OK/FAIL explicitly (includes `check-type-barrels.sh`, `check-no-inline-comments.sh`, `check-file-locations.sh`, `check-context-map.sh`, etc.).

Expected: all applicable scripts pass.

- [ ] **Step 5: Done-when checklist**

Confirm all true:

1. `ScoreTraining.astro` has progress StatRows calling the three methods
2. ST empty session → `"0.0"` / `0` / `"—"`
3. ST after two visits (60, 45) → `"52.5"` / `6` / `"45"`
4. 501 leg-stats expectations unchanged and green
5. Helper + ST + 501 suites green; full `npm test` + `validate:app` + gates green

- [ ] **Step 6: Commit context/docs** (only if the user asked to commit)

```bash
git add docs/architecture/00-Context-Map.md decisions/
git commit -m "$(cat <<'EOF'
Register visit-stats context after ST StatRow wiring.

EOF
)"
```

(Only stage files that actually changed.)

---

## Self-Review (plan vs spec)

| Spec requirement | Task |
| ---------------- | ---- |
| `play-visit-stats.ts` four helpers | Task 1 |
| Helper unit tests (empty / multi / maxDarts) | Task 1 |
| No `export type` in helper file | Task 1 Global Constraints + Step 4 |
| 501 refactor onto helpers, behavior unchanged | Task 2 |
| 501 leg-stats tests stay green / same assertions | Task 2 |
| ST methods + `ScoreTrainingPlayContext` types | Task 3 |
| ST `threeDartAverage` → `perVisitAverageDisplay` | Task 3 |
| ST session progress-stats tests | Task 3 |
| `ScoreTraining.astro` StatRows (already on `ui/setup-forms`; fix indent) | Task 3 |
| No FiveOhOne.astro / computeStats / engine changes | Global Constraints |
| Full `npm test` + `validate:app` + gates before done | Task 4 |
| `format` + `format:check` | Task 4 |
| Context maintenance | Task 4 |
| Stay on `ui/setup-forms` (user override; no new branch) | Task 1 Step 1 |

No placeholders remain. Method names and return types are consistent across tasks (`threeDartAverage` / `dartsThrownThisLeg` / `previousScoreThisLeg` on ST; `averageThisLeg` stays on 501).

**Spec deltas (intentional):**
1. Design said Astro out of scope (“already wired”) — markup is uncommitted on this branch; plan still owns indent fix + committing it with the play methods.
2. Design said dedicated task branch — **user override:** implement on existing `ui/setup-forms`.

# Singles Training Target-Labeled Buttons + Session Stat Rows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle Singles Training's tap row into a two-row grid with target-labeled S/D/T buttons, and add four session-total stat rows (Misses/Singles/Doubles/Trebles) to the play screen.

**Architecture:** One new data-layer capability (four zone-key-classifying getters on the existing play data module) feeds two presentational `.astro` changes — no new files, no engine/validator/capability changes.

**Tech Stack:** Astro.js, TypeScript, Alpine.js, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-13-singles-training-input-stats-design.md`. No changes to `capabilities.ts`, any validator, any engine module, or any seed/migration in this plan.
- All four counters (`missCount`/`singleCount`/`doubleCount`/`trebleCount`) are **session totals** — scan every turn in `$store.game.turns`, not just the current visit.
- Zone-key classification is exhaustive over `DartZoneKey`'s 8 members: `MISS` → miss; `SINGLE`/`INNER_SINGLE`/`OUTER_SINGLE`/`OUTER_BULL` → single; `DOUBLE`/`INNER_BULL` → double; `TREBLE` → treble. A bull `Bull` hit (`OUTER_BULL`) counts as a Single, a `Bullseye` hit (`INNER_BULL`) counts as a Double — matching how they already score via `trainingPointsFor`.
- Each getter returns a stringified count (`String(n)`), matching `currentPoints()`'s existing return-type convention — never a bare `number`.
- The S/D/T button labels concatenate `'S' + currentTargetLabel()` etc. **only** inside the `x-if="!isBullVisit()"` branch, where `currentTargetLabel()` is always a plain number string (never `"BULL"`) — do not concatenate in the bull branch.
- Bull-visit row stays exactly as today: `Bull` / `Bullseye`, two buttons, no third slot, no target-number suffix.
- Row 2 is always `Undo` / `Miss`, two equal-width buttons (was previously grouped with S/D/T in one row).
- `.astro` markup is not unit-tested in this codebase (D101) — tasks that only add/edit `.astro` files have no TDD step; verification is `scripts/check-astro-conventions.sh` + `npm run check` + a manual dev-server check.
- No new decision-ledger entry: this plan is a mechanical UI refinement of Singles Training's already-shipped play data module — nothing here introduces a new architectural pattern.
- Run the `run-all-gates` skill and the mandatory `context-maintenance` skill before this branch is considered done (root `CLAUDE.md`).

---

### Task 1: Session hit-count getters

**Files:**
- Modify: `app/src/lib/game/types.ts`
- Modify: `app/src/lib/game/singles-training-play.data.ts`
- Test: `app/tests/lib/game/singles-training-play.data.test.ts`

**Interfaces:**
- Consumes: `DartZoneKey` (`@modules/types`, already imported in `singles-training-play.data.ts`), `TurnFact` (already imported), `$store.game.turns` (existing read).
- Produces: `missCount()`, `singleCount()`, `doubleCount()`, `trebleCount()` on `SinglesTrainingPlayContext`, consumed by Task 3's stat rows.

- [ ] **Step 1: Add the failing tests**

In `app/tests/lib/game/singles-training-play.data.test.ts`, add a new `describe` block. Find the existing `describe("previewSegments", ...)` block and insert this new block immediately after it (before `describe("completion", ...)`):

```ts
describe("missCount / singleCount / doubleCount / trebleCount", () => {
  it("counts zero for every category before any dart is thrown", async () => {
    const play = makePlay();
    await play.init.call(play);

    expect(play.missCount.call(play)).toBe("0");
    expect(play.singleCount.call(play)).toBe("0");
    expect(play.doubleCount.call(play)).toBe("0");
    expect(play.trebleCount.call(play)).toBe("0");
  });

  it("classifies number-target hits by zone and misses separately", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "DOUBLE");
    await play.recordTap.call(play, "TREBLE");

    expect(play.singleCount.call(play)).toBe("1");
    expect(play.doubleCount.call(play)).toBe("1");
    expect(play.trebleCount.call(play)).toBe("1");
    expect(play.missCount.call(play)).toBe("0");
  });

  it("counts bull Bull/Bullseye hits toward singles/doubles, alongside 60 prior number-target singles", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 3 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({ turns: priorTurnsThroughNumber(20) });
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "DOUBLE");
    await play.recordTap.call(play, "MISS");

    expect(play.singleCount.call(play)).toBe("61");
    expect(play.doubleCount.call(play)).toBe("1");
    expect(play.missCount.call(play)).toBe("1");
    expect(play.trebleCount.call(play)).toBe("0");
  });

  it("sums the four counters to the total darts thrown so far", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "MISS");

    const total =
      Number(play.missCount.call(play)) +
      Number(play.singleCount.call(play)) +
      Number(play.doubleCount.call(play)) +
      Number(play.trebleCount.call(play));
    expect(total).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/singles-training-play.data.test.ts`
Expected: FAIL — `play.missCount is not a function` (and similarly for the other three).

- [ ] **Step 3: Add the type signatures**

In `app/src/lib/game/types.ts`, inside the `SinglesTrainingPlayContext` type, add four method signatures immediately after the existing `previewSegments` line:

```ts
  previewSegments(this: SinglesTrainingPlayContext): SinglesPreviewSegment[];
  missCount(this: SinglesTrainingPlayContext): string;
  singleCount(this: SinglesTrainingPlayContext): string;
  doubleCount(this: SinglesTrainingPlayContext): string;
  trebleCount(this: SinglesTrainingPlayContext): string;
```

(Replace the single existing `previewSegments` line with these five lines — same line, four new ones added right after it.)

- [ ] **Step 4: Add the implementation**

In `app/src/lib/game/singles-training-play.data.ts`, add four zone-key group constants immediately after the existing `SINGLE_ZONE_KEYS` constant declaration:

```ts
const MISS_COUNT_ZONE_KEYS: ReadonlySet<DartZoneKey> = new Set(["MISS"]);
const SINGLE_COUNT_ZONE_KEYS: ReadonlySet<DartZoneKey> = new Set([
  "SINGLE",
  "INNER_SINGLE",
  "OUTER_SINGLE",
  "OUTER_BULL",
]);
const DOUBLE_COUNT_ZONE_KEYS: ReadonlySet<DartZoneKey> = new Set([
  "DOUBLE",
  "INNER_BULL",
]);
const TREBLE_COUNT_ZONE_KEYS: ReadonlySet<DartZoneKey> = new Set(["TREBLE"]);

function countZoneKey(
  turns: readonly TurnFact[],
  zoneKeys: ReadonlySet<DartZoneKey>,
): number {
  let count = 0;
  for (const turn of turns) {
    for (const dart of turn.darts) {
      if (zoneKeys.has(dart.hitZoneKey)) count += 1;
    }
  }
  return count;
}
```

Then add four getters to the object returned by `singlesTrainingPlay()`, immediately after the existing `previewSegments` method:

```ts
    previewSegments(
      this: SinglesTrainingPlayContext,
    ): SinglesPreviewSegment[] {
      return previewSegmentsFor(
        this.$store.game.turns,
        this.$store.game.configSnapshot,
        this.hiddenTurnKey,
      );
    },

    missCount(this: SinglesTrainingPlayContext): string {
      return String(
        countZoneKey(this.$store.game.turns, MISS_COUNT_ZONE_KEYS),
      );
    },

    singleCount(this: SinglesTrainingPlayContext): string {
      return String(
        countZoneKey(this.$store.game.turns, SINGLE_COUNT_ZONE_KEYS),
      );
    },

    doubleCount(this: SinglesTrainingPlayContext): string {
      return String(
        countZoneKey(this.$store.game.turns, DOUBLE_COUNT_ZONE_KEYS),
      );
    },

    trebleCount(this: SinglesTrainingPlayContext): string {
      return String(
        countZoneKey(this.$store.game.turns, TREBLE_COUNT_ZONE_KEYS),
      );
    },
```

(The existing `previewSegments` method body is unchanged — this replaces it with itself plus the four new methods immediately after it.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/singles-training-play.data.test.ts`
Expected: PASS, every test in the file green (existing tests plus the 4 new ones).

- [ ] **Step 6: Typecheck**

Run: `cd app && npm run check`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
cd app && git add src/lib/game/types.ts src/lib/game/singles-training-play.data.ts tests/lib/game/singles-training-play.data.test.ts
git commit -m "feat(singles-training): add session hit-count getters"
```

---

### Task 2: Two-row target-labeled input buttons

**Files:**
- Modify: `app/src/components/layout/games/SinglesRecreationalInput.astro`

**Interfaces:**
- Consumes: `currentTargetLabel()`, `isBullVisit()`, `recordTap(ring)`, `undoVisit()`, `finished`, `$store.game.turns` — all already exposed by Task 1's (and the prior branch's) `singlesTrainingPlay()`. No new interface produced.

- [ ] **Step 1: Rewrite the component**

Replace the full contents of `app/src/components/layout/games/SinglesRecreationalInput.astro` with:

```astro
---
interface Props {
  [key: string]: unknown;
}

// Props
const { ...props }: Props = Astro.props;

// Components
import InputButton from "./InputButton.astro";

// Icons
import UndoIcon from "@icons/undo.svg";
---

<div
  class="rounded-lg glass border border-border bg-surface-raised flex flex-col flex-1 min-h-0 w-full divide-y divide-border"
  {...props}
>
  <div class="flex flex-1 min-h-0 divide-x divide-border">
    <template x-if="!isBullVisit()">
      <InputButton
        :disabled="finished"
        @click="recordTap('SINGLE')"
      >
        <span x-text="'S' + currentTargetLabel()"></span>
      </InputButton>
    </template>
    <template x-if="!isBullVisit()">
      <InputButton
        :disabled="finished"
        @click="recordTap('DOUBLE')"
      >
        <span x-text="'D' + currentTargetLabel()"></span>
      </InputButton>
    </template>
    <template x-if="!isBullVisit()">
      <InputButton
        :disabled="finished"
        @click="recordTap('TREBLE')"
      >
        <span x-text="'T' + currentTargetLabel()"></span>
      </InputButton>
    </template>
    <template x-if="isBullVisit()">
      <InputButton
        :disabled="finished"
        @click="recordTap('SINGLE')"
      >
        Bull
      </InputButton>
    </template>
    <template x-if="isBullVisit()">
      <InputButton
        :disabled="finished"
        @click="recordTap('DOUBLE')"
      >
        Bullseye
      </InputButton>
    </template>
  </div>
  <div class="flex flex-1 min-h-0 divide-x divide-border">
    <InputButton
      aria-label="Undo last dart"
      :disabled="!$store.game.turns.length || finished"
      @click="undoVisit()"
    >
      <UndoIcon class="size-6 text-muted" />
    </InputButton>
    <InputButton
      :disabled="finished"
      @click="recordTap('MISS')"
    >
      Miss
    </InputButton>
  </div>
</div>
```

- [ ] **Step 2: Astro conventions gate**

Run: `bash scripts/check-astro-conventions.sh` (from repo root)
Expected: OK.

- [ ] **Step 3: Typecheck**

Run: `cd app && npm run check`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
cd app && git add src/components/layout/games/SinglesRecreationalInput.astro
git commit -m "feat(singles-training): two-row input grid with target-labeled S/D/T buttons"
```

---

### Task 3: Session stat rows

**Files:**
- Modify: `app/src/components/layout/games/interfaces/SinglesTraining.astro`

**Interfaces:**
- Consumes: `missCount()`, `singleCount()`, `doubleCount()`, `trebleCount()` (Task 1), `StatRow` (already imported in this file).

- [ ] **Step 1: Add the four stat rows**

In `app/src/components/layout/games/interfaces/SinglesTraining.astro`, replace:

```astro
      <dl class="w-full space-y-1">
        <StatRow
          label="Target"
          value="currentTargetLabel()"
        />
      </dl>
```

with:

```astro
      <dl class="w-full space-y-1">
        <StatRow
          label="Target"
          value="currentTargetLabel()"
        />
        <StatRow
          label="Misses"
          value="missCount()"
        />
        <StatRow
          label="Singles"
          value="singleCount()"
        />
        <StatRow
          label="Doubles"
          value="doubleCount()"
        />
        <StatRow
          label="Trebles"
          value="trebleCount()"
        />
      </dl>
```

- [ ] **Step 2: Astro conventions gate**

Run: `bash scripts/check-astro-conventions.sh` (from repo root)
Expected: OK.

- [ ] **Step 3: Typecheck**

Run: `cd app && npm run check`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
cd app && git add src/components/layout/games/interfaces/SinglesTraining.astro
git commit -m "feat(singles-training): add session stat rows for misses/singles/doubles/trebles"
```

---

### Task 4: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Full suite, typecheck, format**

Run: `cd app && npm test && npm run check && npm run format:check`
Expected: full suite green (no regressions), 0 type errors, format clean.

- [ ] **Step 2: fallow**

Run: `cd app && npx fallow`
Expected: 0 files above threshold.

- [ ] **Step 3: Applicable gate scripts**

Run from repo root:

```bash
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-file-locations.sh
bash scripts/check-astro-class-composition.sh
bash scripts/check-astro-conventions.sh
bash scripts/check-game-engines.sh
bash scripts/check-refinement-coverage.sh
bash scripts/check-type-barrels.sh
bash scripts/check-alias-sync.sh
bash scripts/check-constraint-mirror.sh
bash scripts/check-no-inline-comments.sh
bash scripts/check-style-tokens.sh
```

Expected: every script OK. (`npm run validate:app`'s DB-dependent steps — `db:status`/`db:migrate`/`db:introspect` — are expected to fail only if no `DATABASE_URL` is configured in the environment; no schema/migration/seed changes exist in this plan.)

- [ ] **Step 4: Manual dev-server smoke check**

Start: `cd app && astro dev --background`

- `/games/singles-training/play` (resume or start a fresh session) → tap row shows two stacked rows: top row `S1`/`D1`/`T1`, bottom row `Undo`/`Miss`.
- Tap `S1` → target advances only after 3 darts; stat block shows Target, Misses, Singles, Doubles, Trebles all updating live as darts are tapped.
- Play through to target 20, confirm labels read `S20`/`D20`/`T20`.
- On the BULL visit, confirm the top row switches to `Bull`/`Bullseye` (two buttons, no third slot) and the bottom row still reads `Undo`/`Miss`.
- Tap Bull → Singles count increments by 1; tap Bullseye → Doubles count increments by 1.
- Confirm Misses+Singles+Doubles+Trebles always equals total darts thrown so far.

Stop: `astro dev stop`

- [ ] **Step 5: Context maintenance**

Run the `context-maintenance` skill: update `docs/architecture/00-Context-Map.md`'s File Inventory row for `app/src/lib/game/singles-training-play.data.ts` (now also exposes the four hit-count getters) and bump the Version changelog; confirm no new decision-ledger entry is needed (per this plan's Global Constraints); confirm ISO dates on any new doc rows; confirm `run-all-gates` was fully run (Step 3 above).

- [ ] **Step 6: finishing-a-development-branch**

Follow this repo's `finishing-a-development-branch` skill to push and open/update the PR, noting in the PR body that this refines Singles Training's already-shipped play screen (target-labeled input buttons, session stat rows) with no engine/validator/capability changes.

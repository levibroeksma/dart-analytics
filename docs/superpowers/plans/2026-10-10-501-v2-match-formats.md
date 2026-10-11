# 501 V2 Match Formats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship ruleset version `501_V2` — best of N (odd), sets, win by 2 legs with a sudden-death cap, deciding-set margin scope and per-set throw rotation — while `501_V1` sessions keep resuming, replaying and counting in stats unchanged.

**Architecture:** A pure `match-format.module.ts` folds ordered leg winners (grouped by their `SET` parent) into set/leg scores and the match winner. The existing `FiveOhOneEngine` becomes version-aware (`501_V1` / `501_V2`), emits a `SET`→`LEG` stage tree when sets are on, and delegates every match-end question to the fold. Seat rota, undo, stats ordering, setup, play and results read the tree instead of assuming root legs.

**Tech Stack:** TypeScript, Zod, Vitest, Astro + Alpine, PostgreSQL seeds (dbmate), Cloudflare Workers API.

**Spec:** `docs/superpowers/specs/2026-10-10-501-v2-match-formats-design.md` (rules input: `docs/game-rules/rulesets/501.md`).

## Global Constraints

- All commands run from `app/` unless a path says otherwise; tests live under `app/tests/` mirroring `app/src/`.
- TDD per `app/CLAUDE.md`: failing test first, `npm test -- <file>` red for the right reason, minimal code, green.
- No `//` or `/* */` comments inside function bodies in `app/src/**`; JSDoc above declarations only, no decision history in them (cite `(D443)` style).
- Never store what the fact log can derive; `state()`/`facts()` return copies.
- Nested config keys stay single words (`mode`, `count`, `cap`, `scope`): `config-codec.ts`'s `mapKeys` is shallow, so only top-level keys are case-converted (`win_by_two` ↔ `winByTwo`).
- `BEST_OF` takes odd `count` only; `count` bounds 1..20 for legs and sets; `win_by_two.cap` ≥ leg target; `scope = DECIDING_SET` only when `sets` is non-null.
- Target of `{ mode, count }`: `count` for `FIRST_TO`, `(count + 1) / 2` for `BEST_OF`.
- A new engine key and its validator land in the same commit (`bash scripts/check-game-engines.sh`, pre-commit). `lib/game/five-oh-one-play.data.ts` must reference both `"501_V1"` and `"501_V2"`.
- Seeds: new file `database/seeds/0037_five_oh_one_v2_game_engine_reference.sql`; ruleset id `0198f100-0000-7000-8000-000000000017`; template id `0198f300-0000-7000-8000-000000000019`; 501 game type id `0198f000-0000-7000-8000-000000000001`. Capability rows are appended to `0007_ruleset_version_capabilities.sql`. Never touch migrations `0001`–`0046`.
- Discovered work → GitHub issue (`capturing-discovered-work`), never fixed in the same pass.
- Before any PR create/update: `npm run format`, commit diffs, `npm run format:check` clean.

## Review Focus

1. **A V1 session resumed after deploy** — must rebuild on `501_V1`, show `LEG n · FIRST TO N` and identical scores. Pinned by the V1 golden test (Task 4) and the play-data V1 subtitle test (Task 7).
2. **Undo across a set boundary** (the checkout that won a set, undone) — must restore the previous set's open leg with the same scores, not leave an empty `SET`. Pinned in Task 3 (turn-log) and Task 4 (engine round trip).
3. **Three or four sides under win by 2** — the margin is measured against every side; sudden death only when two or more sides sit at the cap. Pinned in Task 2's table.
4. **Setup picking a V1 preset for a V2 session** — `fetchConfigurationPresets("501")` returns the two V1 presets and the new V2 one; V2 setup must pick the one whose `configuration.legs` is an object, or the server rejects `legs_to_win` under the strict schema. Pinned in Task 8.
5. **Career checkout stats with two sets each holding a leg sequence 1** — turns from different sets must not interleave. Pinned in Task 5.

---

## File Structure

| File | Responsibility |
| --- | --- |
| Create `app/src/modules/game/match-format.module.ts` | Pure fold: race target, leg-race winner, `foldMatch`, `matchFormatOf` (V1 adapter), `raceLabel`, `matchPositionOf` |
| Modify `app/src/modules/game/types.ts` | `RaceSpec`, `WinByTwo`, `MatchFormat`, `SetFold`, `MatchFold`; extend `FiveOhOneSideState`, `FiveOhOneState` |
| Modify `app/src/lib/game/rulesets/types.ts` | `FiveOhOneV2Config` zod, `FiveOhOneV2Snapshot`, `FiveOhOneAnySnapshot`, key unions/maps |
| Modify `app/src/modules/game/seat-rota.module.ts` | SHARED start index summed over the open leg's ancestors |
| Modify `app/src/modules/game/turn-log.module.ts` | Undo also pops a trailing childless `SET` |
| Modify `app/src/modules/game/five-oh-one.engine.module.ts` | Version-aware engine, stage tree, fold via `foldMatch`, `wouldComplete` via fold, V2 factory |
| Modify `app/src/services/rulesets/five-oh-one/five-oh-one.validator.ts`, `registry.ts` | `fiveOhOneV2Validator` |
| Modify `capabilities.ts`, `session-seats.service.ts`, `lib/stats/constants.ts`, `games-visibility.ts`, `session-progress.module.ts` | `501_V2` entries |
| Create `database/seeds/0037_five_oh_one_v2_game_engine_reference.sql`; modify `0007_…capabilities.sql`; create `database/verification/0037_five_oh_one_v2_capability_checks.sql` | Ruleset row, V2 template, capabilities |
| Modify `app/src/repositories/statistics.repository.ts`, `app/src/modules/stats/x01-checkout-sessions.module.ts`, `app/src/services/statistics.service.ts` | Tree-safe turn ordering |
| Modify `app/src/lib/stats/replay-presenters.ts` | Leg-win detection over all sets |
| Modify `app/src/lib/game/five-oh-one-play.data.ts`, `app/src/lib/game/types.ts`, `ComparisonSummary.astro` | Resume either key, subtitle, leg bars, results set score, play again |
| Modify `app/src/lib/game/five-oh-one-setup.data.ts`, `FiveOhOneSetupForm.astro`, `app/src/lib/game/types.ts` | V2 setup controls and preset choice |
| Docs: `decisions/game-engine.md`, `docs/game-rules/rulesets/501.md`, context map / File Inventory | Decision, version bump, registration |

---

### Task 1: V2 config schema and snapshot types

**Files:**
- Modify: `app/src/lib/game/rulesets/types.ts` (beside `FiveOhOneConfig` :193; unions :375-391; `RULESET_CONFIGS` :420; snapshots :503; `ConfigSnapshotFor` :570)
- Test: `app/tests/lib/game/rulesets/five-oh-one-v2-config.test.ts`

**Interfaces:**
- Produces: `FiveOhOneV2Config` (zod), `FiveOhOneV2ConfigData`, `FiveOhOneV2Snapshot`, `FiveOhOneAnySnapshot = FiveOhOneSnapshot | FiveOhOneV2Snapshot`, `"501_V2"` in `RulesetVersionKey`, `RULESET_CONFIGS["501_V2"]`, `ConfigSnapshotFor<"501_V2"> = FiveOhOneV2Snapshot`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { FiveOhOneV2Config } from "@lib/types";
import { toSnapshot } from "@lib/game/rulesets/config-codec";

const base = {
  starting_score: 501,
  check_in: "STRAIGHT_IN",
  check_out: "DOUBLE_OUT",
  max_darts_per_turn: 3,
  max_visit_score: 180,
  legs: { mode: "FIRST_TO", count: 3 },
  sets: null,
  win_by_two: null,
};

describe("FiveOhOneV2Config", () => {
  it("accepts a first-to legs match", () => {
    expect(FiveOhOneV2Config.safeParse(base).success).toBe(true);
  });

  it("accepts sets with best-of legs and a deciding-set margin", () => {
    const config = {
      ...base,
      legs: { mode: "BEST_OF", count: 5 },
      sets: { mode: "BEST_OF", count: 3 },
      win_by_two: { cap: 5, scope: "DECIDING_SET" },
    };
    expect(FiveOhOneV2Config.safeParse(config).success).toBe(true);
  });

  it.each([
    ["even best-of legs", { legs: { mode: "BEST_OF", count: 4 } }],
    ["even best-of sets", { sets: { mode: "BEST_OF", count: 2 } }],
    ["legs count 0", { legs: { mode: "FIRST_TO", count: 0 } }],
    ["legs count 21", { legs: { mode: "FIRST_TO", count: 21 } }],
    ["cap below target", { win_by_two: { cap: 2, scope: "EVERY_SET" } }],
    ["deciding set without sets", { win_by_two: { cap: 5, scope: "DECIDING_SET" } }],
    ["a V1 legs_to_win key", { legs_to_win: 3 }],
  ])("rejects %s", (_label, patch) => {
    expect(FiveOhOneV2Config.safeParse({ ...base, ...patch }).success).toBe(false);
  });

  it("decodes to a camelCase snapshot with nested keys untouched", () => {
    const snapshot = toSnapshot("501_V2", {
      ...base,
      win_by_two: { cap: 5, scope: "EVERY_SET" },
    });
    expect(snapshot.winByTwo).toEqual({ cap: 5, scope: "EVERY_SET" });
    expect(snapshot.legs).toEqual({ mode: "FIRST_TO", count: 3 });
    expect(snapshot.sets).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/lib/game/rulesets/five-oh-one-v2-config.test.ts`
Expected: FAIL — `FiveOhOneV2Config` is not exported.

- [ ] **Step 3: Implement**

Below `FiveOhOneConfig` in `types.ts`:

```ts
const RaceSpecSchema = z
  .object({
    mode: z.enum(["FIRST_TO", "BEST_OF"]),
    count: z.number().int().min(1).max(20),
  })
  .strict();

function raceTargetOf(race: { mode: "FIRST_TO" | "BEST_OF"; count: number }) {
  return race.mode === "FIRST_TO" ? race.count : (race.count + 1) / 2;
}

/**
 * 501 V2: the V1 fields plus a match format — a leg race (per set when `sets`
 * is set), optional sets, and an optional win-by-2 rule bounded by a
 * sudden-death `cap` (`docs/game-rules/rulesets/501.md`). Best of takes an odd
 * count only, so a match is never drawn.
 */
export const FiveOhOneV2Config = z
  .object({
    starting_score: z.number().int().min(2).default(501),
    check_in: z.enum(["STRAIGHT_IN"]),
    check_out: z.enum(["DOUBLE_OUT"]),
    max_darts_per_turn: z.number().int().min(1).max(3),
    max_visit_score: z.number().int().default(180),
    legs: RaceSpecSchema,
    sets: RaceSpecSchema.nullable(),
    win_by_two: z
      .object({
        cap: z.number().int(),
        scope: z.enum(["EVERY_SET", "DECIDING_SET"]),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .superRefine((config, ctx) => {
    for (const key of ["legs", "sets"] as const) {
      const race = config[key];
      if (race && race.mode === "BEST_OF" && race.count % 2 === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key, "count"],
          message: "best of takes an odd count",
        });
      }
    }
    const winByTwo = config.win_by_two;
    if (!winByTwo) return;
    if (winByTwo.cap < raceTargetOf(config.legs)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["win_by_two", "cap"],
        message: "cap must be at least the leg target",
      });
    }
    if (winByTwo.scope === "DECIDING_SET" && config.sets === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["win_by_two", "scope"],
        message: "deciding-set scope needs sets",
      });
    }
  });
```

Add `| "501_V2"` after `"501_V1"` in `RulesetVersionKey`; `"501_V2": FiveOhOneV2Config,` in `RULESET_CONFIGS`; `export type FiveOhOneV2ConfigData = z.infer<typeof FiveOhOneV2Config>;` beside `FiveOhOneConfigData`; after `FiveOhOneSnapshot`:

```ts
export type FiveOhOneV2Snapshot = {
  startingScore: FiveOhOneV2ConfigData["starting_score"];
  checkIn: FiveOhOneV2ConfigData["check_in"];
  checkOut: FiveOhOneV2ConfigData["check_out"];
  maxDartsPerTurn: FiveOhOneV2ConfigData["max_darts_per_turn"];
  maxVisitScore: FiveOhOneV2ConfigData["max_visit_score"];
  legs: FiveOhOneV2ConfigData["legs"];
  sets: FiveOhOneV2ConfigData["sets"];
  winByTwo: FiveOhOneV2ConfigData["win_by_two"];
};

/** Either 501 snapshot; `matchFormatOf` normalises both (match-format.module.ts). */
export type FiveOhOneAnySnapshot = FiveOhOneSnapshot | FiveOhOneV2Snapshot;
```

In `ConfigSnapshotFor`, replace `: K extends "501_V1" ? FiveOhOneSnapshot` with `: K extends "501_V1" ? FiveOhOneSnapshot : K extends "501_V2" ? FiveOhOneV2Snapshot` (keep the rest of the chain).

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- tests/lib/game/rulesets/five-oh-one-v2-config.test.ts` → PASS. Then `npx tsc --noEmit -p .` → expect errors only from `Record<RulesetVersionKey, …>` maps missing `"501_V2"` (capabilities, session-progress, etc.). Note them; Task 4 fills them. If the type gate blocks the commit, add the missing entries now pointing at the V1 values and let Task 4 confirm them.

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/rulesets/types.ts tests/lib/game/rulesets/five-oh-one-v2-config.test.ts
git commit -m "feat(501): V2 config schema and snapshot types"
```

---

### Task 2: Match-format fold

**Files:**
- Create: `app/src/modules/game/match-format.module.ts`
- Modify: `app/src/modules/game/types.ts`
- Test: `app/tests/modules/game/match-format.module.test.ts`

**Interfaces:**
- Consumes: `FiveOhOneAnySnapshot` (Task 1).
- Produces (exact):
  - types in `modules/game/types.ts`: `RaceSpec = { mode: "FIRST_TO" | "BEST_OF"; count: number }`, `WinByTwo = { cap: number; scope: "EVERY_SET" | "DECIDING_SET" }`, `MatchFormat = { legs: RaceSpec; sets: RaceSpec | null; winByTwo: WinByTwo | null }`, `SetFold = { legsWon: Readonly<Record<string, number>>; winner: string | null }`, `MatchFold = { sets: SetFold[]; setsWon: Record<string, number>; winner: string | null; decidingSet: boolean; suddenDeath: boolean }`.
  - functions: `raceTarget(race: RaceSpec): number`, `legRaceWinner(legsWon, sideKeys, target, margin: WinByTwo | null): string | null`, `foldMatch(format, sideKeys, legWinnersBySet): MatchFold`, `matchFormatOf(config: FiveOhOneAnySnapshot): MatchFormat`, `raceLabel(race: RaceSpec): string` (`"First to 3"` / `"Best of 5"`), `matchPositionOf(stages: readonly StageFact[]): { set: number | null; leg: number }`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  foldMatch,
  legRaceWinner,
  matchFormatOf,
  matchPositionOf,
  raceLabel,
  raceTarget,
} from "@modules/game/match-format.module";
import type { MatchFormat, StageFact } from "@modules/types";

const AB = ["A", "B"];
const ABC = ["A", "B", "C"];
const legsOnly = (count: number, mode: "FIRST_TO" | "BEST_OF" = "FIRST_TO"): MatchFormat => ({
  legs: { mode, count },
  sets: null,
  winByTwo: null,
});
const repeat = (side: string, n: number) => Array.from({ length: n }, () => side);

describe("raceTarget", () => {
  it.each([
    [{ mode: "FIRST_TO", count: 3 }, 3],
    [{ mode: "BEST_OF", count: 5 }, 3],
    [{ mode: "BEST_OF", count: 1 }, 1],
  ] as const)("%j → %i", (race, target) => {
    expect(raceTarget(race)).toBe(target);
  });
});

describe("legRaceWinner", () => {
  const margin = { cap: 5, scope: "EVERY_SET" as const };
  it.each([
    ["no margin, reaches target", { A: 3, B: 2 }, AB, null, "A"],
    ["no margin, short", { A: 2, B: 2 }, AB, null, null],
    ["margin, 3-2 plays on", { A: 3, B: 2 }, AB, margin, null],
    ["margin, 4-2 wins", { A: 4, B: 2 }, AB, margin, "A"],
    ["margin, 5-5 plays on", { A: 5, B: 5 }, AB, margin, null],
    ["margin, 6-5 sudden death win", { A: 6, B: 5 }, AB, margin, "A"],
    ["3 sides, lead over runner-up only", { A: 4, B: 3, C: 0 }, ABC, margin, null],
    ["3 sides, 2 clear of all", { A: 5, B: 3, C: 1 }, ABC, margin, "A"],
  ] as const)("%s", (_label, legsWon, sides, m, expected) => {
    expect(legRaceWinner(legsWon, sides, 3, m)).toBe(expected);
  });
});

describe("foldMatch", () => {
  it("first to 2 legs, no sets: winner after two legs", () => {
    const fold = foldMatch(legsOnly(2), AB, [["A", "B", "A"]]);
    expect(fold.winner).toBe("A");
    expect(fold.sets).toEqual([{ legsWon: { A: 2, B: 1 }, winner: "A" }]);
    expect(fold.decidingSet).toBe(false);
  });

  it("best of 5 legs ends at 3", () => {
    expect(foldMatch(legsOnly(5, "BEST_OF"), AB, [["A", "A", "A"]]).winner).toBe("A");
  });

  it("no legs played yet: one empty open set", () => {
    const fold = foldMatch(legsOnly(1), AB, []);
    expect(fold.sets).toEqual([{ legsWon: { A: 0, B: 0 }, winner: null }]);
    expect(fold.winner).toBeNull();
  });

  it("sets: first to 2 sets of first-to-2 legs", () => {
    const format: MatchFormat = {
      legs: { mode: "FIRST_TO", count: 2 },
      sets: { mode: "FIRST_TO", count: 2 },
      winByTwo: null,
    };
    const fold = foldMatch(format, AB, [["A", "A"], ["B", "B"], ["A", "B", "A"]]);
    expect(fold.setsWon).toEqual({ A: 2, B: 1 });
    expect(fold.winner).toBe("A");
  });

  it("deciding set: flagged when every side is one set short", () => {
    const format: MatchFormat = {
      legs: { mode: "FIRST_TO", count: 3 },
      sets: { mode: "FIRST_TO", count: 2 },
      winByTwo: { cap: 5, scope: "DECIDING_SET" },
    };
    const fold = foldMatch(format, AB, [repeat("A", 3), repeat("B", 3), ["A", "B", "A", "B", "A"]]);
    expect(fold.decidingSet).toBe(true);
    expect(fold.winner).toBeNull();
    expect(fold.sets[2]).toEqual({ legsWon: { A: 3, B: 2 }, winner: null });
  });

  it("deciding-set scope: earlier sets end at the plain target", () => {
    const format: MatchFormat = {
      legs: { mode: "FIRST_TO", count: 3 },
      sets: { mode: "FIRST_TO", count: 2 },
      winByTwo: { cap: 5, scope: "DECIDING_SET" },
    };
    const fold = foldMatch(format, AB, [["A", "B", "A", "B", "A"]]);
    expect(fold.sets[0]!.winner).toBe("A");
    expect(fold.decidingSet).toBe(false);
  });

  it("sudden death only when two sides sit at the cap", () => {
    const format: MatchFormat = {
      legs: { mode: "FIRST_TO", count: 3 },
      sets: null,
      winByTwo: { cap: 5, scope: "EVERY_SET" },
    };
    const atFiveFour = [...repeat("A", 5), ...repeat("B", 4)];
    expect(foldMatch(format, AB, [atFiveFour]).suddenDeath).toBe(false);
    expect(foldMatch(format, AB, [[...atFiveFour, "B"]]).suddenDeath).toBe(true);
    expect(foldMatch(format, AB, [[...atFiveFour, "B", "B"]]).winner).toBe("B");
  });

  it("3 sides: deciding set needs every side at target − 1", () => {
    const format: MatchFormat = {
      legs: { mode: "FIRST_TO", count: 1 },
      sets: { mode: "FIRST_TO", count: 2 },
      winByTwo: null,
    };
    expect(foldMatch(format, ABC, [["A"], ["B"], []]).decidingSet).toBe(false);
    expect(foldMatch(format, ABC, [["A"], ["B"], ["C"], []]).decidingSet).toBe(true);
  });
});

describe("matchFormatOf", () => {
  it("reads a V1 snapshot as first to legsToWin, no sets, no margin", () => {
    expect(
      matchFormatOf({
        startingScore: 501,
        legsToWin: 3,
        checkIn: "STRAIGHT_IN",
        checkOut: "DOUBLE_OUT",
        maxDartsPerTurn: 3,
        maxVisitScore: 180,
      }),
    ).toEqual(legsOnly(3));
  });

  it("passes a V2 snapshot's format through", () => {
    const format = matchFormatOf({
      startingScore: 501,
      checkIn: "STRAIGHT_IN",
      checkOut: "DOUBLE_OUT",
      maxDartsPerTurn: 3,
      maxVisitScore: 180,
      legs: { mode: "BEST_OF", count: 5 },
      sets: { mode: "FIRST_TO", count: 2 },
      winByTwo: null,
    });
    expect(format.sets).toEqual({ mode: "FIRST_TO", count: 2 });
  });
});

describe("raceLabel / matchPositionOf", () => {
  it("labels races", () => {
    expect(raceLabel({ mode: "FIRST_TO", count: 3 })).toBe("First to 3");
    expect(raceLabel({ mode: "BEST_OF", count: 5 })).toBe("Best of 5");
  });

  const stage = (clientKey: string, type: "SET" | "LEG", parent: string | null, sequence: number): StageFact => ({
    clientKey,
    stageTypeKey: type,
    parentClientKey: parent,
    sequence,
  });

  it("root legs: set null, leg = number of LEG stages", () => {
    expect(matchPositionOf([stage("leg-1", "LEG", null, 1), stage("leg-2", "LEG", null, 2)])).toEqual({ set: null, leg: 2 });
  });

  it("nested: set = open set's sequence, leg = open leg's sequence", () => {
    expect(
      matchPositionOf([
        stage("set-1", "SET", null, 1),
        stage("set-1-leg-1", "LEG", "set-1", 1),
        stage("set-2", "SET", null, 2),
        stage("set-2-leg-1", "LEG", "set-2", 1),
      ]),
    ).toEqual({ set: 2, leg: 1 });
  });

  it("empty log reads as leg 1", () => {
    expect(matchPositionOf([])).toEqual({ set: null, leg: 1 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/modules/game/match-format.module.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Append to `app/src/modules/game/types.ts`:

```ts
/** A race to a number of legs or sets (`501_V2`); `count` is odd under `BEST_OF`. */
export type RaceSpec = { mode: "FIRST_TO" | "BEST_OF"; count: number };

/** Win by 2 legs, bounded by sudden death at `cap`-`cap`. */
export type WinByTwo = { cap: number; scope: "EVERY_SET" | "DECIDING_SET" };

/** A 501 match format, normalised across ruleset versions (`matchFormatOf`). */
export type MatchFormat = {
  legs: RaceSpec;
  sets: RaceSpec | null;
  winByTwo: WinByTwo | null;
};

/** One set's leg tally and winner; a match without sets folds as one set. */
export type SetFold = {
  legsWon: Readonly<Record<string, number>>;
  winner: string | null;
};

export type MatchFold = {
  sets: SetFold[];
  setsWon: Record<string, number>;
  winner: string | null;
  decidingSet: boolean;
  suddenDeath: boolean;
};
```

Create `app/src/modules/game/match-format.module.ts`:

```ts
import type { FiveOhOneAnySnapshot } from "@lib/types";
import type {
  MatchFold,
  MatchFormat,
  RaceSpec,
  SetFold,
  StageFact,
  WinByTwo,
} from "./types";

/** Legs or sets a side needs: `count` for first to, `(count + 1) / 2` for best of. */
export function raceTarget(race: RaceSpec): number {
  return race.mode === "FIRST_TO" ? race.count : (race.count + 1) / 2;
}

/** `"First to 3"` / `"Best of 5"`. */
export function raceLabel(race: RaceSpec): string {
  return `${race.mode === "FIRST_TO" ? "First to" : "Best of"} ${race.count}`;
}

function tally(
  sideKeys: readonly string[],
  winners: readonly string[],
): Record<string, number> {
  const counts = Object.fromEntries(sideKeys.map((side) => [side, 0]));
  for (const winner of winners) counts[winner] = (counts[winner] ?? 0) + 1;
  return counts;
}

/**
 * The side that has won a leg race, or null. Without a margin, the first side
 * at `target`. With one, a side at `target` must lead every other side by 2;
 * a side at `cap + 1` wins regardless (sudden death).
 */
export function legRaceWinner(
  legsWon: Readonly<Record<string, number>>,
  sideKeys: readonly string[],
  target: number,
  margin: WinByTwo | null,
): string | null {
  for (const side of sideKeys) {
    const own = legsWon[side] ?? 0;
    if (margin === null) {
      if (own >= target) return side;
      continue;
    }
    if (own >= margin.cap + 1) return side;
    if (own < target) continue;
    const leadsAll = sideKeys.every(
      (other) => other === side || own - (legsWon[other] ?? 0) >= 2,
    );
    if (leadsAll) return side;
  }
  return null;
}

function isDecidingSet(
  format: MatchFormat,
  sideKeys: readonly string[],
  setsWon: Readonly<Record<string, number>>,
): boolean {
  if (format.sets === null) return false;
  const target = raceTarget(format.sets);
  return sideKeys.every((side) => (setsWon[side] ?? 0) === target - 1);
}

function marginFor(format: MatchFormat, deciding: boolean): WinByTwo | null {
  if (format.winByTwo === null) return null;
  return format.winByTwo.scope === "EVERY_SET" || deciding
    ? format.winByTwo
    : null;
}

/**
 * Folds leg winners, grouped by the set they were played in, into the match
 * score (`docs/game-rules/rulesets/501.md`). Grouping comes from the stage
 * tree; this never invents a set boundary. A match without sets is one
 * group. The fold stops at the set that decides the match.
 */
export function foldMatch(
  format: MatchFormat,
  sideKeys: readonly string[],
  legWinnersBySet: readonly (readonly string[])[],
): MatchFold {
  const setsWon = tally(sideKeys, []);
  const sets: SetFold[] = [];
  const groups = legWinnersBySet.length > 0 ? legWinnersBySet : [[]];
  const legTarget = raceTarget(format.legs);
  let winner: string | null = null;
  let decidingSet = false;
  let suddenDeath = false;

  for (const winners of groups) {
    decidingSet = isDecidingSet(format, sideKeys, setsWon);
    const margin = marginFor(format, decidingSet);
    const legsWon = tally(sideKeys, winners);
    const setWinner = legRaceWinner(legsWon, sideKeys, legTarget, margin);
    suddenDeath =
      margin !== null &&
      setWinner === null &&
      sideKeys.filter((side) => legsWon[side] === margin.cap).length >= 2;
    sets.push({ legsWon, winner: setWinner });
    if (setWinner === null) continue;
    setsWon[setWinner] = (setsWon[setWinner] ?? 0) + 1;
    if (format.sets === null || setsWon[setWinner]! >= raceTarget(format.sets)) {
      winner = setWinner;
      break;
    }
  }

  return { sets, setsWon, winner, decidingSet, suddenDeath };
}

/** Normalises either 501 snapshot; V1 reads as first to `legsToWin` legs, no sets, no margin. */
export function matchFormatOf(config: FiveOhOneAnySnapshot): MatchFormat {
  if ("legsToWin" in config) {
    return {
      legs: { mode: "FIRST_TO", count: config.legsToWin },
      sets: null,
      winByTwo: null,
    };
  }
  return { legs: config.legs, sets: config.sets, winByTwo: config.winByTwo };
}

/**
 * Where play stands: the open set's sequence (null without sets) and the open
 * leg's number — its sequence under a set, its count among root legs otherwise.
 */
export function matchPositionOf(stages: readonly StageFact[]): {
  set: number | null;
  leg: number;
} {
  const openLeg = stages.filter((stage) => stage.stageTypeKey === "LEG").at(-1);
  if (!openLeg) return { set: null, leg: 1 };
  if (openLeg.parentClientKey === null) {
    return {
      set: null,
      leg: stages.filter((stage) => stage.stageTypeKey === "LEG").length,
    };
  }
  const openSet = stages.find(
    (stage) => stage.clientKey === openLeg.parentClientKey,
  );
  return { set: openSet?.sequence ?? null, leg: openLeg.sequence };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- tests/modules/game/match-format.module.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/game/match-format.module.ts src/modules/game/types.ts tests/modules/game/match-format.module.test.ts
git commit -m "feat(501): match-format fold for sets, best-of and win by 2"
```

---

### Task 3: Seat rota over the stage tree; undo pops an empty set

**Files:**
- Modify: `app/src/modules/game/seat-rota.module.ts:79-85`
- Modify: `app/src/modules/game/turn-log.module.ts:270-279`
- Test: `app/tests/modules/game/seat-rota.module.test.ts`, `app/tests/modules/game/turn-log.module.test.ts`

**Interfaces:**
- Produces: `startIndexOf(stage: StageFact, stages: readonly StageFact[]): number` (exported from `seat-rota.module.ts`); `activeSeat` signature unchanged; `undoStagedTurn` signature unchanged.

- [ ] **Step 1: Write the failing tests**

Append to `seat-rota.module.test.ts` (reuses its `seats`, `leg`, `turn` helpers):

```ts
function set(sequence: number): StageFact {
  return { clientKey: `set-${sequence}`, stageTypeKey: "SET", parentClientKey: null, sequence };
}
function setLeg(setSequence: number, sequence: number): StageFact {
  return {
    clientKey: `set-${setSequence}-leg-${sequence}`,
    stageTypeKey: "LEG",
    parentClientKey: `set-${setSequence}`,
    sequence,
  };
}

describe("startIndexOf", () => {
  it("root leg: sequence − 1", () => {
    expect(startIndexOf(leg(3), [leg(1), leg(2), leg(3)])).toBe(2);
  });
  it("nested leg: (set − 1) + (leg − 1)", () => {
    const stages = [set(1), setLeg(1, 1), set(2), setLeg(2, 1), setLeg(2, 2)];
    expect(startIndexOf(setLeg(2, 2), stages)).toBe(2);
  });
});

describe("activeSeat with sets (SHARED)", () => {
  it.each([2, 3, 4])("set k opens on seat k with %i seats", (count) => {
    const roster = seats(count);
    for (let k = 1; k <= count + 1; k += 1) {
      const stages = [...Array.from({ length: k }, (_u, i) => set(i + 1)), setLeg(k, 1)];
      const facts: EngineFacts = { stages, turns: [] };
      expect(activeSeat(facts, roster, "SHARED")).toBe(roster[(k - 1) % count]);
    }
  });
  it("sets off: unchanged leg rotation", () => {
    const roster = seats(3);
    const facts: EngineFacts = { stages: [leg(1), leg(2)], turns: [] };
    expect(activeSeat(facts, roster, "SHARED")).toBe(roster[1]);
  });
});
```

Add `startIndexOf` to the file's import list.

Append to `turn-log.module.test.ts` (import `undoStagedTurn` if not yet imported; build turns with the file's existing helper or this literal):

```ts
describe("undoStagedTurn across a set boundary", () => {
  const stage = (clientKey: string, type: "SET" | "LEG", parent: string | null, sequence: number) => ({
    clientKey,
    stageTypeKey: type,
    parentClientKey: parent,
    sequence,
  });
  const visit = (stageClientKey: string, sequence: number) => ({
    clientKey: `t-${stageClientKey}-${sequence}`,
    stageClientKey,
    participantRef: "p0",
    sequence,
    completedAt: "2026-10-10T00:00:00.000Z",
    totalScore: 40,
    darts: [],
  });

  it("pops the new set and its first leg with the checkout that opened them", () => {
    const stages = [
      stage("set-1", "SET", null, 1),
      stage("set-1-leg-1", "LEG", "set-1", 1),
      stage("set-2", "SET", null, 2),
      stage("set-2-leg-1", "LEG", "set-2", 1),
    ];
    const turns = [visit("set-1-leg-1", 1)];
    expect(undoStagedTurn(turns, stages)).toBe(true);
    expect(stages.map((s) => s.clientKey)).toEqual(["set-1", "set-1-leg-1"]);
  });

  it("keeps a set that still holds a leg", () => {
    const stages = [
      stage("set-1", "SET", null, 1),
      stage("set-1-leg-1", "LEG", "set-1", 1),
      stage("set-1-leg-2", "LEG", "set-1", 2),
    ];
    const turns = [visit("set-1-leg-1", 1)];
    undoStagedTurn(turns, stages);
    expect(stages.map((s) => s.clientKey)).toEqual(["set-1", "set-1-leg-1"]);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- tests/modules/game/seat-rota.module.test.ts tests/modules/game/turn-log.module.test.ts`
Expected: FAIL — `startIndexOf` not exported; set-boundary undo leaves `set-2`.

- [ ] **Step 3: Implement**

`seat-rota.module.ts` — add above `activeSeat`:

```ts
/**
 * The 0-based rota index a leg opens on: the sum of `sequence − 1` over the
 * leg and its ancestors. Root legs keep `leg − 1`; a leg in set k starts at
 * `(k − 1) + (leg − 1)`, so set k opens on seat k (501.md, Per-set throw rotation).
 */
export function startIndexOf(
  stage: StageFact,
  stages: readonly StageFact[],
): number {
  let index = 0;
  let cursor: StageFact | undefined = stage;
  while (cursor) {
    index += cursor.sequence - 1;
    const parentKey: string | null = cursor.parentClientKey;
    cursor =
      parentKey === null
        ? undefined
        : stages.find((candidate) => candidate.clientKey === parentKey);
  }
  return index;
}
```

Import `StageFact` from `./types`. In `activeSeat`'s SHARED branch replace `startingSeatFor(openStage.sequence - 1, seats.length)` with `startingSeatFor(startIndexOf(openStage, facts.stages), seats.length)`.

`turn-log.module.ts` — replace `popStageOpenedBy`:

```ts
function popEmptyTrailingSet(stages: StageFact[]): void {
  const last = stages.at(-1);
  if (
    stages.length > 1 &&
    last?.stageTypeKey === "SET" &&
    !stages.some((stage) => stage.parentClientKey === last.clientKey)
  ) {
    stages.pop();
  }
}

/**
 * Pops the stage `record()` opened after the undone turn, and the `SET` that
 * opened with it when that leg was its only child.
 */
function popStageOpenedBy(stages: StageFact[], stageClientKey: string): void {
  const openStage = stages.at(-1);
  if (
    stages.length > 1 &&
    openStage &&
    openStage.clientKey !== stageClientKey
  ) {
    stages.pop();
    popEmptyTrailingSet(stages);
  }
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npm test -- tests/modules/game/` → all PASS (121 and existing 501 tests unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/modules/game/seat-rota.module.ts src/modules/game/turn-log.module.ts tests/modules/game/seat-rota.module.test.ts tests/modules/game/turn-log.module.test.ts
git commit -m "feat(501): per-set throw rotation and set-aware undo"
```

---

### Task 4: Version-aware engine, validator, seed and key wiring

**Files:**
- Modify: `app/src/modules/game/five-oh-one.engine.module.ts`
- Modify: `app/src/modules/game/types.ts` (`FiveOhOneSideState`, `FiveOhOneState`)
- Modify: `app/src/services/rulesets/five-oh-one/five-oh-one.validator.ts`, `app/src/services/rulesets/registry.ts`
- Modify: `app/src/lib/game/rulesets/capabilities.ts` (:40, :71, :93, :202), `app/src/services/session-seats.service.ts:20`, `app/src/lib/stats/constants.ts:11`, `app/src/modules/game/session-progress.module.ts:245` (map entry only; text in Task 6)
- Create: `database/seeds/0037_five_oh_one_v2_game_engine_reference.sql`, `database/verification/0037_five_oh_one_v2_capability_checks.sql`
- Modify: `database/seeds/0007_ruleset_version_capabilities.sql`
- Modify: `app/src/lib/game/five-oh-one-play.data.ts` (only: reference `"501_V2"` — see Step 3g)
- Test: `app/tests/modules/game/five-oh-one.engine.module.test.ts`, `app/tests/services/rulesets/five-oh-one.validator.test.ts` (create if absent; mirror the closest existing validator test's imports)

**Interfaces:**
- Consumes: Task 1 types; Task 2 `foldMatch`, `matchFormatOf`, `raceTarget`; Task 3 rota/undo.
- Produces:
  - `FiveOhOneSideState = { sideKey: string; legsWon: number; setsWon: number }` (`legsWon` = legs in the current set).
  - `FiveOhOneState` gains `sets: readonly SetFold[]`, `decidingSet: boolean`, `suddenDeath: boolean`.
  - `foldFiveOhOneState(facts, config: Seated<FiveOhOneAnySnapshot>): FiveOhOneState`; `legResultsOf(facts, config: Seated<FiveOhOneAnySnapshot>)`.
  - `class FiveOhOneEngine(config, prior?, rulesetVersionKey: "501_V1" | "501_V2" = "501_V1")`.
  - `fiveOhOneEngineFactory` (`501_V1`), `fiveOhOneV2EngineFactory` (`501_V2`), both registered.
  - `fiveOhOneV2Validator`.

- [ ] **Step 1: Write the failing engine tests**

Append to `five-oh-one.engine.module.test.ts` (reuses `SEATS`, `config`, `winOneLeg`):

```ts
import { fiveOhOneV2EngineFactory } from "@modules/game/five-oh-one.engine.module";
import type { FiveOhOneV2Snapshot } from "@lib/types";

const TWO_SEATS = [
  SEATS[0]!,
  { participantRef: "participant-2", displayName: "Guest", sideKey: "B", participantTypeKey: "GUEST" as const },
];

const v2Config = (patch: Partial<FiveOhOneV2Snapshot> = {}) =>
  ({
    startingScore: 501,
    checkIn: "STRAIGHT_IN",
    checkOut: "DOUBLE_OUT",
    maxDartsPerTurn: 3,
    maxVisitScore: 180,
    legs: { mode: "FIRST_TO", count: 1 },
    sets: { mode: "FIRST_TO", count: 2 },
    winByTwo: null,
    seats: TWO_SEATS,
    ...patch,
  }) satisfies Seated<FiveOhOneV2Snapshot>;

/** The seat that opens the leg throws 180, 180, 101 (others score 0) and stands on 40. */
function leaveOpenerOnForty(engine: FiveOhOneGameEngine): void {
  const opener = engine.state().activeParticipantRef;
  for (const score of [180, 180, 101]) {
    engine.record({ scoreAttempted: score });
    while (engine.state().activeParticipantRef !== opener) engine.record({ scoreAttempted: 0 });
  }
}

/** The seat that opens the leg wins it on a 40 checkout. */
function activeWinsLeg(engine: FiveOhOneGameEngine): FiveOhOneState {
  leaveOpenerOnForty(engine);
  return engine.record({ scoreAttempted: 40, finishedOnDouble: true });
}

describe("501_V2 factory", () => {
  it("registers under 501_V2 and reports that key", () => {
    expect(getEngineFactory("501_V2")).toBe(fiveOhOneV2EngineFactory);
    expect(fiveOhOneV2EngineFactory.create(v2Config()).rulesetVersionKey).toBe("501_V2");
  });
});

describe("501_V2 sets match", () => {
  it("opens set-1 and its first leg", () => {
    const engine = fiveOhOneV2EngineFactory.create(v2Config());
    expect(engine.facts().stages.map((s) => s.clientKey)).toEqual(["set-1", "set-1-leg-1"]);
  });

  it("a won set opens the next set; set 2 opens on seat 2", () => {
    const engine = fiveOhOneV2EngineFactory.create(v2Config());
    const state = activeWinsLeg(engine);
    expect(state.sets[0]!.winner).toBe("A");
    expect(engine.facts().stages.map((s) => s.clientKey)).toEqual([
      "set-1",
      "set-1-leg-1",
      "set-2",
      "set-2-leg-1",
    ]);
    expect(state.activeParticipantRef).toBe("participant-2");
    expect(state.sides.find((s) => s.sideKey === "A")).toEqual({ sideKey: "A", legsWon: 0, setsWon: 1 });
  });

  it("a second set won by the same side wins the match", () => {
    const engine = fiveOhOneV2EngineFactory.create(v2Config());
    activeWinsLeg(engine);
    leaveOpenerOnForty(engine);
    expect(engine.state().activeParticipantRef).toBe("participant-2");
    const state = engine.record({ scoreAttempted: 40, finishedOnDouble: true });
    expect(state.sides.map((side) => side.setsWon)).toEqual([1, 1]);
    expect(state.status).toBe("IN_PROGRESS");
    expect(state.decidingSet).toBe(true);
  });

  it("wouldComplete is true only for the checkout that wins the match", () => {
    const engine = fiveOhOneV2EngineFactory.create(v2Config({ sets: null }));
    leaveOpenerOnForty(engine);
    expect(engine.wouldComplete({ scoreAttempted: 40, finishedOnDouble: true })).toBe(true);
    expect(engine.wouldComplete({ scoreAttempted: 39 })).toBe(false);
  });

  it("a set-winning checkout is not match-winning", () => {
    const engine = fiveOhOneV2EngineFactory.create(v2Config());
    leaveOpenerOnForty(engine);
    expect(engine.wouldComplete({ scoreAttempted: 40, finishedOnDouble: true })).toBe(false);
  });

  it("rehydrate and undo are exact inverses across a set boundary", () => {
    const engine = fiveOhOneV2EngineFactory.create(v2Config());
    leaveOpenerOnForty(engine);
    const beforeFacts = engine.facts();
    const beforeState = engine.state();
    engine.record({ scoreAttempted: 40, finishedOnDouble: true });
    const rebuilt = fiveOhOneV2EngineFactory.create(v2Config(), engine.facts());
    expect(rebuilt.state()).toEqual(engine.state());
    expect(rebuilt.undo()).toBe(true);
    expect(rebuilt.facts().stages).toEqual(beforeFacts.stages);
    expect(rebuilt.state()).toEqual(beforeState);
  });

  it("win by 2 plays past the target", () => {
    const engine = fiveOhOneV2EngineFactory.create(
      v2Config({ sets: null, winByTwo: { cap: 3, scope: "EVERY_SET" } }),
    );
    const afterOne = activeWinsLeg(engine);
    expect(afterOne.status).toBe("IN_PROGRESS");
  });

  it("throws on a LEG whose SET parent is missing", () => {
    expect(() =>
      fiveOhOneV2EngineFactory
        .create(v2Config(), {
          stages: [{ clientKey: "set-1-leg-1", stageTypeKey: "LEG", parentClientKey: "set-1", sequence: 1 }],
          turns: [],
        })
        .state(),
    ).toThrow(/unknown set/);
  });

  it("throws on a SET stage under a sets-off format", () => {
    expect(() =>
      fiveOhOneV2EngineFactory
        .create(v2Config({ sets: null }), {
          stages: [{ clientKey: "set-1", stageTypeKey: "SET", parentClientKey: null, sequence: 1 }],
          turns: [],
        })
        .state(),
    ).toThrow(/sets are off/);
  });
});

describe("501_V1 golden", () => {
  it("folds a three-leg V1 log exactly as before", () => {
    const engine = new FiveOhOneEngine({ ...config(), legsToWin: 3 });
    winOneLeg(engine);
    winOneLeg(engine);
    const state = engine.state();
    expect(state.status).toBe("IN_PROGRESS");
    expect(state.sides).toEqual([{ sideKey: "A", legsWon: 2, setsWon: 0 }]);
    expect(engine.facts().stages.map((s) => [s.clientKey, s.parentClientKey, s.sequence])).toEqual([
      ["leg-1", null, 1],
      ["leg-2", null, 2],
      ["leg-3", null, 3],
    ]);
    expect(engine.rulesetVersionKey).toBe("501_V1");
  });
});
```

Also update the existing assertions in this file that compare `sides` to `{ sideKey, legsWon }` literals: add `setsWon` (0 while the match is open, 1 for the winning side once `WON`). Run the file first and fix each such literal; do not change any other expectation.

Validator test (`tests/services/rulesets/five-oh-one.validator.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import { fiveOhOneV2Validator } from "@services/rulesets/five-oh-one/five-oh-one.validator";
import { getRulesetValidator } from "@services/rulesets/registry";

const config = {
  starting_score: 501,
  check_in: "STRAIGHT_IN",
  check_out: "DOUBLE_OUT",
  max_darts_per_turn: 3,
  max_visit_score: 180,
  legs: { mode: "FIRST_TO", count: 1 },
  sets: null,
  win_by_two: null,
};

describe("fiveOhOneV2Validator", () => {
  it("is registered under 501_V2", () => {
    expect(getRulesetValidator("501_V2")).toBe(fiveOhOneV2Validator);
  });
  it("accepts a V2 config under QUICK_SCORE", () => {
    expect(
      fiveOhOneV2Validator.validateConfig({ config, captureModeKey: "RECREATIONAL", inputModeKey: "QUICK_SCORE" }).valid,
    ).toBe(true);
  });
  it("rejects a V1-shaped config", () => {
    expect(
      fiveOhOneV2Validator.validateConfig({
        config: { ...config, legs_to_win: 1 },
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
      }).valid,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- tests/modules/game/five-oh-one.engine.module.test.ts tests/services/rulesets/five-oh-one.validator.test.ts`
Expected: FAIL — `fiveOhOneV2EngineFactory`/`fiveOhOneV2Validator` not exported.

- [ ] **Step 3a: State types** — in `modules/game/types.ts`:

```ts
export type FiveOhOneSideState = {
  sideKey: string;
  legsWon: number;
  setsWon: number;
};

export type FiveOhOneState = MultiSeatState<FiveOhOneSeatState> & {
  status: "IN_PROGRESS" | "WON";
  winningSideKey: string | null;
  sides: readonly FiveOhOneSideState[];
  sets: readonly SetFold[];
  decidingSet: boolean;
  suddenDeath: boolean;
};
```

Update the `FiveOhOneSideState` doc comment: legs won in the current set; sets won in the match.

- [ ] **Step 3b: Engine fold** — in `five-oh-one.engine.module.ts`:

1. Change every `Seated<FiveOhOneSnapshot>` to `Seated<FiveOhOneAnySnapshot>` (import from `@lib/types`), and add imports `foldMatch`, `matchFormatOf` from `./match-format.module`.
2. Add stage builders beside `legStage`:

```ts
function setStage(sequence: number): StageFact {
  return {
    clientKey: `set-${sequence}`,
    stageTypeKey: "SET",
    parentClientKey: null,
    sequence,
  };
}

function setLegStage(setSequence: number, sequence: number): StageFact {
  return {
    clientKey: `set-${setSequence}-leg-${sequence}`,
    stageTypeKey: "LEG",
    parentClientKey: `set-${setSequence}`,
    sequence,
  };
}

/** The stages a fresh match opens on: one root leg, or set 1 and its first leg. */
function openingStages(config: FiveOhOneAnySnapshot): StageFact[] {
  return matchFormatOf(config).sets === null
    ? [legStage(1)]
    : [setStage(1), setLegStage(1, 1)];
}
```

3. Add the grouping fold above `foldFiveOhOneState`:

```ts
type LegFold = {
  winnersBySet: string[][];
  remaining: Map<string, number>;
};

/**
 * Folds every LEG in play order, grouping winners by their SET parent (root
 * legs form one group).
 * @throws when the tree contradicts the format: a LEG naming an unknown set,
 *   a SET under a sets-off format, or a root LEG under a sets-on format.
 */
function foldLegs(
  facts: EngineFacts,
  config: Seated<FiveOhOneAnySnapshot>,
): LegFold {
  const setsOn = matchFormatOf(config).sets !== null;
  const remaining = new Map(
    config.seats.map((seat) => [seat.participantRef, config.startingScore]),
  );
  const winnersBySet: string[][] = [];
  const groupOf = new Map<string | null, number>();

  for (const stage of facts.stages) {
    if (stage.stageTypeKey === "SET") {
      if (!setsOn) {
        throw new Error(`501: set ${stage.clientKey} recorded while sets are off.`);
      }
      groupOf.set(stage.clientKey, winnersBySet.push([]) - 1);
      continue;
    }
    if (stage.parentClientKey === null && setsOn) {
      throw new Error(`501: root leg ${stage.clientKey} recorded while sets are on.`);
    }
    let group = groupOf.get(stage.parentClientKey);
    if (group === undefined) {
      if (stage.parentClientKey !== null) {
        throw new Error(
          `501: leg ${stage.clientKey} names unknown set ${stage.parentClientKey}.`,
        );
      }
      group = winnersBySet.push([]) - 1;
      groupOf.set(null, group);
    }
    const winner = foldLeg(legVisitsOf(facts, stage), config, remaining);
    if (winner) winnersBySet[group]!.push(winner.sideKey);
  }

  return { winnersBySet, remaining };
}
```

4. Replace the body of `foldFiveOhOneState`:

```ts
export function foldFiveOhOneState(
  facts: EngineFacts,
  config: Seated<FiveOhOneAnySnapshot>,
): FiveOhOneState {
  const sideKeys = sidesOf(config.seats);
  const { winnersBySet, remaining } = foldLegs(facts, config);
  const fold = foldMatch(matchFormatOf(config), sideKeys, winnersBySet);
  if (fold.sets.slice(0, -1).some((set) => set.winner === null)) {
    throw new Error("501: a set was opened before the previous set was won.");
  }
  if (fold.winner !== null && winnersBySet.length > fold.sets.length) {
    throw new Error("501: stages recorded after the match was won.");
  }
  const currentSet = fold.sets.at(-1)!;

  return {
    activeParticipantRef: activeSeat(facts, config.seats, "SHARED")
      .participantRef,
    status: fold.winner === null ? "IN_PROGRESS" : "WON",
    winningSideKey: fold.winner,
    sides: sideKeys.map((sideKey) => ({
      sideKey,
      legsWon: currentSet.legsWon[sideKey] ?? 0,
      setsWon: fold.setsWon[sideKey] ?? 0,
    })),
    seats: seatStatesOf(config, remaining, fold.winner),
    sets: fold.sets,
    decidingSet: fold.decidingSet,
    suddenDeath: fold.suddenDeath,
  };
}
```

Update its JSDoc: "The session reaches `WON` when `foldMatch` names a winner (match-format.module.ts)". Note: with sets off, `setsWon` reads 1 for the winning side once won (the implicit set) — the V1 golden test above expects `setsWon: 0` mid-match and the existing `WON` literals get `setsWon: 1`.

5. In `legResultsOf`, skip non-legs: first line in the loop `if (stage.stageTypeKey !== "LEG") continue;`. Change its `remaining` handling to nothing else.

- [ ] **Step 3c: Engine class**

```ts
export class FiveOhOneEngine implements GameEngine<FiveOhOneInput, FiveOhOneState> {
  readonly stageOwnership = "SHARED" as const;
  private readonly stages: StageFact[];
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: Seated<FiveOhOneAnySnapshot>,
    prior?: EngineFacts,
    readonly rulesetVersionKey: "501_V1" | "501_V2" = "501_V1",
  ) {
    this.stages =
      prior && prior.stages.length > 0
        ? prior.stages.map((stage) => ({ ...stage }))
        : openingStages(config);
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }
```

Replace `openLeg()`'s body lookup with the last LEG: `const stage = this.stages.filter((s) => s.stageTypeKey === "LEG").at(-1);` (LEG is always pushed last, but this keeps `openLeg` honest).

Add:

```ts
  /** Opens the next leg after a leg win: a new set when the fold closed the current one. */
  private openNextLeg(state: FiveOhOneState): void {
    if (matchFormatOf(this.config).sets === null) {
      this.stages.push(legStage(this.stages.length + 1));
      return;
    }
    const openSet = this.stages.filter((s) => s.stageTypeKey === "SET").at(-1)!;
    if (state.sets.at(-1)?.winner != null) {
      const next = openSet.sequence + 1;
      this.stages.push(setStage(next), setLegStage(next, 1));
      return;
    }
    const legsInSet = this.stages.filter(
      (s) => s.parentClientKey === openSet.clientKey,
    ).length;
    this.stages.push(setLegStage(openSet.sequence, legsInSet + 1));
  }

  /** Whether a checkout by the active seat would win the match (`foldMatch`). */
  private checkoutWinsMatch(before: FiveOhOneState): boolean {
    const seat = before.seats.find(
      (candidate) => candidate.participantRef === before.activeParticipantRef,
    );
    if (!seat) return false;
    const { winnersBySet } = foldLegs(
      { stages: this.stages, turns: this.turns },
      this.config,
    );
    const groups = winnersBySet.map((group) => [...group]);
    if (groups.length === 0) groups.push([]);
    groups.at(-1)!.push(seat.sideKey);
    return (
      foldMatch(matchFormatOf(this.config), sidesOf(this.config.seats), groups)
        .winner !== null
    );
  }
```

In `recordVisitTotal` replace `this.stages.push(legStage(this.stages.length + 1)); return this.deriveState();` with `this.openNextLeg(settled); return this.deriveState();`. Same in `recordDart`. In `dartChecksOutFinalLeg` and `wouldComplete`, replace the trailing `seat`/`side`/`legsWon + 1 >= legsToWin` block with `return this.checkoutWinsMatch(before);`. Update the class JSDoc first line to "501: a match in the format `matchFormatOf(config)` names…" and drop "a match of `legsToWin` legs".

Factories at the bottom:

```ts
export const fiveOhOneEngineFactory: GameEngineFactory<
  Seated<FiveOhOneSnapshot>,
  FiveOhOneInput,
  FiveOhOneState
> = {
  rulesetVersionKey: "501_V1",
  stageOwnership: "SHARED",
  create(config: Seated<FiveOhOneSnapshot>, prior?: EngineFacts) {
    return new FiveOhOneEngine(config, prior, "501_V1");
  },
};

registerEngineFactory(fiveOhOneEngineFactory);

export const fiveOhOneV2EngineFactory: GameEngineFactory<
  Seated<FiveOhOneV2Snapshot>,
  FiveOhOneInput,
  FiveOhOneState
> = {
  rulesetVersionKey: "501_V2",
  stageOwnership: "SHARED",
  create(config: Seated<FiveOhOneV2Snapshot>, prior?: EngineFacts) {
    return new FiveOhOneEngine(config, prior, "501_V2");
  },
};

registerEngineFactory(fiveOhOneV2EngineFactory);
```

- [ ] **Step 3d: Validator** — refactor `five-oh-one.validator.ts` into a factory and export both:

```ts
function createFiveOhOneValidator(
  label: string,
  schema: typeof FiveOhOneConfig | typeof FiveOhOneV2Config,
): RulesetValidator {
  return {
    validateConfig({ config, captureModeKey, inputModeKey }): ConfigValidationResult {
      if (!isQuickScoreOrVisualBoardCapture(captureModeKey, inputModeKey)) {
        return {
          valid: false,
          issues: [`${label} only supports ${QUICK_SCORE_OR_VISUAL_BOARD_MODES}`],
        };
      }
      const parsed = schema.safeParse(config);
      if (!parsed.success) {
        return { valid: false, issues: parsed.error.issues };
      }
      return { valid: true, config: parsed.data };
    },
    validateBatch,
  };
}

export const fiveOhOneValidator = createFiveOhOneValidator("501 V1", FiveOhOneConfig);
export const fiveOhOneV2Validator = createFiveOhOneValidator("501 V2", FiveOhOneV2Config);
```

where `validateBatch` is the existing `validateBatch` method lifted unchanged to a module-level `function validateBatch({...}): BatchValidationResult`. Keep the existing JSDoc on the factory. Registry: `import { fiveOhOneV2Validator } from "./five-oh-one/five-oh-one.validator";` and `"501_V2": fiveOhOneV2Validator,` after `"501_V1"`.

- [ ] **Step 3e: Key maps** — add a `"501_V2"` entry beside every `"501_V1"` entry, same value: `capabilities.ts` :40 (`[QUICK_SCORE, VISUAL_BOARD]`), :71 (`["board", "scoring", "checkout", "leg"]`), :93 (`"501"`), :202 (`true`; also add `501_V2` to the doc comment list at :179 that names `501_V1`); `session-seats.service.ts:20` (`4`); `lib/stats/constants.ts:11` (`"501_V2",`); `session-progress.module.ts:245` (`"501_V2": fiveOhOne,` — its config parameter type becomes `Seated<FiveOhOneAnySnapshot>`; the text change is Task 6). Leave `games-visibility.ts` for Task 8.

- [ ] **Step 3f: Seeds**

`database/seeds/0037_five_oh_one_v2_game_engine_reference.sql`:

```sql
-- ============================================================
-- Seed: 0037_five_oh_one_v2_game_engine_reference.sql
--
-- 501_V2: match formats (best of N, sets, win by 2 legs with a
-- sudden-death cap, deciding-set margin, per-set throw rotation;
-- docs/game-rules/rulesets/501.md). Same game type as 501_V1.
--
-- One configuration_templates row, V2-shaped: session creation
-- merges template.configuration with overrides and validates the
-- merge (session.service.ts), and the V1 presets carry
-- legs_to_win, which the strict FiveOhOneV2Config rejects. V2
-- setup selects this preset by configuration.legs being an object.
--
-- UUID allocation:
-- - 0198f100-...-000017 ruleset_versions (501_V2)
-- - 0198f300-...-000019 configuration_templates (501 — Match)
--
-- Capability rows are appended to seeds/0007 (the running
-- ledger); verification/0037_five_oh_one_v2_capability_checks.sql
-- asserts them.
-- ============================================================
BEGIN;

INSERT INTO ruleset_versions (
        id,
        game_type_id,
        implementation_key,
        version_number,
        description,
        created_at
    )
VALUES (
        '0198f100-0000-7000-8000-000000000017',
        '0198f000-0000-7000-8000-000000000001',
        '501_V2',
        2,
        '501 V2: best of N legs or sets (odd N), sets of legs, optional win by 2 legs with a sudden-death cap and every-set or deciding-set scope, per-set throw rotation. In/out rules unchanged from V1.',
        now()
    ) ON CONFLICT (id) DO NOTHING;

INSERT INTO configuration_templates (
        id,
        game_type_id,
        player_id,
        name,
        description,
        configuration,
        is_system_template,
        created_at,
        updated_at
    )
VALUES (
        '0198f300-0000-7000-8000-000000000019',
        '0198f000-0000-7000-8000-000000000001',
        NULL,
        '501 — Match',
        'Match format chosen at setup, double out.',
        '{
            "starting_score": 501,
            "check_in": "STRAIGHT_IN",
            "check_out": "DOUBLE_OUT",
            "max_darts_per_turn": 3,
            "max_visit_score": 180,
            "legs": {"mode": "FIRST_TO", "count": 1},
            "sets": null,
            "win_by_two": null
        }'::jsonb,
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;

COMMIT;
```

In `0007_ruleset_version_capabilities.sql` add after the two `501_V1` lines:

```sql
            ('501_V2', 'RECREATIONAL', 'QUICK_SCORE'),
            ('501_V2', 'ANALYTICS', 'VISUAL_BOARD'),
```

`database/verification/0037_five_oh_one_v2_capability_checks.sql`: copy `0012_shanghai_v2_capability_checks.sql` verbatim, then replace `SHANGHAI_V2` → `501_V2`, `DETAILED_DARTS` → `QUICK_SCORE` (step 1 only), the header's file name/seed numbers (`0012` → `0037`), and keep step 3 unchanged. Read the result whole before committing.

- [ ] **Step 3g: Play-data key reference** — in `five-oh-one-play.data.ts` replace `const RULESET_VERSION_KEY: RulesetVersionKey = "501_V1";` with:

```ts
const RULESET_VERSION_KEYS: readonly RulesetVersionKey[] = ["501_V1", "501_V2"];
```

and in `resumeEngine` replace the key guard/lookup with:

```ts
  if (!configSnapshot || !rulesetVersionKey) return null;
  if (!RULESET_VERSION_KEYS.includes(rulesetVersionKey)) return null;
  const factory = getEngineFactory(rulesetVersionKey);
```

In `playAgain` pass `this.$store.game.rulesetVersionKey as RulesetVersionKey` instead of `RULESET_VERSION_KEY` (its wire override is fixed in Task 7). Add `"501_V2"` cases to any other `RULESET_VERSION_KEY` use in the file the type checker flags, using the session's own key.

- [ ] **Step 4: Run to verify**

Run: `npm test -- tests/modules/game/ tests/services/rulesets/ tests/lib/game/` → PASS.
Run: `bash ../scripts/check-game-engines.sh` → PASS.
Run: `npx tsc --noEmit -p .` → 0 errors (remaining `legsToWin` reads on a V2 snapshot in play/setup/progress/components are typed against `FiveOhOneAnySnapshot`; where tsc flags `legsToWin` on the union, use `raceTarget(matchFormatOf(config).legs)` — the full UI work is Tasks 6–8).

- [ ] **Step 5: Commit**

```bash
git add -A src/modules/game src/services src/lib tests ../database/seeds ../database/verification
git commit -m "feat(501): version-aware engine, 501_V2 validator, seed and wiring"
```

---

### Task 5: Tree-safe ordering in checkout stats

**Files:**
- Modify: `app/src/repositories/statistics.repository.ts` (new read beside `findReplayStages` :1547)
- Modify: `app/src/modules/stats/x01-checkout-sessions.module.ts` (`stagesOf` :46-58, turn sort :115-121, `sessionCheckoutVisits`/`checkoutVisitsFromRows`/`checkoutVisitsWithSession` :285-335)
- Modify: `app/src/services/statistics.service.ts` (every `findX01CheckoutDarts` caller — find with `grep -n "findX01CheckoutDarts\|sessionCheckoutVisits\|checkoutVisitsWithSession\|checkoutVisitsFromRows" src/services/*.ts`)
- Test: `app/tests/modules/stats/x01-checkout-sessions.module.test.ts`, the repository's existing test file if it covers `findReplayStages`

**Interfaces:**
- Produces: `findSetSequences(db: Db, playerId: string): Promise<Map<string, number>>` (SET stage id → sequence); `sessionCheckoutVisits(rows, setSequences?: ReadonlyMap<string, number>)`, `checkoutVisitsFromRows(rows, setSequences?)`, `checkoutVisitsWithSession(rows, setSequences?)` — the new parameter defaults to an empty map, so V1-only callers are unchanged.

- [ ] **Step 1: Write the failing test**

Append to `x01-checkout-sessions.module.test.ts`, building rows with the file's existing row factory (read it first; it produces `X01CheckoutDartRow`s). The new case: one 501_V2 session (configuration `{ starting_score: 101, check_in, check_out, max_darts_per_turn: 3, max_visit_score: 180, legs: { mode: "FIRST_TO", count: 1 }, sets: { mode: "FIRST_TO", count: 2 }, win_by_two: null, seats: [solo] }`) with two LEG stages `L1` (parent `S1`) and `L2` (parent `S2`), **both** `stageSequence: 1`. Leg `L1`: visit 1 darts `S20,S20,S1` (41, leaves 60), visit 2 darts `S20,D20` (60, checkout). Leg `L2`: visit 1 darts `S20,S20,S20` (60, leaves 41), visit 2 darts `S1,D20` (41, checkout). Pass rows in the SQL's order (session, stageSequence, turnSequence — so L1 and L2 turns interleave) and `new Map([["S1", 1], ["S2", 2]])`.

```ts
it("keeps legs from different sets apart when they share a sequence", () => {
  const rows = nestedTwoSetRows();
  const [session] = sessionCheckoutVisits(rows, new Map([["S1", 1], ["S2", 2]]));
  expect(session!.visits.map((visit) => visit.stageId)).toEqual(["L1", "L1", "L2", "L2"]);
  expect(session!.visits.filter((visit) => visit.checkedOut)).toHaveLength(2);
});

it("orders V1 root legs exactly as before without a set map", () => {
  const rows = existingV1TwoLegRows();
  expect(sessionCheckoutVisits(rows)).toEqual(sessionCheckoutVisits(rows, new Map()));
});
```

Write `nestedTwoSetRows()` and reuse/derive `existingV1TwoLegRows()` from the file's own fixtures; use the visit field names the file's existing assertions use (`checkedOut` above stands for whichever field the module emits for a finished visit — read `CheckoutVisitTotals` in `modules/stats/types.ts` and use its exact name).

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/modules/stats/x01-checkout-sessions.module.test.ts`
Expected: FAIL — visits interleave (`L1, L2, L1, L2`) or the second argument is ignored.

- [ ] **Step 3: Implement**

In the module, thread `setSequences: ReadonlyMap<string, number> = new Map()` from `sessionCheckoutVisits` through `visitsForSession` into the turn builder. Replace the stage sort and turn sort with a shared key:

```ts
/**
 * Play-order key of a leg: `[set sequence, leg sequence]` for a leg nested
 * under a SET, `[leg sequence, 0]` for a root leg (501_V2 sets; D443).
 */
function legOrderKey(
  stage: { sequence: number; parentClientKey: string | null },
  setSequences: ReadonlyMap<string, number>,
): [number, number] {
  return stage.parentClientKey === null
    ? [stage.sequence, 0]
    : [setSequences.get(stage.parentClientKey) ?? 0, stage.sequence];
}

function compareKeys(a: [number, number], b: [number, number]): number {
  return a[0] - b[0] || a[1] - b[1];
}
```

`stagesOf(rows, setSequences)` sorts with `compareKeys(legOrderKey(a, setSequences), legOrderKey(b, setSequences))`. The turn builder carries each turn's stage (`StagedTurn` gains `stage: { sequence: number; parentClientKey: string | null }` built from `row.stageSequence`/`row.parentStageId`) and sorts with `compareKeys(legOrderKey(a.stage, setSequences), legOrderKey(b.stage, setSequences)) || a.turn.sequence - b.turn.sequence`. Keep `checkoutVisitsFromRows`/`checkoutVisitsWithSession` passing `setSequences` through.

Repository, beside `findReplayStages`:

```ts
/**
 * Every SET stage's sequence for the player's sessions, from `v_replay_stages`
 * (0046) — the one ordering fact `v_x01_checkout_darts` lacks for a leg
 * nested under a set (501_V2).
 */
export async function findSetSequences(
  db: Db,
  playerId: string,
): Promise<Map<string, number>> {
  const rows = await db
    .select({ stageId: vReplayStages.stageId, sequence: vReplayStages.stageSequence })
    .from(vReplayStages)
    .where(and(eq(vReplayStages.playerId, playerId), eq(vReplayStages.stageTypeKey, "SET")));
  return new Map(
    rows.map((row) => [nonNull(row.stageId, "stage_id"), nonNull(row.sequence, "stage_sequence")]),
  );
}
```

Service: at each `findX01CheckoutDarts(db, playerId)` call, fetch `findSetSequences(db, playerId)` in the same `Promise.all` and pass the map to the `sessionCheckoutVisits`/`checkoutVisits*` call that consumes those rows. Update any service test mocks of the repository module to export `findSetSequences: vi.fn().mockResolvedValue(new Map())`.

- [ ] **Step 4: Run to verify**

Run: `npm test -- tests/modules/stats tests/services tests/repositories` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/repositories/statistics.repository.ts src/modules/stats/x01-checkout-sessions.module.ts src/services/statistics.service.ts tests
git commit -m "fix(stats): order nested 501 legs by set for checkout stats"
```

---

### Task 6: Resume progress text and replay leg-win detection

**Files:**
- Modify: `app/src/modules/game/session-progress.module.ts:88-106`
- Modify: `app/src/lib/stats/replay-presenters.ts:138-143`
- Test: `app/tests/modules/game/session-progress.module.test.ts`, the replay presenters test (`grep -rln "replay-presenters" tests`)

**Interfaces:**
- Consumes: `matchFormatOf`, `matchPositionOf`, `raceLabel`, `raceTarget` (Task 2); `FiveOhOneState.sets` (Task 4).

- [ ] **Step 1: Write the failing tests**

`session-progress.module.test.ts` (reuse its seat/facts helpers):

```ts
it("501_V2 with sets reads Set k · Leg n · First to S sets and the set tally", () => {
  const config = {
    startingScore: 501, checkIn: "STRAIGHT_IN", checkOut: "DOUBLE_OUT", maxDartsPerTurn: 3, maxVisitScore: 180,
    legs: { mode: "FIRST_TO", count: 1 }, sets: { mode: "BEST_OF", count: 3 }, winByTwo: null,
    seats: TWO_SEATS,
  } as const;
  const facts = {
    stages: [
      { clientKey: "set-1", stageTypeKey: "SET", parentClientKey: null, sequence: 1 },
      { clientKey: "set-1-leg-1", stageTypeKey: "LEG", parentClientKey: "set-1", sequence: 1 },
    ],
    turns: [],
  };
  expect(summarizeProgress("501_V2", config, facts).detail).toBe("vs Guest · Set 1 · Leg 1 · Best of 3 sets · 0–0");
});

it("501_V1 text is unchanged", () => {
  expect(summarizeProgress("501_V1", v1Config(3), oneLegFacts()).detail).toBe("vs Guest · Leg 1 · First to 3 · 0–0");
});
```

Use the file's existing names for the summarise function, seat fixture and joiner (read the file; if the existing V1 expectation string differs, copy it verbatim into the second test).

Replay presenter test:

```ts
it("detects a leg win at a set boundary, where current-set legsWon resets", () => {
  const before = { sides: [{ sideKey: "A", legsWon: 1, setsWon: 0 }], sets: [{ legsWon: { A: 1 }, winner: null }] };
  const after = { sides: [{ sideKey: "A", legsWon: 0, setsWon: 1 }], sets: [{ legsWon: { A: 2 }, winner: "A" }, { legsWon: { A: 0 }, winner: null }] };
  expect(legsWonIn(after)).toBeGreaterThan(legsWonIn(before));
});
```

Export `legsWonIn` from `replay-presenters.ts` for this test.

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- tests/modules/game/session-progress.module.test.ts <replay presenter test path>` → FAIL.

- [ ] **Step 3: Implement**

`session-progress.module.ts` `fiveOhOne`:

```ts
function fiveOhOne(
  config: Seated<FiveOhOneAnySnapshot>,
  facts: EngineFacts,
): SessionProgress {
  const state = foldFiveOhOneState(facts, config);
  const format = matchFormatOf(config);
  const position = matchPositionOf(facts.stages);
  const own = ownSeatOf(config.seats);
  const opponents = config.seats.filter((seat) => seat.sideKey !== own.sideKey);
  const tallyOf = (pick: (side: FiveOhOneSideState) => number) => {
    const mine = pick(state.sides.find((side) => side.sideKey === own.sideKey)!);
    const best = Math.max(0, ...state.sides.filter((side) => side.sideKey !== own.sideKey).map(pick));
    return `${mine}–${best}`;
  };
  return {
    detail: joinSubtitle([
      opponents.length > 0 ? `vs ${opponents.map((seat) => seat.displayName).join(" & ")}` : "",
      position.set === null ? "" : `Set ${position.set}`,
      `Leg ${position.leg}`,
      format.sets === null ? raceLabel(format.legs) : `${raceLabel(format.sets)} sets`,
      state.sides.length > 1
        ? tallyOf((side) => (format.sets === null ? side.legsWon : side.setsWon))
        : "",
    ]),
    big: big(
      state.seats.find((seat) => seat.participantRef === own.participantRef)?.remainingScore,
```

(keep the rest of the existing return unchanged). Imports: `matchFormatOf`, `matchPositionOf`, `raceLabel` from `./match-format.module`; `FiveOhOneSideState` from `./types`; `FiveOhOneAnySnapshot` from `@lib/types`.

`replay-presenters.ts`:

```ts
/** Legs won across every set so far — rises by one on every leg win, set boundaries included. */
export function legsWonIn(state: unknown): number {
  return (state as FiveOhOneState).sets.reduce(
    (sum, set) => sum + Object.values(set.legsWon).reduce((a, b) => a + b, 0),
    0,
  );
}
```

- [ ] **Step 4: Run to verify** — same command → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/game/session-progress.module.ts src/lib/stats/replay-presenters.ts tests
git commit -m "feat(501): set-aware resume text and replay leg wins"
```

---

### Task 7: Play page — subtitle, leg bars, results, play again

**Files:**
- Create: `app/src/lib/game/five-oh-one-match.ts` (pure display helpers)
- Modify: `app/src/lib/game/five-oh-one-play.data.ts` (`turnsInCurrentLeg` :307, `subtitle` :331, `legsToWin` :342, `buildResultsSnapshot` :204, `playAgain` :829)
- Modify: `app/src/lib/game/types.ts` (`FiveOhOneResultsSnapshot`, `FiveOhOnePlayContext` config type)
- Modify: `app/src/components/layout/games/ComparisonSummary.astro:30-36`
- Modify: `app/src/components/layout/games/result-modals/FiveOhOneResults.astro` (set score line)
- Test: `app/tests/lib/game/five-oh-one-match.test.ts`, existing `app/tests/lib/game/five-oh-one-play.data.test.ts`

**Interfaces:**
- Consumes: Task 2 helpers, Task 4 state.
- Produces: `fiveOhOneSubtitle(config: FiveOhOneAnySnapshot, stages: readonly StageFact[], state: FiveOhOneState | null): string`; `legBarCount(config, state): number`; `setScoreText(config, state, seats): string` (`"2–1"` in seat order, `""` without sets); `FiveOhOneResultsSnapshot` gains `legBarCount: number` and `setScore: string`.

- [ ] **Step 1: Write the failing test** (`five-oh-one-match.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import { fiveOhOneSubtitle, legBarCount, setScoreText } from "@lib/game/five-oh-one-match";

const v1 = { startingScore: 501, legsToWin: 3, checkIn: "STRAIGHT_IN", checkOut: "DOUBLE_OUT", maxDartsPerTurn: 3, maxVisitScore: 180 } as const;
const v2 = (patch = {}) => ({
  startingScore: 501, checkIn: "STRAIGHT_IN", checkOut: "DOUBLE_OUT", maxDartsPerTurn: 3, maxVisitScore: 180,
  legs: { mode: "BEST_OF", count: 5 }, sets: { mode: "FIRST_TO", count: 3 }, winByTwo: null, ...patch,
}) as const;
const rootLeg = (n: number) => ({ clientKey: `leg-${n}`, stageTypeKey: "LEG" as const, parentClientKey: null, sequence: n });
const state = (patch = {}) => ({
  activeParticipantRef: "a", status: "IN_PROGRESS" as const, winningSideKey: null,
  sides: [{ sideKey: "A", legsWon: 0, setsWon: 2 }, { sideKey: "B", legsWon: 0, setsWon: 1 }],
  seats: [], sets: [], decidingSet: false, suddenDeath: false, ...patch,
});

describe("fiveOhOneSubtitle", () => {
  it("V1 is unchanged", () => {
    expect(fiveOhOneSubtitle(v1, [rootLeg(1), rootLeg(2)], null)).toBe("LEG 2 · FIRST TO 3");
  });
  it("V2 legs only, best of", () => {
    expect(fiveOhOneSubtitle(v2({ sets: null }), [rootLeg(1)], null)).toBe("LEG 1 · BEST OF 5");
  });
  it("V2 sets with deciding set", () => {
    const stages = [
      { clientKey: "set-3", stageTypeKey: "SET" as const, parentClientKey: null, sequence: 3 },
      { clientKey: "set-3-leg-2", stageTypeKey: "LEG" as const, parentClientKey: "set-3", sequence: 2 },
    ];
    expect(fiveOhOneSubtitle(v2(), stages, state({ decidingSet: true }))).toBe("SET 3 · LEG 2 · FIRST TO 3 SETS · DECIDING SET");
  });
  it("sudden death outranks deciding set", () => {
    expect(fiveOhOneSubtitle(v2({ sets: null }), [rootLeg(9)], state({ suddenDeath: true, decidingSet: false }))).toBe("LEG 9 · BEST OF 5 · SUDDEN DEATH");
  });
});

describe("legBarCount", () => {
  it("is the leg target normally", () => {
    expect(legBarCount(v2(), state())).toBe(3);
    expect(legBarCount(v1, state())).toBe(3);
  });
  it("is cap + 1 once a side passes the target under win by 2", () => {
    const config = v2({ winByTwo: { cap: 5, scope: "EVERY_SET" } });
    expect(legBarCount(config, state({ sides: [{ sideKey: "A", legsWon: 3, setsWon: 0 }, { sideKey: "B", legsWon: 3, setsWon: 0 }] }))).toBe(6);
  });
});

describe("setScoreText", () => {
  it("reads sets won in seat order, blank without sets", () => {
    const seats = [{ sideKey: "A" }, { sideKey: "B" }];
    expect(setScoreText(v2(), state(), seats)).toBe("2–1");
    expect(setScoreText(v2({ sets: null }), state(), seats)).toBe("");
  });
});
```

Add to `five-oh-one-play.data.test.ts` a case that a `501_V2` session in the store resumes (`resumeEngine` path via the play data's init) and `turnsInCurrentLeg()` returns only the last LEG's turns when the last stage pushed before it is a SET — use the file's existing store fixture, swapping `rulesetVersionKey: "501_V2"` and a V2 `configSnapshot`.

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/lib/game/five-oh-one-match.test.ts tests/lib/game/five-oh-one-play.data.test.ts` → FAIL.

- [ ] **Step 3: Implement** `app/src/lib/game/five-oh-one-match.ts`:

```ts
import {
  matchFormatOf,
  matchPositionOf,
  raceLabel,
  raceTarget,
} from "@modules/game/match-format.module";
import type { FiveOhOneAnySnapshot } from "@lib/types";
import type { FiveOhOneState, StageFact } from "@modules/types";
import { joinSubtitle } from "./play-subtitle";

/** Play-header subtitle: `SET k · LEG n · FIRST TO S SETS`, or `LEG n · FIRST TO N` without sets, plus `SUDDEN DEATH` / `DECIDING SET`. */
export function fiveOhOneSubtitle(
  config: FiveOhOneAnySnapshot,
  stages: readonly StageFact[],
  state: FiveOhOneState | null,
): string {
  const format = matchFormatOf(config);
  const position = matchPositionOf(stages);
  const race =
    format.sets === null
      ? raceLabel(format.legs)
      : `${raceLabel(format.sets)} sets`;
  const flag = state?.suddenDeath
    ? "SUDDEN DEATH"
    : state?.decidingSet
      ? "DECIDING SET"
      : "";
  return joinSubtitle([
    position.set === null ? "" : `SET ${position.set}`,
    `LEG ${position.leg}`,
    race.toUpperCase(),
    flag,
  ]);
}

/** Leg bars to draw: the leg target, or `cap + 1` once a side passes it under win by 2. */
export function legBarCount(
  config: FiveOhOneAnySnapshot,
  state: FiveOhOneState | null,
): number {
  const format = matchFormatOf(config);
  const target = raceTarget(format.legs);
  const most = Math.max(0, ...(state?.sides ?? []).map((side) => side.legsWon));
  return format.winByTwo !== null && most >= target
    ? format.winByTwo.cap + 1
    : target;
}

/** Sets won per side in seat order (`"2–1"`); blank without sets. */
export function setScoreText(
  config: FiveOhOneAnySnapshot,
  state: FiveOhOneState | null,
  seats: readonly { sideKey: string }[],
): string {
  if (matchFormatOf(config).sets === null || !state) return "";
  return seats
    .map(
      (seat) =>
        state.sides.find((side) => side.sideKey === seat.sideKey)?.setsWon ?? 0,
    )
    .join("–");
}
```

Verify `joinSubtitle`'s module path with `grep -rn "export function joinSubtitle" src` and fix the import if it differs; confirm it drops empty strings and joins with `" · "` (the V1 test proves it).

Play data:
- `turnsInCurrentLeg`: `const openLeg = this.$store.game.stages.filter((stage) => stage.stageTypeKey === "LEG").at(-1);`
- `subtitle`: `const config = this.$store.game.configSnapshot; if (!config) return ""; return fiveOhOneSubtitle(config, this.$store.game.stages, this.state());`
- `legsToWin`: `const config = this.$store.game.configSnapshot; return config ? legBarCount(config, this.state()) : 0;` (keeps its name — `FiveOhOne.astro` binds `legsToWinExpr="legsToWin()"`; update its JSDoc to "Leg bars to draw for the current set").
- `buildResultsSnapshot`: add `legBarCount: config ? legBarCount(config, context.state()) : 0,` and `setScore: config ? setScoreText(config, context.state(), seats) : "",`.
- `playAgain`: replace the overrides builder with `(config) => ({ snapshot: config, wire: toWireConfig(rulesetVersionKey, config) })` where `rulesetVersionKey` is the session's key and `toWireConfig` comes from `@lib/game/rulesets/config-codec`; strip `seats` before converting exactly as the store keeps it out of the wire (read `runPlayAgain`'s callers in other play-data files for the pattern; if none strips, pass `{ legs_to_win: config.legsToWin }` for V1 and `{ legs, sets, win_by_two }` for V2 explicitly instead).
- `FiveOhOnePlayContext` / `FiveOhOneResultsSnapshot` in `lib/game/types.ts`: config snapshot type → `Seated<FiveOhOneAnySnapshot>`; add `legBarCount: number; setScore: string;`.

`ComparisonSummary.astro`: replace both `$store.game.configSnapshot?.legsToWin ?? 0` occurrences with `resultsSnapshot?.legBarCount ?? $store.game.configSnapshot?.legsToWin ?? 0` (other games set no `legBarCount`, so they fall through unchanged).

`FiveOhOneResults.astro`: above the existing leg comparison, add a line shown only with sets:

```astro
<p
  class="text-center text-sm font-semibold text-foreground"
  x-show="resultsSnapshot?.setScore"
  x-cloak
  x-text="`Sets ${resultsSnapshot?.setScore}`"
>
</p>
```

(match the surrounding markup's tokens; read the file first and place it where the winner headline sits.)

- [ ] **Step 4: Run to verify**

Run: `npm test -- tests/lib/game/` → PASS. `npx astro check --minimumFailingSeverity hint` → 0/0/0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/game src/components/layout/games tests/lib/game
git commit -m "feat(501): set-aware play subtitle, leg bars, results and play again"
```

---

### Task 8: Setup — V2 match format controls

**Files:**
- Modify: `app/src/lib/game/five-oh-one-setup.data.ts`
- Modify: `app/src/lib/game/types.ts` (`FiveOhOneSetupContext`)
- Modify: `app/src/components/layout/games/setup/FiveOhOneSetupForm.astro`
- Modify: `app/src/lib/game/rulesets/games-visibility.ts:17` (`"501_V2"`)
- Test: `app/tests/lib/game/five-oh-one-setup.data.test.ts`

**Interfaces:**
- Produces: setup state `matchMode: "FIRST_TO" | "BEST_OF"`, `matchUnit: "LEGS" | "SETS"`, `legsToWin` (the count stepper, unchanged name), `legsPerSetMode`, `legsPerSet`, `winByTwo: boolean`, `marginScope: "EVERY_SET" | "DECIDING_SET"`, `cap: number`; pure `buildFiveOhOneV2Wire(input): Record<string, unknown>` exported for tests; `isV2Preset(preset): boolean`.

- [ ] **Step 1: Write the failing tests**

```ts
import { buildFiveOhOneV2Wire, isV2Preset } from "@lib/game/five-oh-one-setup.data";

describe("isV2Preset", () => {
  it("picks the preset whose legs is an object", () => {
    expect(isV2Preset({ configuration: { legs: { mode: "FIRST_TO", count: 1 } } } as never)).toBe(true);
    expect(isV2Preset({ configuration: { legs_to_win: 1 } } as never)).toBe(false);
  });
});

describe("buildFiveOhOneV2Wire", () => {
  const base = { startingScore: 501, matchMode: "FIRST_TO", count: 3, matchUnit: "LEGS", legsPerSetMode: "BEST_OF", legsPerSet: 5, winByTwo: false, marginScope: "EVERY_SET", cap: 5 } as const;
  it("legs only", () => {
    expect(buildFiveOhOneV2Wire(base)).toEqual({ starting_score: 501, legs: { mode: "FIRST_TO", count: 3 }, sets: null, win_by_two: null });
  });
  it("sets: the count becomes the set race, legs per set the leg race", () => {
    expect(buildFiveOhOneV2Wire({ ...base, matchUnit: "SETS", winByTwo: true, marginScope: "DECIDING_SET", cap: 5 })).toEqual({
      starting_score: 501,
      legs: { mode: "BEST_OF", count: 5 },
      sets: { mode: "FIRST_TO", count: 3 },
      win_by_two: { cap: 5, scope: "DECIDING_SET" },
    });
  });
  it("legs only forces EVERY_SET scope", () => {
    expect(buildFiveOhOneV2Wire({ ...base, winByTwo: true, marginScope: "DECIDING_SET", cap: 5 }).win_by_two).toEqual({ cap: 5, scope: "EVERY_SET" });
  });
  it("best of with an even count rounds up to odd", () => {
    expect(buildFiveOhOneV2Wire({ ...base, matchMode: "BEST_OF", count: 4 }).legs).toEqual({ mode: "BEST_OF", count: 5 });
  });
  it("cap below the leg target is raised to the target", () => {
    expect(buildFiveOhOneV2Wire({ ...base, count: 3, winByTwo: true, cap: 1 }).win_by_two).toEqual({ cap: 3, scope: "EVERY_SET" });
  });
});
```

Also add a `start()` test in the file's existing style asserting `createSession` was called with `rulesetVersionKey: "501_V2"`, `templateRef` of the V2 preset (fixture presets: both V1 rows plus `{ configurationTemplateId: "v2", configuration: { legs: {...}, sets: null, win_by_two: null, ... } }`), and overrides equal to `buildFiveOhOneV2Wire(...)`.

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- tests/lib/game/five-oh-one-setup.data.test.ts` → FAIL.

- [ ] **Step 3: Implement** in `five-oh-one-setup.data.ts`:

```ts
const RULESET_VERSION_KEY = "501_V2";

/** A V2-shaped preset: `configuration.legs` is an object (seed 0037). */
export function isV2Preset(preset: ConfigurationPresetData | undefined): boolean {
  const legs = preset?.configuration?.legs;
  return typeof legs === "object" && legs !== null;
}

type V2WireInput = {
  startingScore: number;
  matchMode: "FIRST_TO" | "BEST_OF";
  count: number;
  matchUnit: "LEGS" | "SETS";
  legsPerSetMode: "FIRST_TO" | "BEST_OF";
  legsPerSet: number;
  winByTwo: boolean;
  marginScope: "EVERY_SET" | "DECIDING_SET";
  cap: number;
};

function oddFor(mode: "FIRST_TO" | "BEST_OF", count: number): number {
  return mode === "BEST_OF" && count % 2 === 0 ? count + 1 : count;
}

/** The V2 overrides `start()` sends; mirrors FiveOhOneV2Config's refinements so the server never rejects them. */
export function buildFiveOhOneV2Wire(input: V2WireInput): Record<string, unknown> {
  const outer = { mode: input.matchMode, count: oddFor(input.matchMode, input.count) };
  const setsOn = input.matchUnit === "SETS";
  const legs = setsOn
    ? { mode: input.legsPerSetMode, count: oddFor(input.legsPerSetMode, input.legsPerSet) }
    : outer;
  const target = legs.mode === "FIRST_TO" ? legs.count : (legs.count + 1) / 2;
  return {
    starting_score: input.startingScore,
    legs,
    sets: setsOn ? outer : null,
    win_by_two: input.winByTwo
      ? {
          cap: Math.max(input.cap, target),
          scope: setsOn ? input.marginScope : "EVERY_SET",
        }
      : null,
  };
}
```

Component state additions in `fiveOhOneSetup()`: `matchMode: "FIRST_TO"`, `matchUnit: "LEGS"`, `legsPerSetMode: "BEST_OF"`, `legsPerSet: 5`, `winByTwo: false`, `marginScope: "EVERY_SET"`, `cap: 5`. `basePreset()` returns `this.presets.find(isV2Preset)`. `init()` drops the `presetLegsToWin` read (keep `legsToWin` default `FIVE_OH_ONE_LEGS_MIN`); delete `presetLegsToWin` if nothing else uses it. In `start()`, after the existing clamps:

```ts
const overrides = buildFiveOhOneV2Wire({
  startingScore,
  matchMode: this.matchMode,
  count: legsValue,
  matchUnit: this.matchUnit,
  legsPerSetMode: this.legsPerSetMode,
  legsPerSet: Number(this.legsPerSet),
  winByTwo: this.winByTwo,
  marginScope: this.marginScope,
  cap: Number(this.cap),
});
const wire = { ...(preset.configuration as Record<string, unknown>), ...overrides };
```

and send `overrides` as `config.overrides`. Error text when no V2 preset: `"Could not find a preset for 501."` (unchanged). Extend `FiveOhOneSetupContext` with the new fields.

`FiveOhOneSetupForm.astro`: enable the two disabled options (`{ value: "BEST_OF", label: "Best of" }`, `{ value: "SETS", label: "Sets" }`), bind them: `x-model="matchMode"` / `x-model="matchUnit"` (drop `initial`). Change `allowDartbot={supportsDartbot("501_V1")}` to `"501_V2"`. Under the match-format block add, using the same primitives:

```astro
<div class="flex flex-col gap-2" x-show="matchUnit === 'SETS'" x-cloak>
  <SettingLabel text="LEGS PER SET" />
  <div class="grid grid-cols-[minmax(0,1fr)_72px] items-center gap-2.5">
    <Toggle orientation="vertical" options={matchFormatOpts} x-model="legsPerSetMode" class="w-full" />
    <Stepper min={FIVE_OH_ONE_LEGS_MIN} max={FIVE_OH_ONE_LEGS_MAX} ariaLabel="Legs per set" x-model="legsPerSet" class="justify-self-center" />
  </div>
</div>
<Switch label="Win by 2 legs" x-model="winByTwo" />
<div class="flex flex-col gap-2" x-show="winByTwo" x-cloak>
  <SettingLabel text="SUDDEN DEATH AT" />
  <Stepper min={FIVE_OH_ONE_LEGS_MIN} max={FIVE_OH_ONE_LEGS_MAX} ariaLabel="Sudden-death cap" x-model="cap" class="justify-self-start" />
  <Toggle
    orientation="horizontal"
    options={[{ value: "EVERY_SET", label: "Every set" }, { value: "DECIDING_SET", label: "Deciding set" }]}
    x-model="marginScope"
    x-show="matchUnit === 'SETS'"
    x-cloak
    class="w-full"
  />
</div>
```

Update `infoSection.description` to: `"Race from your starting score down to exactly zero. Open in, double out — the finishing dart must land on a double. Play first to or best of a number of legs, or of sets; optionally a side must win by 2 legs, up to a sudden-death leg."` `games-visibility.ts:17` → `"501_V2"`.

- [ ] **Step 4: Run to verify**

Run: `npm test -- tests/lib/game/` → PASS. `bash ../scripts/check-astro-conventions.sh && bash ../scripts/check-style-tokens.sh && bash ../scripts/check-game-engines.sh` → PASS. `npx astro check --minimumFailingSeverity hint` → 0/0/0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/game src/components/layout/games/setup tests/lib/game
git commit -m "feat(501): V2 match format setup"
```

---

### Task 9: Docs, decision, gates, PR

**Files:**
- Modify: `decisions/game-engine.md` (append block; next free id — `grep -rhoE "^\| D[0-9]+ |^### D[0-9]+" decisions | grep -oE "D[0-9]+" | sort -V | tail -1`, +1; the spec assumes D443)
- Modify: `docs/game-rules/rulesets/501.md` (`Current version: V2 (shipped YYYY-MM-DD)` on merge date; V2 rows stay)
- Modify: `docs/architecture/00-Context-Map.md` / `00-File-Inventory.md` per `context-maintenance` (rows for `match-format.module.ts`, `five-oh-one-match.ts`, seed `0037`, verification `0037`)
- Modify: `docs/architecture/07-Frontend/09-Adding-A-Game.md` only if it states legs are always root stages (grep `parentClientKey: null`)

- [ ] **Step 1: Decision block** — append to `decisions/game-engine.md`, matching the file's block format:

```markdown
### D443 — 501 V2 match formats as a SET→LEG stage tree (2026-10-10)

**Decision:** `501_V2` adds best of N (odd only), sets, win by 2 legs with a configurable sudden-death cap (every set or deciding set) and per-set throw rotation. With sets on, each set is a `SET` stage and its legs are child `LEG` stages whose `sequence` restarts per set; without sets, legs stay root stages. One pure fold (`match-format.module.ts`) decides set and match ends for both versions; `501_V1` snapshots read as first to `legs_to_win`. A V2-shaped configuration template (seed 0037) lets template-merge session creation validate under the strict V2 schema.
**Why:** the stage tree already supports nesting (`parent_stage_id`, per-parent sequence uniqueness, `v_replay_stages`); a global leg sequence under SET parents would give `sequence` two meanings, and flat legs would make set grouping unreachable in SQL.
**Spec:** `docs/superpowers/specs/2026-10-10-501-v2-match-formats-design.md`.
```

- [ ] **Step 2: Bump `501.md`** `Current version:` line to `V2 (shipped <merge date>)` in the PR (the gate's regex: `V[0-9]+ \(shipped YYYY-MM-DD\)`).

- [ ] **Step 3: Run `context-maintenance` and `run-all-gates` skills**; then from `app/`: `npm run validate:app` (every step zero; type gate 0/0/0) and `npm run format && npm run format:check`.

- [ ] **Step 4: Commit and open the PR** per `finishing-a-dart-branch` (Option 2: push + PR to `main`).

```bash
git add decisions docs
git commit -m "docs(501): D443 match formats; register new files"
```

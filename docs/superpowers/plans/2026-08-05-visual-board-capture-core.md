# Visual Board Capture Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist where each dart landed as regulation-millimetre coordinates, resolved into target/zone/score by one shared classifier, with both quick-score engines able to record dart-level visits — all headless, no UI.

**Architecture:** A pure cross-runtime `board-geometry.module.ts` owns the board's radii and the single `classify(x, y)` function. The client engines call it to turn a tap into a `DartObservation`; the Worker calls the same function to re-verify every submitted dart before writing. `darts` gains two nullable coordinate columns; `DartFact` gains the matching pair. Score Training and 501 gain a visual input path that records one dart at a time and derives the turn total as the sum of counted dart scores.

**Tech Stack:** PostgreSQL (dbmate migrations), TypeScript, Zod, Vitest, Astro/Cloudflare Workers.

## Global Constraints

- Coordinates are regulation millimetres, origin at bull centre, **y-axis increasing downward** (matching the SVG viewBox `-220,-220,440,440`).
- Ring radii, in millimetres: inner bull `0–6.35`, outer bull `6.35–15.9`, inner single `15.9–97`, treble `97–107`, outer single `107–162`, double `162–170`, surround `170–220`.
- Sectors are 18° wide; **20 is centred on the upward vertical**.
- A miss always stores `hitTargetNumber: null` — never the sector it landed in.
- `location_x` / `location_y` are both NULL or both present; never one alone.
- `turns.total_score` is the sum of **counted** dart board scores. A 501 bust stores `0` while its dart rows keep their real scores. This divergence is intentional and is the fact that makes bust rate computable.
- Never modify migrations `0001`–`0016`.
- No `//` or `/* */` comments inside function bodies in `app/src/**/*.ts` (JSDoc above a declaration is fine).
- Tests live under `app/tests/`, mirroring `app/src/` — never colocated.
- Type/interface declarations live in `types.ts` / `interfaces.ts` barrels, never inline in implementation files.
- Run `cd app && npm run format` before any commit that touches `app/`.

---

### Task 1: Board geometry module

**Files:**
- Create: `app/src/lib/game/board/board-geometry.module.ts`
- Create: `app/src/lib/game/board/types.ts`
- Test: `app/tests/lib/game/board/board-geometry.module.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `BOARD_RADII_MM: { innerBull: 6.35; outerBull: 15.9; trebleInner: 97; trebleOuter: 107; doubleInner: 162; doubleOuter: 170; surroundOuter: 220 }`
  - `SECTOR_ORDER: readonly number[]` — the 20 board numbers clockwise from 20.
  - `classify(x: number, y: number): BoardHit`
  - `type BoardHit = { targetNumber: number | null; zoneKey: DartZoneKey; score: number }`
  - `type BoardPoint = { x: number; y: number }`
  - `zoneCentroid(targetNumber: number | null, zoneKey: DartZoneKey): BoardPoint | null`

This module lives under `lib/` because the Worker imports it too — `modules/` is client-only.

- [ ] **Step 1: Write the failing test**

Create `app/tests/lib/game/board/board-geometry.module.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  BOARD_RADII_MM,
  classify,
  zoneCentroid,
} from "@lib/game/board/board-geometry.module";

describe("classify", () => {
  it("puts the origin in the inner bull", () => {
    expect(classify(0, 0)).toEqual({
      targetNumber: 25,
      zoneKey: "INNER_BULL",
      score: 50,
    });
  });

  it("puts a point just outside the inner bull in the outer bull", () => {
    expect(classify(0, -7)).toEqual({
      targetNumber: 25,
      zoneKey: "OUTER_BULL",
      score: 25,
    });
  });

  it("scores the treble of 20 straight up", () => {
    expect(classify(0, -102)).toEqual({
      targetNumber: 20,
      zoneKey: "TREBLE",
      score: 60,
    });
  });

  it("scores the double of 20 straight up", () => {
    expect(classify(0, -166)).toEqual({
      targetNumber: 20,
      zoneKey: "DOUBLE",
      score: 40,
    });
  });

  it("scores the inner single of 20", () => {
    expect(classify(0, -50)).toEqual({
      targetNumber: 20,
      zoneKey: "SINGLE",
      score: 20,
    });
  });

  it("scores the outer single of 20", () => {
    expect(classify(0, -130)).toEqual({
      targetNumber: 20,
      zoneKey: "SINGLE",
      score: 20,
    });
  });

  it("scores 3 straight down", () => {
    expect(classify(0, 130)).toEqual({
      targetNumber: 3,
      zoneKey: "SINGLE",
      score: 3,
    });
  });

  it("scores 6 straight right", () => {
    expect(classify(130, 0)).toEqual({
      targetNumber: 6,
      zoneKey: "SINGLE",
      score: 6,
    });
  });

  it("scores 11 straight left", () => {
    expect(classify(-130, 0)).toEqual({
      targetNumber: 11,
      zoneKey: "SINGLE",
      score: 11,
    });
  });

  it("returns a miss with no target number beyond the double ring", () => {
    expect(classify(0, -180)).toEqual({
      targetNumber: null,
      zoneKey: "MISS",
      score: 0,
    });
  });

  it("returns a miss beyond the surround", () => {
    expect(classify(0, -300)).toEqual({
      targetNumber: null,
      zoneKey: "MISS",
      score: 0,
    });
  });

  it("treats each ring boundary as belonging to the outer ring", () => {
    expect(classify(0, -BOARD_RADII_MM.innerBull).zoneKey).toBe("OUTER_BULL");
    expect(classify(0, -BOARD_RADII_MM.outerBull).zoneKey).toBe("SINGLE");
    expect(classify(0, -BOARD_RADII_MM.trebleInner).zoneKey).toBe("TREBLE");
    expect(classify(0, -BOARD_RADII_MM.trebleOuter).zoneKey).toBe("SINGLE");
    expect(classify(0, -BOARD_RADII_MM.doubleInner).zoneKey).toBe("DOUBLE");
    expect(classify(0, -BOARD_RADII_MM.doubleOuter).zoneKey).toBe("MISS");
  });

  it("splits neighbouring sectors at the 9 degree boundary", () => {
    const radius = 130;
    const justInside = (9 - 0.5) * (Math.PI / 180);
    const justOutside = (9 + 0.5) * (Math.PI / 180);
    expect(classify(radius * Math.sin(justInside), -radius * Math.cos(justInside)).targetNumber).toBe(20);
    expect(classify(radius * Math.sin(justOutside), -radius * Math.cos(justOutside)).targetNumber).toBe(1);
  });
});

describe("zoneCentroid", () => {
  it("puts the treble 20 centroid on the upward vertical", () => {
    const centroid = zoneCentroid(20, "TREBLE");
    expect(centroid).not.toBeNull();
    expect(centroid!.x).toBeCloseTo(0, 6);
    expect(centroid!.y).toBeCloseTo(-102, 6);
  });

  it("puts the inner bull centroid at the origin", () => {
    expect(zoneCentroid(25, "INNER_BULL")).toEqual({ x: 0, y: 0 });
  });

  it("has no centroid for a miss", () => {
    expect(zoneCentroid(null, "MISS")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/board/board-geometry.module.test.ts`
Expected: FAIL — `Failed to resolve import "@lib/game/board/board-geometry.module"`.

- [ ] **Step 3: Create the types barrel**

Create `app/src/lib/game/board/types.ts`:

```typescript
import type { DartZoneKey } from "@modules/game/types";

/** A point on the board in regulation millimetres, origin at bull centre, y increasing downward. */
export type BoardPoint = {
  x: number;
  y: number;
};

/** What a coordinate resolves to: the board fact a dart at that point produced. */
export type BoardHit = {
  targetNumber: number | null;
  zoneKey: DartZoneKey;
  score: number;
};
```

If `@modules` is not already a path alias, import `DartZoneKey` via the alias the project already uses for `app/src/modules/` — check `tsconfig.json` `compilerOptions.paths` and use the existing spelling.

- [ ] **Step 4: Write the implementation**

Create `app/src/lib/game/board/board-geometry.module.ts`:

```typescript
import type { DartZoneKey } from "@modules/game/types";
import type { BoardHit, BoardPoint } from "./types";

export const BULL_TARGET_NUMBER = 25;

/**
 * Regulation board radii in millimetres, measured from the bull centre. These
 * are the authority for what a ring means; `dartboard.svg` is drawn to match
 * them and a parity test proves it still does.
 */
export const BOARD_RADII_MM = {
  innerBull: 6.35,
  outerBull: 15.9,
  trebleInner: 97,
  trebleOuter: 107,
  doubleInner: 162,
  doubleOuter: 170,
  surroundOuter: 220,
} as const;

/** The 20 board numbers in clockwise order, starting at 20 on the upward vertical. */
export const SECTOR_ORDER: readonly number[] = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
];

const SECTOR_WIDTH_DEGREES = 360 / SECTOR_ORDER.length;

function radiusOf(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

/**
 * Clockwise bearing in degrees from the upward vertical, normalised to
 * `0..360`. The y-axis increases downward, so "up" is negative y.
 */
function bearingDegrees(x: number, y: number): number {
  const degrees = Math.atan2(x, -y) * (180 / Math.PI);
  return (degrees + 360) % 360;
}

function sectorNumber(x: number, y: number): number {
  const offset = bearingDegrees(x, y) + SECTOR_WIDTH_DEGREES / 2;
  const index = Math.floor((offset % 360) / SECTOR_WIDTH_DEGREES);
  return SECTOR_ORDER[index] as number;
}

function scoreFor(targetNumber: number | null, zoneKey: DartZoneKey): number {
  if (zoneKey === "MISS") return 0;
  if (zoneKey === "OUTER_BULL") return 25;
  if (zoneKey === "INNER_BULL") return 50;
  if (targetNumber === null) return 0;
  if (zoneKey === "DOUBLE") return targetNumber * 2;
  if (zoneKey === "TREBLE") return targetNumber * 3;
  return targetNumber;
}

/**
 * Resolves a landing point into the board fact it produced. Every ring
 * boundary belongs to the outer ring, so a point exactly on `trebleInner` is a
 * treble and a point exactly on `doubleOuter` is a miss.
 *
 * A miss carries `targetNumber: null` even when the point sits in a sector's
 * surround — `hit_target_number` means "this number was actually hit", and the
 * sector stays recoverable from the coordinate itself.
 */
export function classify(x: number, y: number): BoardHit {
  const radius = radiusOf(x, y);

  if (radius < BOARD_RADII_MM.innerBull) {
    return {
      targetNumber: BULL_TARGET_NUMBER,
      zoneKey: "INNER_BULL",
      score: 50,
    };
  }
  if (radius < BOARD_RADII_MM.outerBull) {
    return {
      targetNumber: BULL_TARGET_NUMBER,
      zoneKey: "OUTER_BULL",
      score: 25,
    };
  }
  if (radius >= BOARD_RADII_MM.doubleOuter) {
    return { targetNumber: null, zoneKey: "MISS", score: 0 };
  }

  const targetNumber = sectorNumber(x, y);
  const zoneKey: DartZoneKey =
    radius >= BOARD_RADII_MM.doubleInner
      ? "DOUBLE"
      : radius >= BOARD_RADII_MM.trebleInner &&
          radius < BOARD_RADII_MM.trebleOuter
        ? "TREBLE"
        : "SINGLE";

  return { targetNumber, zoneKey, score: scoreFor(targetNumber, zoneKey) };
}

function ringMidRadius(zoneKey: DartZoneKey): number | null {
  if (zoneKey === "DOUBLE") {
    return (BOARD_RADII_MM.doubleInner + BOARD_RADII_MM.doubleOuter) / 2;
  }
  if (zoneKey === "TREBLE") {
    return (BOARD_RADII_MM.trebleInner + BOARD_RADII_MM.trebleOuter) / 2;
  }
  if (zoneKey === "SINGLE") {
    return (BOARD_RADII_MM.trebleOuter + BOARD_RADII_MM.doubleInner) / 2;
  }
  return null;
}

/**
 * The aim point of a declared target: the centre of the named zone on the
 * named number. This is the reference a miss margin is measured from, and it
 * is derived here so the client, the Worker and the read layer all measure
 * from the same point.
 */
export function zoneCentroid(
  targetNumber: number | null,
  zoneKey: DartZoneKey,
): BoardPoint | null {
  if (zoneKey === "INNER_BULL" || zoneKey === "OUTER_BULL") {
    return { x: 0, y: 0 };
  }
  if (targetNumber === null) return null;

  const radius = ringMidRadius(zoneKey);
  if (radius === null) return null;

  const index = SECTOR_ORDER.indexOf(targetNumber);
  if (index < 0) return null;

  const radians = index * SECTOR_WIDTH_DEGREES * (Math.PI / 180);
  return { x: radius * Math.sin(radians), y: -radius * Math.cos(radians) };
}
```

**Reconciliation note (Task 15, 2026-08-05).** The `SINGLE` branches in `classify()` and `ringMidRadius()` shown above were removed in `74006ea` and replaced with the `INNER_SINGLE`/`OUTER_SINGLE` split by Task 11b below — this code block is what Task 1 actually shipped at the time, not what the file contains after Task 11b landed. The shipped, current version is `app/src/lib/game/board/board-geometry.module.ts`; this plan is a point-in-time record and is not rewritten to match later tasks (`docs/CLAUDE.md`).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/board/board-geometry.module.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 6: Verify the alias resolves for a real import**

The alias must exist in **both** `tsconfig.json` `compilerOptions.paths` and `vitest.config.ts` `resolve.alias`, or `scripts/check-alias-sync.sh` fails.

Run: `cd .. && bash scripts/check-alias-sync.sh`
Expected: `OK` — if it fails, add the missing alias to whichever file lacks it and re-run.

- [ ] **Step 7: Commit**

```bash
cd app && npm run format && cd ..
git add app/src/lib/game/board app/tests/lib/game/board
git commit -m "Add board geometry module: mm coordinates to board facts"
```

---

### Task 2: SVG parity test

**Files:**
- Test: `app/tests/lib/game/board/svg-geometry-parity.test.ts`

**Interfaces:**
- Consumes: `BOARD_RADII_MM` from Task 1.
- Produces: nothing.

This is the guard against the design's single largest silent-drift risk: someone redraws `dartboard.svg` and every treble in the database quietly means something else.

- [ ] **Step 1: Write the test**

Create `app/tests/lib/game/board/svg-geometry-parity.test.ts`:

```typescript
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BOARD_RADII_MM } from "@lib/game/board/board-geometry.module";

const svgPath = fileURLToPath(
  new URL("../../../../src/assets/dartboard.svg", import.meta.url),
);
const svg = readFileSync(svgPath, "utf8");

function arcRadiiIn(source: string): Set<number> {
  const radii = new Set<number>();
  for (const match of source.matchAll(/A(\d+(?:\.\d+)?),/g)) {
    radii.add(Number(match[1]));
  }
  return radii;
}

function circleRadiiIn(source: string): Set<number> {
  const radii = new Set<number>();
  for (const match of source.matchAll(/r="(\d+(?:\.\d+)?)"/g)) {
    radii.add(Number(match[1]));
  }
  return radii;
}

describe("dartboard.svg matches the geometry module", () => {
  it("draws every segment ring at a radius the classifier knows", () => {
    const drawn = arcRadiiIn(svg);
    for (const radius of [
      BOARD_RADII_MM.trebleInner,
      BOARD_RADII_MM.trebleOuter,
      BOARD_RADII_MM.doubleInner,
      BOARD_RADII_MM.doubleOuter,
    ]) {
      expect(drawn).toContain(radius);
    }
  });

  it("draws both bull circles at the radii the classifier knows", () => {
    const drawn = circleRadiiIn(svg);
    expect(drawn).toContain(BOARD_RADII_MM.innerBull);
    expect(drawn).toContain(BOARD_RADII_MM.outerBull);
  });

  it("uses a viewBox that contains the surround", () => {
    const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1];
    expect(viewBox).toBeDefined();
    const [minX, minY, width, height] = viewBox!
      .split(/[\s,]+/)
      .map(Number) as [number, number, number, number];
    expect(Math.abs(minX)).toBeGreaterThanOrEqual(BOARD_RADII_MM.surroundOuter);
    expect(Math.abs(minY)).toBeGreaterThanOrEqual(BOARD_RADII_MM.surroundOuter);
    expect(width).toBeGreaterThanOrEqual(BOARD_RADII_MM.surroundOuter * 2);
    expect(height).toBeGreaterThanOrEqual(BOARD_RADII_MM.surroundOuter * 2);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `cd app && npx vitest run tests/lib/game/board/svg-geometry-parity.test.ts`
Expected: PASS, 3 tests. If a radius assertion fails, the SVG and the module genuinely disagree — do not adjust the test to match. Reconcile the two and say which one was wrong.

- [ ] **Step 3: Commit**

```bash
cd app && npm run format && cd ..
git add app/tests/lib/game/board/svg-geometry-parity.test.ts
git commit -m "Guard dartboard.svg against geometry-module drift"
```

---

### Task 3: Migration 0017 — coordinate columns

**Files:**
- Create: `database/migrations/0017_dart_locations.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: `darts.location_x`, `darts.location_y`, constraint `chk_dart_location_pair`.

This migration also adds the two missing `player_settings` FKs, correcting a documented-but-never-created constraint. It creates **no** capability table — that belongs entirely to plan 2, so this plan ships nothing it does not use.

- [ ] **Step 1: Write the migration**

Create `database/migrations/0017_dart_locations.sql`:

```sql
-- ============================================================
-- Migration: 0017_dart_locations.sql
--
-- Purpose:
-- Capture where a dart landed.
--
-- darts.location_x / location_y store the landing point in
-- regulation millimetres, origin at the bull centre, y
-- increasing downward to match dartboard.svg. They are
-- nullable: quick-score sessions write no dart rows at all,
-- and a visual session records NULL for a dart whose landing
-- point was never seen (bounce-out).
--
-- Also adds the two player_settings foreign keys that
-- 06-Spec/03-Player-Layer.md specifies but migration 0003
-- never created.
-- ============================================================

-- migrate:up
ALTER TABLE darts
ADD COLUMN location_x NUMERIC(6, 2),
    ADD COLUMN location_y NUMERIC(6, 2);

ALTER TABLE darts
ADD CONSTRAINT chk_dart_location_pair CHECK (
        (
            location_x IS NULL
            AND location_y IS NULL
        )
        OR (
            location_x IS NOT NULL
            AND location_y IS NOT NULL
        )
    );

COMMENT ON COLUMN darts.location_x IS 'Landing point, millimetres right of the bull centre.';
COMMENT ON COLUMN darts.location_y IS 'Landing point, millimetres below the bull centre.';

ALTER TABLE player_settings
ADD CONSTRAINT fk_player_settings_capture_mode FOREIGN KEY (default_capture_mode_id) REFERENCES capture_modes(id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_player_settings_input_mode FOREIGN KEY (default_input_mode_id) REFERENCES input_modes(id) ON DELETE RESTRICT;

-- migrate:down
ALTER TABLE player_settings
DROP CONSTRAINT fk_player_settings_input_mode,
    DROP CONSTRAINT fk_player_settings_capture_mode;

ALTER TABLE darts
DROP CONSTRAINT chk_dart_location_pair;

ALTER TABLE darts
DROP COLUMN location_y,
    DROP COLUMN location_x;
```

- [ ] **Step 2: Apply the migration**

Run: `cd app && npm run db:status && npm run db:migrate && npm run db:status`
Expected: `0017_dart_locations.sql` moves from pending to applied.

- [ ] **Step 3: Verify the constraint rejects a half-set pair**

Run:

```bash
cd app && npx dbmate --url "$DATABASE_URL" query "
  INSERT INTO darts (id, turn_id, dart_number, hit_zone_id, score, created_at, location_x)
  VALUES (gen_random_uuid(), gen_random_uuid(), 1, 6, 0, now(), 12.5);
" 2>&1 | head -3
```

Expected: an error naming `chk_dart_location_pair` or `fk_darts_turn` — either proves the row was refused. If the statement succeeds, the CHECK is wrong; fix it before continuing.

- [ ] **Step 4: Re-introspect the Drizzle schema**

Run: `cd app && npx drizzle-kit introspect`
Expected: `app/src/db/schema.ts` gains `locationX` / `locationY` on `darts`.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/0017_dart_locations.sql app/src/db/schema.ts
git commit -m "Add dart location columns"
```

---

### Task 4: Seed 0005 — the VISUAL_BOARD input mode

**Files:**
- Create: `database/seeds/0005_visual_board_input_mode.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: `input_modes` row `3 / VISUAL_BOARD`.

Capability rows are **not** seeded here — they belong to plan 2, so nothing advertises a mode before an engine implements it.

- [ ] **Step 1: Write the seed**

Create `database/seeds/0005_visual_board_input_mode.sql`:

```sql
-- ============================================================
-- Seed: 0005_visual_board_input_mode.sql
--
-- Adds the VISUAL_BOARD input mode: darts captured by tapping
-- the board, storing a landing coordinate per dart.
--
-- Capability rows live in seed 0006 (plan 2), so no ruleset
-- version advertises this mode until an engine implements it.
-- ============================================================
BEGIN;

INSERT INTO input_modes (
        id,
        implementation_key,
        name,
        description,
        created_at
    )
VALUES (
        3,
        'VISUAL_BOARD',
        'Visual Board',
        'Dart entry by tapping the board, capturing a landing coordinate.',
        now()
    ) ON CONFLICT (id) DO NOTHING;

COMMIT;
```

- [ ] **Step 2: Apply the seed**

Run: `cd app && npm run db:seed`
Expected: completes without error.

- [ ] **Step 3: Verify the row exists**

Run: `cd app && npx dbmate --url "$DATABASE_URL" query "SELECT id, implementation_key FROM input_modes ORDER BY id;"`
Expected: three rows — `1 QUICK_SCORE`, `2 DETAILED_DARTS`, `3 VISUAL_BOARD`.

- [ ] **Step 4: Register the seed in the database README**

In `database/README.md`, find the `## Seed Order` section and add `0005_visual_board_input_mode.sql` to the list, following the existing formatting exactly.

- [ ] **Step 5: Commit**

```bash
git add database/seeds/0005_visual_board_input_mode.sql database/README.md
git commit -m "Seed the VISUAL_BOARD input mode"
```

---

### Task 5: Widen the dart fact types

**Files:**
- Modify: `app/src/modules/game/types.ts:114-138`
- Test: `app/tests/modules/game/dart-location-shape.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `DartObservation` and `DartFact` each gain `locationX: number | null` and `locationY: number | null`.

Every existing engine constructs `DartFact` objects, so this change breaks compilation until Task 6 updates them. That is intended — the compiler enumerates the call sites.

- [ ] **Step 1: Write the failing test**

Create `app/tests/modules/game/dart-location-shape.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { DartFact, DartObservation } from "@modules/game/types";

describe("dart fact location pair", () => {
  it("accepts an observation carrying a landing point", () => {
    const observation: DartObservation = {
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      locationX: 0,
      locationY: -102,
    };
    expect(observation.locationY).toBe(-102);
  });

  it("accepts an observation with no landing point", () => {
    const observation: DartObservation = {
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    };
    expect(observation.locationX).toBeNull();
  });

  it("carries the pair through to a persisted dart fact", () => {
    const fact: DartFact = {
      sequence: 1,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      score: 60,
      locationX: 0,
      locationY: -102,
    };
    expect(fact.score).toBe(60);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/dart-location-shape.test.ts`
Expected: FAIL — TypeScript reports `locationX` does not exist on `DartObservation`.

- [ ] **Step 3: Widen the types**

In `app/src/modules/game/types.ts`, replace the `DartObservation` and `DartFact` declarations with:

```typescript
/**
 * What the player did, as observed at input time — the engine's only input.
 * `locationX` / `locationY` are the landing point in regulation millimetres
 * (origin bull centre, y increasing downward), present only for VISUAL_BOARD
 * capture and null together when the landing point was never seen.
 */
export type DartObservation = {
  hitTargetNumber: number | null;
  hitZoneKey: DartZoneKey;
  locationX: number | null;
  locationY: number | null;
};

/**
 * One row of `darts`. `score` is the actual board score, never a game-specific
 * point value. The location pair is written together or not at all, mirroring
 * `chk_dart_location_pair`.
 */
export type DartFact = {
  sequence: number;
  intendedTargetNumber: number | null;
  intendedZoneKey: DartZoneKey | null;
  hitTargetNumber: number | null;
  hitZoneKey: DartZoneKey;
  score: number;
  locationX: number | null;
  locationY: number | null;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/dart-location-shape.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
cd app && npm run format && cd ..
git add app/src/modules/game/types.ts app/tests/modules/game/dart-location-shape.test.ts
git commit -m "Widen dart observation and fact types with a location pair"
```

---

### Task 6: Repair the existing engines' dart construction

**Files:**
- Modify: `app/src/modules/game/bobs27.engine.module.ts`
- Modify: `app/src/modules/game/doubles-training.engine.module.ts`
- Modify: `app/src/modules/game/singles-training.engine.module.ts`
- Modify: `app/src/modules/game/tuod.engine.module.ts`
- Modify: `app/src/modules/game/board-progression.module.ts`

**Interfaces:**
- Consumes: the widened types from Task 5.
- Produces: all existing engines compile again, emitting `locationX: null, locationY: null`.

These four engines capture darts from a keypad, which produces no coordinate. They must say so explicitly rather than leaving the fields absent.

- [ ] **Step 1: Find every construction site**

Run: `cd app && npx tsc --noEmit 2>&1 | head -40`
Expected: errors naming each file and line where a `DartFact` or `DartObservation` object literal is missing `locationX` / `locationY`. Work the list.

- [ ] **Step 2: Add the null pair at each site**

At every reported object literal, add both fields. For example, in `bobs27.engine.module.ts` the dart fact push becomes:

```typescript
    this.darts.push({
      sequence: this.darts.length + 1,
      intendedTargetNumber: intendedTargetNumber,
      intendedZoneKey: intendedZoneKey,
      hitTargetNumber: observation.hitTargetNumber,
      hitZoneKey: observation.hitZoneKey,
      score: boardScore(observation.hitTargetNumber, observation.hitZoneKey),
      locationX: null,
      locationY: null,
    });
```

Keep each engine's existing field values exactly as they are — only the two new fields are added, always as `null`.

- [ ] **Step 3: Verify compilation is clean**

Run: `cd app && npx tsc --noEmit`
Expected: no output.

- [ ] **Step 4: Run the full suite**

Run: `cd app && npx vitest run`
Expected: all tests pass. Existing engine tests that assert on whole dart objects may now fail on the two new fields — update those assertions to include `locationX: null, locationY: null`. Do not weaken an assertion to `expect.objectContaining` to dodge the change.

- [ ] **Step 5: Commit**

```bash
cd app && npm run format && cd ..
git add app/src/modules/game app/tests/modules/game
git commit -m "Carry the null location pair through keypad-capture engines"
```

---

### Task 7: Batch schema mirrors the location constraint

**Files:**
- Modify: `app/src/pages/api/sessions/types.ts:52-80`
- Test: `app/tests/pages/api/sessions/constraint-mirror.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `DartFact` Zod schema accepts `locationX` / `locationY`, refusing a half-set pair.

- [ ] **Step 1: Write the failing test**

Append to `app/tests/pages/api/sessions/constraint-mirror.test.ts`:

```typescript
describe("chk_dart_location_pair", () => {
  const base = {
    sequence: 1,
    intendedTargetNumber: null,
    intendedZoneKey: null,
    hitTargetNumber: 20,
    hitZoneKey: "TREBLE",
    score: 60,
  };

  it("accepts both coordinates present", () => {
    const result = DartFact.safeParse({
      ...base,
      locationX: 0,
      locationY: -102,
    });
    expect(result.success).toBe(true);
  });

  it("accepts both coordinates null", () => {
    const result = DartFact.safeParse({
      ...base,
      locationX: null,
      locationY: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects only x present", () => {
    const result = DartFact.safeParse({
      ...base,
      locationX: 12.5,
      locationY: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects only y present", () => {
    const result = DartFact.safeParse({
      ...base,
      locationX: null,
      locationY: 12.5,
    });
    expect(result.success).toBe(false);
  });
});
```

Confirm `DartFact` is already imported at the top of the file; add it to the existing import if not.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/pages/api/sessions/constraint-mirror.test.ts`
Expected: FAIL — the half-set cases pass parsing because no refinement rejects them yet.

- [ ] **Step 3: Extend the schema**

In `app/src/pages/api/sessions/types.ts`, replace the `DartFact` schema with:

```typescript
/**
 * One `darts` row. The bounds mirror that table's CHECK constraints exactly —
 * `chk_dart_number_positive` and `chk_dart_score_positive` (migration `0007`)
 * alongside the target-number range — and the refinements mirror
 * `chk_dart_target_consistency`, which admits both intention columns NULL or
 * the zone NOT NULL, and `chk_dart_location_pair` (migration `0017`), which
 * admits both coordinates NULL or both present.
 */
// MIRRORS: chk_dart_number, chk_dart_number_positive, chk_dart_score_positive, chk_hit_consistency, chk_dart_target_consistency, chk_dart_location_pair
export const DartFact = z
  .object({
    sequence: z.number().int().positive(),
    intendedTargetNumber: TargetNumber,
    intendedZoneKey: z.string().nullable(),
    hitTargetNumber: TargetNumber,
    hitZoneKey: z.string(),
    score: z.number().int().nonnegative(),
    locationX: z.number().nullable(),
    locationY: z.number().nullable(),
  })
  .refine(
    (dart) =>
      dart.intendedZoneKey !== null || dart.intendedTargetNumber === null,
    {
      message:
        "intendedZoneKey is required whenever intendedTargetNumber is set",
      path: ["intendedZoneKey"],
    },
  )
  .refine(
    (dart) => (dart.locationX === null) === (dart.locationY === null),
    {
      message: "locationX and locationY must both be set or both be null",
      path: ["locationY"],
    },
  );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/pages/api/sessions/constraint-mirror.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify the mirror gate**

Run: `cd .. && bash scripts/check-constraint-mirror.sh`
Expected: `OK` — the new `chk_dart_location_pair` anchor is found.

- [ ] **Step 6: Commit**

```bash
cd app && npm run format && cd ..
git add app/src/pages/api/sessions/types.ts app/tests/pages/api/sessions/constraint-mirror.test.ts
git commit -m "Mirror chk_dart_location_pair in the batch write schema"
```

---

### Task 8: Persist coordinates in the write path

**Files:**
- Modify: the sessions batch repository that inserts `darts` rows — find it with the command in Step 1
- Test: the matching test file under `app/tests/`

**Interfaces:**
- Consumes: `DartFactInput` from Task 7.
- Produces: `darts.location_x` / `location_y` populated from the batch payload.

- [ ] **Step 1: Locate the insert**

Run: `cd app && grep -rn "hit_zone_id\|hitZoneId" src/services src/repositories src/pages/api --include=*.ts | head -20`
Expected: one repository file building the `darts` insert. That file and its existing test are what this task modifies.

- [ ] **Step 2: Write the failing test**

In the repository's existing test file, add a case asserting the location pair reaches the insert. Follow the file's established mocking style exactly — if it asserts on a built row object, assert `location_x` and `location_y`; if it asserts on Drizzle `values()` arguments, assert `locationX` and `locationY`:

```typescript
it("carries the dart location pair into the insert", async () => {
  const batch = {
    stages: [
      {
        clientKey: "block-1",
        stageTypeKey: "EXERCISE_BLOCK",
        parentClientKey: null,
        sequence: 1,
        turns: [
          {
            clientKey: "turn-1",
            participantRef: "p1",
            sequence: 1,
            totalScore: 60,
            completedAt: "2026-08-05T12:00:00.000Z",
            darts: [
              {
                sequence: 1,
                intendedTargetNumber: null,
                intendedZoneKey: null,
                hitTargetNumber: 20,
                hitZoneKey: "TREBLE",
                score: 60,
                locationX: 0,
                locationY: -102,
              },
            ],
          },
        ],
      },
    ],
  };

  const rows = await buildDartRows(batch);

  expect(rows[0]).toMatchObject({ locationX: 0, locationY: -102 });
});
```

Adjust `buildDartRows` to the real exported name found in Step 1.

- [ ] **Step 3: Run test to verify it fails**

Run: `cd app && npx vitest run <the test file from Step 1>`
Expected: FAIL — the built row has no location fields.

- [ ] **Step 4: Add the two fields to the insert**

In the repository, add `locationX: dart.locationX` and `locationY: dart.locationY` to the object built per dart, beside the existing `score` field.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run <the test file from Step 1>`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd app && npm run format && cd ..
git add app/src app/tests
git commit -m "Persist dart landing coordinates in the batch write path"
```

---

### Task 9: Worker re-classifies every submitted dart

**Files:**
- Create: `app/src/services/rulesets/visual-board.validator.ts`
- Test: `app/tests/services/rulesets/visual-board.validator.test.ts`

**Interfaces:**
- Consumes: `classify` (Task 1), `EventsBatchRequestInput` and `BatchValidationResult`.
- Produces:
  - `VISUAL_BOARD_MODES: string`
  - `isVisualBoardCapture(captureModeKey: string, inputModeKey: string): boolean`
  - `validateVisualBoardTurns(batch: EventsBatchRequestInput): BatchValidationResult`

Without this the client is the only authority on the analytical fact, and a stale client writes permanent garbage into the dataset the whole feature exists to build.

- [ ] **Step 1: Write the failing test**

Create `app/tests/services/rulesets/visual-board.validator.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  isVisualBoardCapture,
  validateVisualBoardTurns,
} from "@services/rulesets/visual-board.validator";

function batchWithDart(dart: Record<string, unknown>) {
  return {
    stages: [
      {
        clientKey: "block-1",
        stageTypeKey: "EXERCISE_BLOCK",
        parentClientKey: null,
        sequence: 1,
        turns: [
          {
            clientKey: "turn-1",
            participantRef: "p1",
            sequence: 1,
            totalScore: Number(dart.score),
            completedAt: "2026-08-05T12:00:00.000Z",
            darts: [dart],
          },
        ],
      },
    ],
  } as never;
}

const trebleTwenty = {
  sequence: 1,
  intendedTargetNumber: null,
  intendedZoneKey: null,
  hitTargetNumber: 20,
  hitZoneKey: "TREBLE",
  score: 60,
  locationX: 0,
  locationY: -102,
};

describe("isVisualBoardCapture", () => {
  it("recognises the analytics visual pair", () => {
    expect(isVisualBoardCapture("ANALYTICS", "VISUAL_BOARD")).toBe(true);
  });

  it("rejects the quick-score pair", () => {
    expect(isVisualBoardCapture("RECREATIONAL", "QUICK_SCORE")).toBe(false);
  });
});

describe("validateVisualBoardTurns", () => {
  it("accepts a dart whose coordinate agrees with its zone and score", () => {
    expect(validateVisualBoardTurns(batchWithDart(trebleTwenty))).toEqual({
      valid: true,
    });
  });

  it("rejects a dart whose zone disagrees with its coordinate", () => {
    const result = validateVisualBoardTurns(
      batchWithDart({ ...trebleTwenty, hitZoneKey: "DOUBLE" }),
    );
    expect(result.valid).toBe(false);
    expect(result.issues?.[0]).toContain("zone");
  });

  it("rejects a dart whose score disagrees with its coordinate", () => {
    const result = validateVisualBoardTurns(
      batchWithDart({ ...trebleTwenty, score: 20 }),
    );
    expect(result.valid).toBe(false);
    expect(result.issues?.[0]).toContain("score");
  });

  it("rejects a dart whose target number disagrees with its coordinate", () => {
    const result = validateVisualBoardTurns(
      batchWithDart({ ...trebleTwenty, hitTargetNumber: 5 }),
    );
    expect(result.valid).toBe(false);
  });

  it("accepts a coordinate-less dart as an unseen throw", () => {
    const result = validateVisualBoardTurns(
      batchWithDart({
        sequence: 1,
        intendedTargetNumber: null,
        intendedZoneKey: null,
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        score: 0,
        locationX: null,
        locationY: null,
      }),
    );
    expect(result.valid).toBe(true);
  });

  it("rejects a coordinate-less dart that claims a score", () => {
    const result = validateVisualBoardTurns(
      batchWithDart({
        sequence: 1,
        intendedTargetNumber: null,
        intendedZoneKey: null,
        hitTargetNumber: 20,
        hitZoneKey: "TREBLE",
        score: 60,
        locationX: null,
        locationY: null,
      }),
    );
    expect(result.valid).toBe(false);
  });

  it("rejects a turn total that is not the sum of its counted darts", () => {
    const batch = batchWithDart(trebleTwenty) as unknown as {
      stages: { turns: { totalScore: number }[] }[];
    };
    batch.stages[0]!.turns[0]!.totalScore = 41;
    const result = validateVisualBoardTurns(batch as never);
    expect(result.valid).toBe(false);
    expect(result.issues?.[0]).toContain("totalScore");
  });

  it("accepts a zero turn total against scoring darts as a bust", () => {
    const batch = batchWithDart(trebleTwenty) as unknown as {
      stages: { turns: { totalScore: number }[] }[];
    };
    batch.stages[0]!.turns[0]!.totalScore = 0;
    expect(validateVisualBoardTurns(batch as never)).toEqual({ valid: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/services/rulesets/visual-board.validator.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the validator**

Create `app/src/services/rulesets/visual-board.validator.ts`:

```typescript
import { classify } from "@lib/game/board/board-geometry.module";
import type { EventsBatchRequestInput } from "@routes/types";
import type { BatchValidationResult } from "./types";

const VISUAL_BOARD_CAPTURE_MODE = "ANALYTICS";
const VISUAL_BOARD_INPUT_MODE = "VISUAL_BOARD";

/** The mode pair every coordinate-capturing ruleset names in its rejection message. */
export const VISUAL_BOARD_MODES = `${VISUAL_BOARD_CAPTURE_MODE} + ${VISUAL_BOARD_INPUT_MODE}`;

/** Whether a session captures individual darts with a landing coordinate. */
export function isVisualBoardCapture(
  captureModeKey: string,
  inputModeKey: string,
): boolean {
  return (
    captureModeKey === VISUAL_BOARD_CAPTURE_MODE &&
    inputModeKey === VISUAL_BOARD_INPUT_MODE
  );
}

function reject(issue: string): BatchValidationResult {
  return { valid: false, code: "VALIDATION_FAILED", issues: [issue] };
}

/**
 * Re-derives every submitted dart from its own coordinate and refuses the
 * batch when the client's claim disagrees. The client computes the board fact
 * for immediate feedback, but it is never trusted as the authority — a stale
 * or tampered client would otherwise write permanent, silently wrong rows into
 * the analytical dataset.
 *
 * A dart with no coordinate is an unseen throw (bounce-out): it must score
 * nothing and name no target. A turn total of 0 against scoring darts is a
 * bust and is accepted; any other disagreement between the total and the sum
 * of its darts is refused.
 */
export function validateVisualBoardTurns(
  batch: EventsBatchRequestInput,
): BatchValidationResult {
  for (const stage of batch.stages) {
    for (const turn of stage.turns) {
      let countedTotal = 0;

      for (const dart of turn.darts) {
        if (dart.locationX === null || dart.locationY === null) {
          if (dart.score !== 0 || dart.hitTargetNumber !== null) {
            return reject(
              `dart ${dart.sequence} in turn ${turn.clientKey} has no location, so it must score 0 and name no target (${VISUAL_BOARD_MODES})`,
            );
          }
          continue;
        }

        const resolved = classify(dart.locationX, dart.locationY);

        if (dart.hitZoneKey !== resolved.zoneKey) {
          return reject(
            `dart ${dart.sequence} in turn ${turn.clientKey} claims zone ${dart.hitZoneKey}, but its location resolves to ${resolved.zoneKey}`,
          );
        }
        if (dart.hitTargetNumber !== resolved.targetNumber) {
          return reject(
            `dart ${dart.sequence} in turn ${turn.clientKey} claims target ${dart.hitTargetNumber}, but its location resolves to ${resolved.targetNumber}`,
          );
        }
        if (dart.score !== resolved.score) {
          return reject(
            `dart ${dart.sequence} in turn ${turn.clientKey} claims score ${dart.score}, but its location resolves to ${resolved.score}`,
          );
        }

        countedTotal += resolved.score;
      }

      if (turn.totalScore !== countedTotal && turn.totalScore !== 0) {
        return reject(
          `turn ${turn.clientKey} totalScore ${turn.totalScore} is neither the sum of its darts (${countedTotal}) nor 0 for a void visit`,
        );
      }
    }
  }

  return { valid: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/services/rulesets/visual-board.validator.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
cd app && npm run format && cd ..
git add app/src/services/rulesets/visual-board.validator.ts app/tests/services/rulesets/visual-board.validator.test.ts
git commit -m "Re-classify submitted dart coordinates on the Worker"
```

---

### Task 10: Route 501 and Score Training batches to the right validator

**Files:**
- Modify: `app/src/services/rulesets/` — the 501 and Score Training validators (find with Step 1)
- Test: the matching test files

**Interfaces:**
- Consumes: `isVisualBoardCapture`, `validateVisualBoardTurns` (Task 9); `isQuickScoreCapture`, `validateQuickScoreTurns` (existing).
- Produces: each of the two rulesets validates by its session's mode pair.

- [ ] **Step 1: Locate the two validators**

Run: `cd app && grep -rln "isQuickScoreCapture" src/services/rulesets`
Expected: the 501 and Score Training validator files, plus TUOD's.

- [ ] **Step 2: Write the failing test**

In the 501 validator's test file, add:

```typescript
it("validates a visual-board batch through the coordinate validator", () => {
  const batch = {
    stages: [
      {
        clientKey: "leg-1",
        stageTypeKey: "LEG",
        parentClientKey: null,
        sequence: 1,
        turns: [
          {
            clientKey: "turn-1",
            participantRef: "p1",
            sequence: 1,
            totalScore: 60,
            completedAt: "2026-08-05T12:00:00.000Z",
            darts: [
              {
                sequence: 1,
                intendedTargetNumber: null,
                intendedZoneKey: null,
                hitTargetNumber: 20,
                hitZoneKey: "TREBLE",
                score: 60,
                locationX: 0,
                locationY: -102,
              },
            ],
          },
        ],
      },
    ],
  };

  const result = validateFiveOhOneBatch({
    captureModeKey: "ANALYTICS",
    inputModeKey: "VISUAL_BOARD",
    config: { max_visit_score: 180, legs_to_win: 1 },
    batch: batch as never,
    existingTurnCount: 0,
  });

  expect(result.valid).toBe(true);
});

it("still rejects dart rows in a quick-score batch", () => {
  const result = validateFiveOhOneBatch({
    captureModeKey: "RECREATIONAL",
    inputModeKey: "QUICK_SCORE",
    config: { max_visit_score: 180, legs_to_win: 1 },
    batch: {
      stages: [
        {
          clientKey: "leg-1",
          stageTypeKey: "LEG",
          parentClientKey: null,
          sequence: 1,
          turns: [
            {
              clientKey: "turn-1",
              participantRef: "p1",
              sequence: 1,
              totalScore: 60,
              completedAt: "2026-08-05T12:00:00.000Z",
              darts: [
                {
                  sequence: 1,
                  intendedTargetNumber: null,
                  intendedZoneKey: null,
                  hitTargetNumber: 20,
                  hitZoneKey: "TREBLE",
                  score: 60,
                  locationX: null,
                  locationY: null,
                },
              ],
            },
          ],
        },
      ],
    } as never,
    existingTurnCount: 0,
  });

  expect(result.valid).toBe(false);
});
```

Match the real exported validator name and argument shape found in Step 1 — the names above are illustrative of the call, not of the signature.

- [ ] **Step 3: Run test to verify it fails**

Run: `cd app && npx vitest run <the 501 validator test file>`
Expected: FAIL — the visual batch is rejected, because the validator still routes every batch to `validateQuickScoreTurns`.

- [ ] **Step 4: Branch on the mode pair**

In each of the two validators, replace the unconditional `validateQuickScoreTurns(...)` call with:

```typescript
  if (isVisualBoardCapture(captureModeKey, inputModeKey)) {
    return validateVisualBoardTurns(batch);
  }

  if (!isQuickScoreCapture(captureModeKey, inputModeKey)) {
    return {
      valid: false,
      code: "VALIDATION_FAILED",
      issues: [`unsupported mode pair ${captureModeKey} + ${inputModeKey}`],
    };
  }

  return validateQuickScoreTurns(batch, maxTurnScore);
```

Keep each validator's existing `maxTurnScore` derivation and its ROUNDS-limit check exactly as they are. Leave TUOD's validator untouched — it does not gain a visual path in this plan.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/services/rulesets`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd app && npm run format && cd ..
git add app/src/services/rulesets app/tests/services/rulesets
git commit -m "Route 501 and Score Training batches by capture mode"
```

---

### Task 11: Score Training records dart-level visits

**Files:**
- Modify: `app/src/modules/game/score-training.engine.module.ts`
- Modify: `app/src/modules/game/types.ts` (add `ScoreTrainingInput`)
- Test: `app/tests/modules/game/score-training.engine.module.test.ts`

**Interfaces:**
- Consumes: `DartObservation` (Task 5), `classify` (Task 1).
- Produces:
  - `type ScoreTrainingInput = number | DartObservation`
  - `ScoreTrainingEngine` implements `GameEngine<ScoreTrainingInput, ScoreTrainingState>`
  - `scoreTrainingEngineFactory.create(config, prior?, inputMode?)` where `inputMode` is `"QUICK_SCORE" | "VISUAL_BOARD"`, defaulting to `"QUICK_SCORE"`.

A visual visit is three darts. The turn closes on the third dart; `totalScore` is the sum of the three counted scores.

- [ ] **Step 1: Write the failing test**

Append to `app/tests/modules/game/score-training.engine.module.test.ts`:

```typescript
describe("visual board capture", () => {
  const config = {
    maxVisitScore: 180,
    durationType: "ROUNDS",
    durationValue: 2,
  } as never;

  const trebleTwenty = {
    hitTargetNumber: 20,
    hitZoneKey: "TREBLE",
    locationX: 0,
    locationY: -102,
  } as const;

  const miss = {
    hitTargetNumber: null,
    hitZoneKey: "MISS",
    locationX: 0,
    locationY: -180,
  } as const;

  it("opens a turn on the first dart and closes it on the third", () => {
    const engine = scoreTrainingEngineFactory.create(
      config,
      undefined,
      "VISUAL_BOARD",
    ) as ScoreTrainingEngine;

    engine.record(trebleTwenty);
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.facts().turns[0]!.completedAt).toBeNull();

    engine.record(trebleTwenty);
    engine.record(trebleTwenty);

    const [turn] = engine.facts().turns;
    expect(turn!.darts).toHaveLength(3);
    expect(turn!.totalScore).toBe(180);
    expect(turn!.completedAt).not.toBeNull();
  });

  it("stores each dart's landing coordinate", () => {
    const engine = scoreTrainingEngineFactory.create(
      config,
      undefined,
      "VISUAL_BOARD",
    ) as ScoreTrainingEngine;

    engine.record(trebleTwenty);

    expect(engine.facts().turns[0]!.darts[0]).toMatchObject({
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      score: 60,
      locationX: 0,
      locationY: -102,
    });
  });

  it("counts a miss as zero without a target number", () => {
    const engine = scoreTrainingEngineFactory.create(
      config,
      undefined,
      "VISUAL_BOARD",
    ) as ScoreTrainingEngine;

    engine.record(miss);

    expect(engine.facts().turns[0]!.darts[0]).toMatchObject({
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      score: 0,
    });
    expect(engine.facts().turns[0]!.totalScore).toBe(0);
  });

  it("undoes one dart at a time and removes the turn it opened", () => {
    const engine = scoreTrainingEngineFactory.create(
      config,
      undefined,
      "VISUAL_BOARD",
    ) as ScoreTrainingEngine;

    engine.record(trebleTwenty);
    engine.record(trebleTwenty);

    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns[0]!.darts).toHaveLength(1);

    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns).toHaveLength(0);

    expect(engine.undo()).toBe(false);
  });

  it("rehydrates a part-thrown visit from persisted facts", () => {
    const engine = scoreTrainingEngineFactory.create(
      config,
      undefined,
      "VISUAL_BOARD",
    ) as ScoreTrainingEngine;
    engine.record(trebleTwenty);
    engine.record(trebleTwenty);

    const revived = scoreTrainingEngineFactory.create(
      config,
      engine.facts(),
      "VISUAL_BOARD",
    ) as ScoreTrainingEngine;
    revived.record(trebleTwenty);

    const [turn] = revived.facts().turns;
    expect(turn!.darts).toHaveLength(3);
    expect(turn!.totalScore).toBe(180);
    expect(turn!.completedAt).not.toBeNull();
  });

  it("leaves quick-score behaviour unchanged", () => {
    const engine = scoreTrainingEngineFactory.create(
      config,
    ) as ScoreTrainingEngine;

    engine.record(85);

    const [turn] = engine.facts().turns;
    expect(turn!.darts).toHaveLength(0);
    expect(turn!.totalScore).toBe(85);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/score-training.engine.module.test.ts`
Expected: FAIL — `create` takes two arguments, and `record` rejects an observation.

- [ ] **Step 3: Add the input type**

In `app/src/modules/game/types.ts`, after `DartObservation`, add:

```typescript
/** How a session feeds visits to an engine: a whole visit total, or one dart at a time. */
export type EngineInputMode = "QUICK_SCORE" | "VISUAL_BOARD";

/** Score Training accepts a visit total under QUICK_SCORE, one dart under VISUAL_BOARD. */
export type ScoreTrainingInput = number | DartObservation;
```

- [ ] **Step 4: Widen the factory contract**

In `app/src/modules/game/interfaces.ts`, change the factory's `create` signature to:

```typescript
export interface GameEngineFactory<TConfig, TInput, TState> {
  readonly rulesetVersionKey: RulesetVersionKey;
  create(
    config: TConfig,
    prior?: EngineFacts,
    inputMode?: EngineInputMode,
  ): GameEngine<TInput, TState>;
}
```

Add `EngineInputMode` to the existing `import type { EngineFacts } from "./types";` line.

- [ ] **Step 5: Implement the visual path**

In `score-training.engine.module.ts`, add the imports:

```typescript
import { classify } from "@lib/game/board/board-geometry.module";
import type {
  DartObservation,
  EngineFacts,
  EngineInputMode,
  ScoreTrainingInput,
  ScoreTrainingState,
  StageFact,
  TurnFact,
} from "./types";
```

Add `DARTS_PER_VISIT`, change the class declaration and constructor, and add the visual recording path:

```typescript
const DARTS_PER_VISIT = 3;

export class ScoreTrainingEngine implements GameEngine<
  ScoreTrainingInput,
  ScoreTrainingState
> {
  readonly rulesetVersionKey = "SCORE_TRAINING_V1";
  private readonly turns: TurnFact[];
  private timerExpired = false;

  constructor(
    private readonly config: ScoreTrainingSnapshot,
    prior?: EngineFacts,
    private readonly inputMode: EngineInputMode = "QUICK_SCORE",
  ) {
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }
```

Replace `record()` with a dispatcher plus the two paths:

```typescript
  /**
   * Appends one visit total, or one dart, depending on the session's input
   * mode.
   * @throws when a quick-score visit is not a whole number within the
   *   ruleset's `0..maxVisitScore` range; the log is left untouched.
   */
  record(input: ScoreTrainingInput): ScoreTrainingState {
    if (this.inputMode === "VISUAL_BOARD") {
      return this.recordDart(input as DartObservation);
    }
    return this.recordVisitTotal(input as number);
  }

  private recordVisitTotal(visitScore: number): ScoreTrainingState {
    if (!this.isPlayable(visitScore)) {
      throw new Error(
        `Enter a score between 0 and ${this.config.maxVisitScore}.`,
      );
    }

    this.turns.push({
      clientKey: crypto.randomUUID(),
      stageClientKey: STAGE.clientKey,
      sequence: this.turns.length + 1,
      completedAt: new Date().toISOString(),
      totalScore: visitScore,
      darts: [],
    });
    return this.state();
  }

  /** The visit still being thrown, or null when the last one closed. */
  private openTurn(): TurnFact | null {
    const last = this.turns.at(-1);
    if (!last || last.darts.length >= DARTS_PER_VISIT) return null;
    return last;
  }

  private recordDart(observation: DartObservation): ScoreTrainingState {
    const resolved =
      observation.locationX === null || observation.locationY === null
        ? { targetNumber: null, zoneKey: observation.hitZoneKey, score: 0 }
        : classify(observation.locationX, observation.locationY);

    let turn = this.openTurn();
    if (!turn) {
      turn = {
        clientKey: crypto.randomUUID(),
        stageClientKey: STAGE.clientKey,
        sequence: this.turns.length + 1,
        completedAt: null,
        totalScore: 0,
        darts: [],
      };
      this.turns.push(turn);
    }

    turn.darts.push({
      sequence: turn.darts.length + 1,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: resolved.targetNumber,
      hitZoneKey: resolved.zoneKey,
      score: resolved.score,
      locationX: observation.locationX,
      locationY: observation.locationY,
    });

    turn.totalScore = turn.darts.reduce((sum, dart) => sum + dart.score, 0);
    if (turn.darts.length === DARTS_PER_VISIT) {
      turn.completedAt = new Date().toISOString();
    }

    return this.state();
  }
```

Replace `undo()` with:

```typescript
  /**
   * Pops the last recorded unit — a whole visit under quick score, a single
   * dart under visual capture, taking the turn with it when that dart was the
   * only one in it.
   * @returns true if something was removed; false if there was nothing to undo.
   */
  undo(): boolean {
    if (this.turns.length === 0) return false;

    if (this.inputMode !== "VISUAL_BOARD") {
      this.turns.pop();
      return true;
    }

    const turn = this.turns.at(-1);
    if (!turn) return false;

    turn.darts.pop();
    if (turn.darts.length === 0) {
      this.turns.pop();
      return true;
    }

    turn.totalScore = turn.darts.reduce((sum, dart) => sum + dart.score, 0);
    turn.completedAt = null;
    return true;
  }
```

Change the factory to pass the input mode through:

```typescript
export const scoreTrainingEngineFactory: GameEngineFactory<
  ScoreTrainingSnapshot,
  ScoreTrainingInput,
  ScoreTrainingState
> = {
  rulesetVersionKey: "SCORE_TRAINING_V1",
  create(
    config: ScoreTrainingSnapshot,
    prior?: EngineFacts,
    inputMode?: EngineInputMode,
  ) {
    return new ScoreTrainingEngine(config, prior, inputMode);
  },
};
```

`completesAt(turnCount)` **keeps its parameter** — it stays a pure function of the count it is handed, so the single completion rule still serves both `isComplete()` (the count now) and `wouldComplete()` (the count one visit ahead). Do not change its body.

What does change is the count each caller passes: a part-thrown visit is not a completed turn. Change `state()` to count only closed turns:

```typescript
  state(): ScoreTrainingState {
    return {
      turnCount: this.turns.filter((turn) => turn.completedAt !== null).length,
      timerExpired: this.timerExpired,
    };
  }
```

Then `isComplete()` passes that closed count:

```typescript
  isComplete(): boolean {
    return this.completesAt(this.state().turnCount);
  }
```

and the `wouldComplete` visual branch above passes `this.state().turnCount + 1` — the count as it will stand once the visit in progress closes — rather than `this.turns.length`. Update the branch shown in this step accordingly:

```typescript
  wouldComplete(input: ScoreTrainingInput): boolean {
    if (this.inputMode === "VISUAL_BOARD") {
      const turn = this.openTurn();
      if (!turn || turn.darts.length !== DARTS_PER_VISIT - 1) return false;
      return this.completesAt(this.state().turnCount + 1);
    }

    if (!this.isPlayable(input as number)) return false;
    return this.completesAt(this.state().turnCount + 1);
  }
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/score-training.engine.module.test.ts`
Expected: PASS — including the pre-existing quick-score tests, unchanged.

- [ ] **Step 7: Run the engine gate**

Run: `cd .. && bash scripts/check-game-engines.sh`
Expected: `OK`.

- [ ] **Step 8: Commit**

```bash
cd app && npm run format && cd ..
git add app/src/modules/game app/tests/modules/game
git commit -m "Add dart-level capture to the Score Training engine"
```

---

### Task 11b: Distinguish inner and outer single bands

**Added 2026-08-05 by owner decision, mid-execution.** A single is two disjoint bands — inner (15.9–97 mm) and outer (107–162 mm) — separated by the treble ring, and both are analytically meaningful: a miss vector against a single target is uncomputable without knowing the band. `dart_zones` gains seeded rows 7 `INNER_SINGLE` and 8 `OUTER_SINGLE`; `DartZoneKey` gains both and **retains** bare `SINGLE` for keypad capture, which has no coordinate and cannot know its band. `classify()` never returns bare `SINGLE`; `zoneCentroid()` answers for both bands and still returns `null` for the unbanded value.

Full task text: `.superpowers/sdd/task-11b-brief.md`. Seed is `database/seeds/0006_single_band_dart_zones.sql`; no migration is required, as `dart_zones` is a seeded lookup.

This supersedes the earlier decision that `zoneCentroid` returns `null` for singles — that resolution stands only for the unbanded `SINGLE` value.

---

### Task 12: 501 records dart-level visits

**Files:**
- Modify: `app/src/modules/game/five-oh-one.engine.module.ts`
- Modify: `app/src/modules/game/types.ts` (add `FiveOhOneInput`)
- Test: `app/tests/modules/game/five-oh-one.engine.module.test.ts`

**Interfaces:**
- Consumes: `DartObservation`, `EngineInputMode`, `classify`.
- Produces:
  - `type FiveOhOneInput = FiveOhOneVisitInput | DartObservation`
  - `fiveOhOneEngineFactory.create(config, prior?, inputMode?)`

This is where the bust becomes visible: a busted visit keeps its dart rows and their real scores while `totalScore` goes to 0.

- [ ] **Step 1: Write the failing test**

Append to `app/tests/modules/game/five-oh-one.engine.module.test.ts`:

```typescript
describe("visual board capture", () => {
  const config = {
    startingScore: 501,
    maxVisitScore: 180,
    legsToWin: 1,
  } as never;

  const dartAt = (x: number, y: number) => ({
    hitTargetNumber: null,
    hitZoneKey: "MISS" as const,
    locationX: x,
    locationY: y,
  });

  const trebleTwenty = dartAt(0, -102);
  const doubleTwenty = dartAt(0, -166);

  it("deducts each dart from the remaining score as it lands", () => {
    const engine = fiveOhOneEngineFactory.create(
      config,
      undefined,
      "VISUAL_BOARD",
    ) as FiveOhOneEngine;

    engine.record(trebleTwenty);
    expect(engine.state().remainingScore).toBe(441);

    engine.record(trebleTwenty);
    expect(engine.state().remainingScore).toBe(381);
  });

  it("keeps dart rows with real scores when a visit busts", () => {
    const engine = fiveOhOneEngineFactory.create(
      { ...(config as object), startingScore: 70 } as never,
      undefined,
      "VISUAL_BOARD",
    ) as FiveOhOneEngine;

    engine.record(trebleTwenty);
    engine.record(trebleTwenty);

    const busted = engine.facts().turns.at(-1)!;
    expect(busted.totalScore).toBe(0);
    expect(busted.darts.map((dart) => dart.score)).toEqual([60, 60]);
    expect(engine.state().remainingScore).toBe(70);
  });

  it("wins the leg on a double that reaches exactly zero", () => {
    const engine = fiveOhOneEngineFactory.create(
      { ...(config as object), startingScore: 40 } as never,
      undefined,
      "VISUAL_BOARD",
    ) as FiveOhOneEngine;

    engine.record(doubleTwenty);

    expect(engine.isComplete()).toBe(true);
    const turn = engine.facts().turns.at(-1)!;
    expect(turn.darts).toHaveLength(1);
    expect(turn.totalScore).toBe(40);
  });

  it("does not win on a non-double that reaches zero", () => {
    const engine = fiveOhOneEngineFactory.create(
      { ...(config as object), startingScore: 60 } as never,
      undefined,
      "VISUAL_BOARD",
    ) as FiveOhOneEngine;

    engine.record(trebleTwenty);

    expect(engine.isComplete()).toBe(false);
    expect(engine.facts().turns.at(-1)!.totalScore).toBe(0);
  });

  it("undoes one dart at a time", () => {
    const engine = fiveOhOneEngineFactory.create(
      config,
      undefined,
      "VISUAL_BOARD",
    ) as FiveOhOneEngine;

    engine.record(trebleTwenty);
    engine.record(trebleTwenty);
    expect(engine.undo()).toBe(true);
    expect(engine.state().remainingScore).toBe(441);
  });

  it("leaves quick-score behaviour unchanged", () => {
    const engine = fiveOhOneEngineFactory.create(config) as FiveOhOneEngine;

    engine.record({ scoreAttempted: 60 });

    expect(engine.state().remainingScore).toBe(441);
    expect(engine.facts().turns.at(-1)!.darts).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/five-oh-one.engine.module.test.ts`
Expected: FAIL — `create` takes two arguments.

- [ ] **Step 3: Add the input type**

In `app/src/modules/game/types.ts`, after `FiveOhOneVisitInput`, add:

```typescript
/** 501 accepts a visit total under QUICK_SCORE, one dart under VISUAL_BOARD. */
export type FiveOhOneInput = FiveOhOneVisitInput | DartObservation;
```

- [ ] **Step 4: Implement the visual path**

In `five-oh-one.engine.module.ts`, add the constructor parameter `private readonly inputMode: EngineInputMode = "QUICK_SCORE"` as the third argument (same shape as Task 11), import `classify` and `DartObservation` / `EngineInputMode` / `FiveOhOneInput`, and add:

```typescript
const DARTS_PER_VISIT = 3;

  /** The visit still being thrown in the open leg, or null when the last one closed. */
  private openVisit(): TurnFact | null {
    const last = this.turns.at(-1);
    if (!last || last.completedAt !== null) return null;
    return last;
  }

  /**
   * Records one dart. The visit closes when it busts, when it checks out on a
   * double, or on the third dart.
   *
   * A busted visit keeps its dart rows and their real board scores while
   * `totalScore` goes to 0 — counted zero, thrown non-zero. That divergence is
   * the fact that makes bust rate computable, and it is why `totalScore` is
   * not simply the sum of the visit's darts here.
   */
  private recordDart(observation: DartObservation): FiveOhOneState {
    const resolved =
      observation.locationX === null || observation.locationY === null
        ? { targetNumber: null, zoneKey: observation.hitZoneKey, score: 0 }
        : classify(observation.locationX, observation.locationY);

    const leg = this.openLeg();
    let visit = this.openVisit();
    if (!visit) {
      visit = {
        clientKey: crypto.randomUUID(),
        stageClientKey: leg.clientKey,
        sequence: this.turnCountIn(leg.clientKey) + 1,
        completedAt: null,
        totalScore: 0,
        darts: [],
      };
      this.turns.push(visit);
    }

    visit.darts.push({
      sequence: visit.darts.length + 1,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: resolved.targetNumber,
      hitZoneKey: resolved.zoneKey,
      score: resolved.score,
      locationX: observation.locationX,
      locationY: observation.locationY,
    });

    const remainingBefore = this.remainingBeforeVisit(visit);
    const thrown = visit.darts.reduce((sum, dart) => sum + dart.score, 0);
    const remainingAfter = remainingBefore - thrown;
    const checkedOut = remainingAfter === 0 && resolved.zoneKey === "DOUBLE";
    const busted =
      remainingAfter < 0 ||
      remainingAfter === 1 ||
      (remainingAfter === 0 && !checkedOut);

    if (busted) {
      visit.totalScore = 0;
      visit.completedAt = new Date().toISOString();
    } else {
      visit.totalScore = thrown;
      if (checkedOut || visit.darts.length === DARTS_PER_VISIT) {
        visit.completedAt = new Date().toISOString();
      }
    }

    if (checkedOut && !this.deriveState().status.startsWith("WON")) {
      this.stages.push(legStage(this.stages.length + 1));
    }

    return this.deriveState();
  }
```

`remainingBeforeVisit(visit)` is the leg's starting score minus the `totalScore` of every **earlier** turn in the same leg — add it as a private helper reading `this.turns`, and reuse the config's `startingScore`. `openLeg()`, `turnCountIn()` and `legStage()` already exist in this file; do not duplicate them.

Dispatch from `record()` exactly as Task 11 does, and extend `undo()` with the per-dart branch, clearing `completedAt` and recomputing `totalScore` from the remaining darts, popping the turn when its last dart goes.

**`wouldComplete()` — do not copy the shape this plan originally showed.** `openVisit()` returns `null` both at session start and right after a visit closes, which is exactly when the next dart *opens* a visit and cannot close anything. Guard with `if (!visit || visit.darts.length !== DARTS_PER_VISIT - 1) return false;` — only a dart landing in an already-open visit that holds two darts can complete it. 501 differs from Score Training in one way: a visit can also close early on a checkout or a bust, so `wouldComplete()` must additionally answer `true` when the dart under consideration would check out the final leg, regardless of how many darts the visit holds. Test both: a dart that opens a visit never completes the session, and a first-dart checkout on the last leg does. (Corrected 2026-08-05 after the same inverted condition shipped in Task 11 and was caught in review.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/five-oh-one.engine.module.test.ts`
Expected: PASS — including all pre-existing quick-score tests.

- [ ] **Step 6: Run the full suite and the engine gate**

Run: `cd app && npx vitest run && cd .. && bash scripts/check-game-engines.sh`
Expected: all tests pass; gate reports `OK`.

- [ ] **Step 7: Commit**

```bash
cd app && npm run format && cd ..
git add app/src/modules/game app/tests/modules/game
git commit -m "Add dart-level capture to the 501 engine, making busts visible"
```

---

### Task 13: `v_dart_locations` read model

**Files:**
- Create: `database/migrations/0018_dart_location_read_model.sql`

**Interfaces:**
- Consumes: `darts.location_x` / `location_y` (Task 3).
- Produces: view `v_dart_locations`.

This plan's chain is `0017` then `0018`, contiguous. Plan 2 continues from `0019`.

The view carries **no board geometry**: radius and angle are plain arithmetic. Miss margin is derived in the app read layer from `zoneCentroid`, so there is exactly one definition of where a zone's centre is.

- [ ] **Step 1: Write the migration**

Create `database/migrations/0018_dart_location_read_model.sql`:

```sql
-- ============================================================
-- Migration: 0018_dart_location_read_model.sql
--
-- Purpose:
-- Expose dart landing coordinates for spatial analysis.
--
-- radius_mm and angle_degrees are plain arithmetic over the
-- stored coordinate — no board geometry lives here. Miss
-- margin needs a zone centroid, which is board geometry, so it
-- is derived in the application read layer from the same
-- board-geometry module the client and Worker use. A second
-- copy in SQL would drift from the classifier.
--
-- angle_degrees is the clockwise bearing from the upward
-- vertical, matching the classifier's sector convention.
-- ============================================================

-- migrate:up
CREATE VIEW v_dart_locations AS
SELECT es.id AS session_id,
    es.player_id,
    gt.implementation_key AS game_type_key,
    im.implementation_key AS input_mode_key,
    st.id AS stage_id,
    t.sequence_number AS turn_sequence,
    t.total_score AS turn_total_score,
    d.dart_number,
    d.hit_target_number,
    hit_zone.implementation_key AS hit_zone_key,
    d.intended_target_number,
    intended_zone.implementation_key AS intended_zone_key,
    d.score,
    d.location_x,
    d.location_y,
    SQRT(
        POWER(d.location_x, 2) + POWER(d.location_y, 2)
    ) AS radius_mm,
    MOD(
        DEGREES(
            ATAN2(d.location_x, - d.location_y)
        ) + 360,
        360
    ) AS angle_degrees
FROM darts d
    JOIN turns t ON t.id = d.turn_id
    JOIN exercise_stages st ON st.id = t.exercise_stage_id
    JOIN exercise_sessions es ON es.id = st.exercise_session_id
    JOIN game_types gt ON gt.id = es.game_type_id
    JOIN input_modes im ON im.id = es.input_mode_id
    LEFT JOIN dart_zones hit_zone ON hit_zone.id = d.hit_zone_id
    LEFT JOIN dart_zones intended_zone ON intended_zone.id = d.intended_zone_id
WHERE d.location_x IS NOT NULL
    AND d.location_y IS NOT NULL;

COMMENT ON VIEW v_dart_locations IS 'Dart landing coordinates in millimetres with derived polar form; miss margin is computed in the application read layer.';

-- migrate:down
DROP VIEW IF EXISTS v_dart_locations;
```

- [ ] **Step 2: Apply and verify**

Run: `cd app && npm run db:migrate && npx dbmate --url "$DATABASE_URL" query "SELECT * FROM v_dart_locations LIMIT 1;"`
Expected: migration applies; the query returns zero rows without error (no visual sessions exist yet).

- [ ] **Step 3: Verify the polar arithmetic against the classifier's convention**

Run:

```bash
cd app && npx dbmate --url "$DATABASE_URL" query "
  SELECT MOD(DEGREES(ATAN2(0, -(-102))) + 360, 360) AS up,
         MOD(DEGREES(ATAN2(102, 0)) + 360, 360) AS right_side;
"
```

Expected: `up = 0`, `right_side = 90` — the same clockwise-from-vertical bearing `classify` uses.

- [ ] **Step 4: Commit**

```bash
git add database/migrations/0018_dart_location_read_model.sql
git commit -m "Add v_dart_locations read model"
```

---

### Task 14: Miss margin in the read layer

**Files:**
- Create: `app/src/lib/game/board/miss-margin.module.ts`
- Test: `app/tests/lib/game/board/miss-margin.module.test.ts`

**Interfaces:**
- Consumes: `zoneCentroid` (Task 1).
- Produces: `missMargin(dart: { intendedTargetNumber: number | null; intendedZoneKey: DartZoneKey | null; locationX: number | null; locationY: number | null }): MissMargin | null` where `type MissMargin = { distanceMm: number; bearingDegrees: number }`.

Returns `null` when the ruleset declared no intent or the dart has no coordinate — 501 and Score Training both hit that case, and that is expected, not a failure.

- [ ] **Step 1: Write the failing test**

Create `app/tests/lib/game/board/miss-margin.module.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { missMargin } from "@lib/game/board/miss-margin.module";

describe("missMargin", () => {
  it("measures the distance from the intended zone centre", () => {
    const margin = missMargin({
      intendedTargetNumber: 20,
      intendedZoneKey: "TREBLE",
      locationX: 0,
      locationY: -92,
    });

    expect(margin).not.toBeNull();
    expect(margin!.distanceMm).toBeCloseTo(10, 6);
  });

  it("reports the bearing of the miss clockwise from vertical", () => {
    const margin = missMargin({
      intendedTargetNumber: 20,
      intendedZoneKey: "TREBLE",
      locationX: 10,
      locationY: -102,
    });

    expect(margin!.bearingDegrees).toBeCloseTo(90, 6);
  });

  it("returns null when the ruleset declared no intent", () => {
    expect(
      missMargin({
        intendedTargetNumber: null,
        intendedZoneKey: null,
        locationX: 0,
        locationY: -102,
      }),
    ).toBeNull();
  });

  it("returns null when the dart has no coordinate", () => {
    expect(
      missMargin({
        intendedTargetNumber: 20,
        intendedZoneKey: "TREBLE",
        locationX: null,
        locationY: null,
      }),
    ).toBeNull();
  });

  it("measures a bull miss from the board centre", () => {
    const margin = missMargin({
      intendedTargetNumber: 25,
      intendedZoneKey: "INNER_BULL",
      locationX: 3,
      locationY: -4,
    });

    expect(margin!.distanceMm).toBeCloseTo(5, 6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/board/miss-margin.module.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the module**

Create `app/src/lib/game/board/miss-margin.module.ts`:

```typescript
import type { DartZoneKey } from "@modules/game/types";
import { zoneCentroid } from "./board-geometry.module";
import type { MissMargin, MissMarginInput } from "./types";

/**
 * How far a dart landed from the centre of the zone its ruleset declared, and
 * in which direction. Returns null when there is nothing to measure against —
 * the ruleset declared no intent, or the landing point was never seen. 501 and
 * Score Training declare no intent, so every dart in those games returns null;
 * that is the designed outcome, not a gap.
 *
 * The centroid comes from the shared board-geometry module rather than from
 * SQL, so the client, the Worker and this read path all measure from the same
 * point.
 */
export function missMargin(dart: MissMarginInput): MissMargin | null {
  if (dart.intendedZoneKey === null) return null;
  if (dart.locationX === null || dart.locationY === null) return null;

  const centre = zoneCentroid(dart.intendedTargetNumber, dart.intendedZoneKey);
  if (centre === null) return null;

  const dx = dart.locationX - centre.x;
  const dy = dart.locationY - centre.y;

  return {
    distanceMm: Math.sqrt(dx * dx + dy * dy),
    bearingDegrees: (Math.atan2(dx, -dy) * (180 / Math.PI) + 360) % 360,
  };
}
```

Add to `app/src/lib/game/board/types.ts`:

```typescript
/** A dart as the read layer sees it, carrying declared intent and a landing point. */
export type MissMarginInput = {
  intendedTargetNumber: number | null;
  intendedZoneKey: DartZoneKey | null;
  locationX: number | null;
  locationY: number | null;
};

/** How far from the declared aim point a dart landed, and in which direction. */
export type MissMargin = {
  distanceMm: number;
  bearingDegrees: number;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/board/miss-margin.module.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
cd app && npm run format && cd ..
git add app/src/lib/game/board app/tests/lib/game/board
git commit -m "Derive miss margin from the shared board geometry"
```

---

### Task 15: Documentation and context maintenance

**Files:**
- Modify: `docs/architecture/05-Database/06-Spec/04-Runtime-Layer.md`
- Modify: `docs/architecture/05-Database/06-Spec/05-Read-Model-Layer.md`
- Modify: `docs/architecture/05-Database/05-Views.md`
- Modify: `docs/architecture/00-Context-Map.md`
- Modify: `decisions/database.md`, `decisions/game-engine.md`
- Modify: `docs/architecture/05-Database/03-Migrations.md`

**Interfaces:**
- Consumes: everything above.
- Produces: documentation that matches the shipped schema.

Docs outrank code in this repo's authority order, so leaving them stale is a defect even with every test green.

- [ ] **Step 1: Replace the deferred-coordinates paragraph**

In `04-Runtime-Layer.md`, find the paragraph beginning "`location_x` / `location_y` board coordinates are deferred" and replace it with:

```markdown
`location_x` / `location_y` store the dart's landing point in regulation
millimetres, origin at the bull centre, y increasing downward to match
`dartboard.svg`. They are written together or not at all
(`chk_dart_location_pair`, migration `0017`). A dart with no coordinate in a
VISUAL_BOARD session is a throw whose landing point was never seen — a
bounce-out — and stores `MISS` with score 0. A miss always stores
`hit_target_number` NULL, never the sector it landed in: that column means
"this number was actually hit", and the sector stays recoverable from the
coordinate. <!-- 2026-08-05 -->
```

- [ ] **Step 2: Add the fourth capture-depth pairing**

In the same file, in the "Capture depth follows the session's capture mode" list, add:

```markdown
- ANALYTICS + VISUAL_BOARD — hit target, hit zone, score and landing
  coordinates on every dart; intention only where the ruleset declares one
  <!-- 2026-08-05 -->
```

- [ ] **Step 3: Scope the bust limitation to quick score**

Retitle the section "Known limitation — a 501 bust is indistinguishable from a scoreless visit" to "Known limitation — a QUICK_SCORE 501 bust is indistinguishable from a scoreless visit", and append:

```markdown
**Retired for VISUAL_BOARD sessions (2026-08-05).** A visual 501 visit persists
dart rows carrying their real board scores while `turns.total_score` is 0 for a
bust. Counted zero against thrown non-zero is the fact that distinguishes the
two cases, so bust rate and true checkout percentage are computable for these
sessions. Sessions played under QUICK_SCORE remain unfixable — completed
gameplay is immutable and no coordinate exists to recover.
```

- [ ] **Step 4: Add the `total_score` bust carve-out**

In the `turns` section, after "The application is the only writer and keeps `total_score` consistent with dart rows when they exist", append:

```markdown
One deliberate exception: a busted 501 visit stores `total_score = 0` while its
dart rows keep their real board scores. Counted and thrown legitimately diverge
there, and that divergence is what makes the bust visible.
<!-- 2026-08-05 -->
```

- [ ] **Step 5: Register the view**

Add a `v_dart_locations` contract row to `06-Spec/05-Read-Model-Layer.md` and a matching entry in `05-Database/05-Views.md`, following each file's existing format. State that miss margin is **not** in the view and lives in `app/src/lib/game/board/miss-margin.module.ts`.

- [ ] **Step 6: Update the migration chain doc**

In `05-Database/03-Migrations.md`, extend the chain description from `0001`–`0016` to `0001`–`0018`, describing `0017` (dart location columns + the two `player_settings` FKs) and `0018` (`v_dart_locations`).

- [ ] **Step 7: Append the decisions**

To `decisions/database.md`, append a new decision recording dart coordinates shipped as `NUMERIC(6,2)` millimetres with `chk_dart_location_pair`, superseding the deferral in `04-Runtime-Layer.md`. To `decisions/game-engine.md`, append one recording the engine input-mode branch and the mode-scoped bust visibility. Use the next free `D<n>` ids and follow the existing block format exactly — never edit an existing block.

- [ ] **Step 8: Update the context map**

In `00-Context-Map.md`: bump the version line with a dated note, update the migration range in **Current Implementation State**, and register `app/src/lib/game/board/board-geometry.module.ts`, `miss-margin.module.ts` and `app/src/services/rulesets/visual-board.validator.ts` in the File Inventory.

- [ ] **Step 9: Run every gate**

Run:

```bash
cd .. && bash scripts/check-context-map.sh && bash scripts/check-doc-links.sh && bash scripts/check-context-budget.sh && bash scripts/check-decision-ids.sh && bash scripts/check-no-inline-comments.sh && bash scripts/check-type-barrels.sh && bash scripts/check-file-locations.sh && bash scripts/check-constraint-mirror.sh && bash scripts/check-game-engines.sh
```

Expected: every script reports OK. Fix and re-run until they do — do not proceed with a failing gate.

- [ ] **Step 10: Run the full validation**

Run: `cd app && npm run validate:app`
Expected: passes end to end.

- [ ] **Step 11: Commit**

```bash
cd app && npm run format && cd ..
git add docs decisions
git commit -m "Document dart location capture and mode-scoped bust visibility"
```

---

## Self-Review

**Spec coverage.** Migration `0017` columns and constraint (Task 3); `VISUAL_BOARD` seed (Task 4); classifier and geometry (Task 1); SVG parity (Task 2); type widening (Tasks 5–6); batch schema mirror (Task 7); write path (Task 8); Worker re-classification (Task 9); validator routing (Task 10); both engines' visual paths, turn totals as sums, per-dart undo, rehydration, bust asymmetry (Tasks 11–12); `v_dart_locations` (Task 13); miss margin outside SQL (Task 14); every documentation edit and gate (Task 15).

Deliberately deferred to plan 2, per the split: the capability table itself, its seed rows, the composite FK, the cross-runtime capability constant, `check-game-engines.sh`'s input-mode assertion, and the settings endpoints. This plan creates nothing it does not use.

**Type consistency.** `classify` returns `BoardHit` in Tasks 1, 9, 11 and 12. `EngineInputMode` is defined once (Task 11) and reused in Task 12. `DartObservation` and `DartFact` carry `locationX` / `locationY` from Task 5 onward, including the Zod mirror in Task 7 and the Worker validator in Task 9. `zoneCentroid` is defined in Task 1 and consumed only in Task 14.

**Known softness, stated rather than papered over.** Tasks 8, 10 and 12 point at files whose exact exported names this plan cannot pin down without opening them — Task 8's dart-insert repository, Task 10's per-ruleset validator signatures, and Task 12's `remainingBeforeVisit` helper, which must be written against the engine's existing leg bookkeeping. Each of those steps begins with a locate command and says to match the real names found there. That is a genuine gap in "complete code in every step"; the alternative would have been inventing signatures that do not exist.

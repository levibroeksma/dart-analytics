# DartBot Phase 1 — Throw Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build DartBot's deterministic throw pipeline — aim resolution, anisotropic scatter, wire bounce-out, and a hand-set level curve — so a fixed target can be thrown at with a byte-identical dart stream for a given `(seed, dartIndex)`.

**Architecture:** Five pure-function modules under `app/src/modules/dartbot/` (`rng`, `skill-profile`, `aim-resolver`, `throw-engine`, plus their `types.ts`/`interfaces.ts` barrels) reuse the shared board geometry (`classify()`, `zoneCentroid()`) and never touch game state, scoring, or `Math.random()`. No strategy layer, no `DartBot` class, no game engine wiring — those are later phases. This plan implements phase 1 of `docs/superpowers/specs/2026-09-01-dartbot-v1-delivery-design.md`, scoped from `docs/architecture/08-DartBot.md` §Module Boundary, §The Throw Pipeline, §The scatter model, §Skill Model, §Determinism and Replay.

**Tech Stack:** TypeScript, Vitest, existing `app/src/lib/game/board/board-geometry.module.ts`.

## Global Constraints

- `Math.random()` never appears in `modules/dartbot/` (`08-DartBot.md` §Determinism and Replay).
- DartBot never re-declares board geometry — it imports `classify()` / `zoneCentroid()` from `@lib/game/board/board-geometry.module`, never a private radius or sector table (`08-DartBot.md` §Module Boundary, §Anti-Patterns).
- DartBot never reads, computes, or steers toward a score (`08-DartBot.md` §Guiding Principle).
- No timers or `Date.now()` inside `modules/dartbot/` (`08-DartBot.md` §Anti-Patterns).
- Type and interface declarations go in the folder's `types.ts` / `interfaces.ts` barrels — never inline `export type` in a `.module.ts` (`08-DartBot.md` §Module Boundary).
- No `//` or `/* */` comments inside function bodies anywhere under `app/src/**/*.ts` (`app/CLAUDE.md`); JSDoc above a declaration is fine.
- Tests live under `app/tests/`, mirroring `app/src/` (`app/CLAUDE.md`).
- A source edit with no test edit is not a completed task — every `.ts` file under `app/src/` needs a covering test (`app/CLAUDE.md`, D224).
- Done means `cd app && npm run validate:app` exits zero with 0 errors/warnings/hints (`app/CLAUDE.md`).
- Run `cd app && npm run format` before considering any task's diff final.
- This repo does not use git worktrees — check out the task branch directly (`git checkout -b dartbot-1-throw-engine`) in the main working copy.
- Every task uses a dedicated branch; do not merge to `main` directly (root `CLAUDE.md` Hard Invariants).

---

## File Structure

```
app/src/modules/dartbot/
├── interfaces.ts          # DartRng contract
├── types.ts                # ThrowIntent, SkillProfile, BotThrow
├── rng.module.ts            # seeded PRNG, keyed by (seed, dartIndex)
├── skill-profile.module.ts  # LEVEL_SKILL_TABLE (hand-set prior) + skillProfileForLevel()
├── aim-resolver.module.ts   # ThrowIntent + SkillProfile -> aim BoardPoint
└── throw-engine.module.ts   # aim + scatter + bounce + classify -> BotThrow

app/tests/modules/dartbot/
├── rng.module.test.ts
├── skill-profile.module.test.ts
├── aim-resolver.module.test.ts
├── throw-engine.module.test.ts
└── throw-engine.determinism.test.ts
```

Each `.ts` file has exactly one of the responsibilities above. `throw-engine.module.ts` is the only file that imports the shared geometry module; every other new file imports only from inside `modules/dartbot/`.

---

### Task 1: Register `modules/dartbot/` in the folder-structure doc

`08-DartBot.md` §Module Boundary §Suffix registration states two edits are needed to `07-Frontend/02-Folder-Structure.md` before the first DartBot file lands: widen the `.module.ts` suffix row, and add the `.strategy.module.ts` row. This task also adds `modules/dartbot/` to the authoritative tree so the next tasks aren't creating an undocumented directory.

**Files:**
- Modify: `docs/architecture/07-Frontend/02-Folder-Structure.md`
- Modify: `docs/architecture/00-File-Inventory.md`

- [ ] **Step 1: Update the frontmatter date and version line**

In `docs/architecture/07-Frontend/02-Folder-Structure.md`, change line 5:

```diff
-updated: 2026-07-26
+updated: 2026-09-01
```

And change line 10:

```diff
-> **Version:** 0.2.2 (cross-runtime `lib/game/rulesets/`, 2026-07-26; prior 0.2.1 zero-exception .ts file-location rule, 2026-07-16)
+> **Version:** 0.2.3 (DartBot module suffix registration — `.module.ts` widened, `.strategy.module.ts` added, `modules/dartbot/` in the tree, 2026-09-01; prior 0.2.2 cross-runtime `lib/game/rulesets/`, 2026-07-26)
```

- [ ] **Step 2: Add `modules/dartbot/` to the Authoritative Tree**

In the same file, change:

```diff
 ├── modules/
 │   ├── ui/                          # portable OOP (*.module.ts)
-│   └── game/                        # *.engine.module.ts, *.payload.module.ts
+│   ├── game/                        # *.engine.module.ts, *.payload.module.ts
+│   └── dartbot/                     # simulated opponent (*.module.ts, *.strategy.module.ts)
```

- [ ] **Step 3: Widen the `.module.ts` suffix row and add `.strategy.module.ts`**

In the File Suffix Conventions table, change:

```diff
-| `.module.ts` | Portable UI OOP class (`modules/ui/`) | **Forbidden** |
+| `.module.ts` | Portable UI OOP class (`modules/ui/`) **or DartBot module (`modules/dartbot/`)** | **Forbidden** |
 | `.engine.module.ts` | Game state machines (`modules/game/`) | **Forbidden** |
 | `.payload.module.ts` | API payload assembly (`modules/game/`) | **Forbidden** |
+| `.strategy.module.ts` | DartBot target selection per ruleset (`modules/dartbot/strategy/`) | **Forbidden** |
```

- [ ] **Step 4: Update the File Inventory entry**

In `docs/architecture/00-File-Inventory.md`, find the row for `07-Frontend/02-Folder-Structure.md` and update its "Answers" cell:

```diff
-| `07-Frontend/02-Folder-Structure.md` | `app/src/` tree, aliases, suffixes; cross-runtime `lib/game/rulesets/` (2026-07-26) | canonical | ~1.9k |
+| `07-Frontend/02-Folder-Structure.md` | `app/src/` tree, aliases, suffixes; cross-runtime `lib/game/rulesets/` (2026-07-26); `modules/dartbot/` + `.strategy.module.ts` registered (2026-09-01) | canonical | ~2.0k |
```

- [ ] **Step 5: Run the doc gates and fix any drift they report**

```bash
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
```

If `check-context-budget.sh` reports a different token estimate than `~2.0k` for `02-Folder-Structure.md`, update the File Inventory cell to match what it reports.

- [ ] **Step 6: Commit**

```bash
git add docs/architecture/07-Frontend/02-Folder-Structure.md docs/architecture/00-File-Inventory.md
git commit -m "docs: register modules/dartbot/ and .strategy.module.ts suffix"
```

---

### Task 2: Seeded, per-dart RNG

Every dart's randomness must be a pure function of `(seed, dartIndex)` — never a running instance-held stream — so an undone and re-thrown dart reproduces identically without replaying earlier darts (`08-DartBot.md` §Determinism and Replay).

**Files:**
- Create: `app/src/modules/dartbot/interfaces.ts`
- Create: `app/src/modules/dartbot/rng.module.ts`
- Test: `app/tests/modules/dartbot/rng.module.test.ts`

**Interfaces:**
- Produces: `DartRng` (`{ uniform(): number; gaussianPair(): [number, number] }`), `createDartRng(seed: number, dartIndex: number): DartRng`

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/modules/dartbot/rng.module.test.ts
import { describe, expect, it, vi } from "vitest";
import { createDartRng } from "@modules/dartbot/rng.module";

describe("createDartRng", () => {
  it("produces a byte-identical stream for the same seed and dart index", () => {
    const a = createDartRng(42, 3);
    const b = createDartRng(42, 3);
    const drawsA = [a.uniform(), a.uniform(), ...a.gaussianPair()];
    const drawsB = [b.uniform(), b.uniform(), ...b.gaussianPair()];
    expect(drawsA).toEqual(drawsB);
  });

  it("produces a different stream for a different dart index with the same seed", () => {
    const first = createDartRng(42, 0);
    const second = createDartRng(42, 1);
    expect(first.uniform()).not.toBe(second.uniform());
  });

  it("keeps uniform() draws inside [0, 1)", () => {
    const rng = createDartRng(7, 0);
    for (let i = 0; i < 50; i++) {
      const value = rng.uniform();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("never calls Math.random", () => {
    const spy = vi.spyOn(Math, "random");
    const rng = createDartRng(1, 0);
    rng.uniform();
    rng.gaussianPair();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/dartbot/rng.module.test.ts`
Expected: FAIL — `Cannot find module '@modules/dartbot/rng.module'`

- [ ] **Step 3: Write the interface**

```typescript
// app/src/modules/dartbot/interfaces.ts
export interface DartRng {
  uniform(): number;
  gaussianPair(): [number, number];
}
```

- [ ] **Step 4: Write the implementation**

```typescript
// app/src/modules/dartbot/rng.module.ts
import type { DartRng } from "./interfaces";

function hashSeed(seed: number, dartIndex: number): number {
  let state = (seed ^ 0x9e3779b9) >>> 0;
  state = Math.imul(state ^ dartIndex, 0x85ebca6b) >>> 0;
  state ^= state >>> 13;
  state = Math.imul(state, 0xc2b2ae35) >>> 0;
  state ^= state >>> 16;
  return state >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createDartRng(seed: number, dartIndex: number): DartRng {
  const next = mulberry32(hashSeed(seed, dartIndex));
  return {
    uniform: () => next(),
    gaussianPair: () => {
      const u1 = Math.max(next(), Number.EPSILON);
      const u2 = next();
      const radius = Math.sqrt(-2 * Math.log(u1));
      const angle = 2 * Math.PI * u2;
      return [radius * Math.cos(angle), radius * Math.sin(angle)];
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/dartbot/rng.module.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/dartbot/interfaces.ts app/src/modules/dartbot/rng.module.ts app/tests/modules/dartbot/rng.module.test.ts
git commit -m "feat: add DartBot seeded per-dart RNG"
```

---

### Task 3: Hand-set level curve

Lands the `level -> SkillProfile` prior as a named, isolated constant table (the D-E extract, per the delivery design, is a later data edit at this same seam — no plan in the sequence waits on it).

**Files:**
- Create: `app/src/modules/dartbot/types.ts`
- Create: `app/src/modules/dartbot/skill-profile.module.ts`
- Test: `app/tests/modules/dartbot/skill-profile.module.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: `SkillProfile` type, `LEVEL_SKILL_TABLE: Readonly<Record<number, SkillProfile>>`, `skillProfileForLevel(level: number): SkillProfile`

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/modules/dartbot/skill-profile.module.test.ts
import { describe, expect, it } from "vitest";
import {
  LEVEL_SKILL_TABLE,
  skillProfileForLevel,
} from "@modules/dartbot/skill-profile.module";

describe("skillProfileForLevel", () => {
  it("returns the exact table row for a valid level", () => {
    expect(skillProfileForLevel(8)).toBe(LEVEL_SKILL_TABLE[8]);
  });

  it("clamps a level below 1 to level 1", () => {
    expect(skillProfileForLevel(0)).toBe(LEVEL_SKILL_TABLE[1]);
  });

  it("clamps a level above 15 to level 15", () => {
    expect(skillProfileForLevel(20)).toBe(LEVEL_SKILL_TABLE[15]);
  });

  it("defines all fifteen levels", () => {
    expect(Object.keys(LEVEL_SKILL_TABLE)).toHaveLength(15);
  });

  it("shrinks scatter spread monotonically as level increases", () => {
    for (let level = 1; level < 15; level++) {
      const weaker = skillProfileForLevel(level);
      const stronger = skillProfileForLevel(level + 1);
      expect(stronger.sigmaAlongMm).toBeLessThanOrEqual(weaker.sigmaAlongMm);
      expect(stronger.sigmaAcrossMm).toBeLessThanOrEqual(weaker.sigmaAcrossMm);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/dartbot/skill-profile.module.test.ts`
Expected: FAIL — `Cannot find module '@modules/dartbot/skill-profile.module'`

- [ ] **Step 3: Write the types**

```typescript
// app/src/modules/dartbot/types.ts
/**
 * The execution/aim/collision axes a throw is drawn from. `decision`,
 * `pressure`, `form` and `correlation` (08-DartBot.md §SkillProfile axes)
 * are not consumed until later phases and are added to this type when a
 * consumer needs them.
 */
export type SkillProfile = {
  sigmaAlongMm: number;
  sigmaAcrossMm: number;
  covarianceRotationDegrees: number;
  biasXMm: number;
  biasYMm: number;
  outlierRate: number;
  outlierSigmaMm: number;
  bedOffsetMm: number;
  bounceOutRate: number;
  deflectionRadiusMm: number;
};
```

- [ ] **Step 4: Write the level curve table**

```typescript
// app/src/modules/dartbot/skill-profile.module.ts
import type { SkillProfile } from "./types";

/**
 * A hand-set prior (08-DartBot.md §D-E). Throws correct darts today; it
 * cannot yet claim to play like anything measured. Re-fitting from the D-E
 * production-data extract is a data edit to this table, not a redesign.
 */
export const LEVEL_SKILL_TABLE: Readonly<Record<number, SkillProfile>> = {
  1: { sigmaAlongMm: 32, sigmaAcrossMm: 40, covarianceRotationDegrees: 0, biasXMm: 6, biasYMm: 8, outlierRate: 0.12, outlierSigmaMm: 90, bedOffsetMm: 3.0, bounceOutRate: 0.05, deflectionRadiusMm: 12 },
  2: { sigmaAlongMm: 29, sigmaAcrossMm: 36, covarianceRotationDegrees: 0, biasXMm: 5, biasYMm: 7, outlierRate: 0.10, outlierSigmaMm: 85, bedOffsetMm: 2.7, bounceOutRate: 0.045, deflectionRadiusMm: 12 },
  3: { sigmaAlongMm: 26, sigmaAcrossMm: 32, covarianceRotationDegrees: 0, biasXMm: 5, biasYMm: 6, outlierRate: 0.09, outlierSigmaMm: 80, bedOffsetMm: 2.4, bounceOutRate: 0.040, deflectionRadiusMm: 11 },
  4: { sigmaAlongMm: 23, sigmaAcrossMm: 29, covarianceRotationDegrees: 0, biasXMm: 4, biasYMm: 6, outlierRate: 0.08, outlierSigmaMm: 75, bedOffsetMm: 2.1, bounceOutRate: 0.035, deflectionRadiusMm: 11 },
  5: { sigmaAlongMm: 21, sigmaAcrossMm: 26, covarianceRotationDegrees: 0, biasXMm: 4, biasYMm: 5, outlierRate: 0.07, outlierSigmaMm: 70, bedOffsetMm: 1.8, bounceOutRate: 0.030, deflectionRadiusMm: 10 },
  6: { sigmaAlongMm: 19, sigmaAcrossMm: 23, covarianceRotationDegrees: 0, biasXMm: 3, biasYMm: 5, outlierRate: 0.06, outlierSigmaMm: 65, bedOffsetMm: 1.6, bounceOutRate: 0.028, deflectionRadiusMm: 10 },
  7: { sigmaAlongMm: 17, sigmaAcrossMm: 21, covarianceRotationDegrees: 0, biasXMm: 3, biasYMm: 4, outlierRate: 0.055, outlierSigmaMm: 60, bedOffsetMm: 1.4, bounceOutRate: 0.025, deflectionRadiusMm: 9 },
  8: { sigmaAlongMm: 15, sigmaAcrossMm: 19, covarianceRotationDegrees: 0, biasXMm: 3, biasYMm: 4, outlierRate: 0.05, outlierSigmaMm: 55, bedOffsetMm: 1.2, bounceOutRate: 0.022, deflectionRadiusMm: 9 },
  9: { sigmaAlongMm: 13, sigmaAcrossMm: 17, covarianceRotationDegrees: 0, biasXMm: 2, biasYMm: 3, outlierRate: 0.045, outlierSigmaMm: 50, bedOffsetMm: 1.0, bounceOutRate: 0.020, deflectionRadiusMm: 8 },
  10: { sigmaAlongMm: 12, sigmaAcrossMm: 15, covarianceRotationDegrees: 0, biasXMm: 2, biasYMm: 3, outlierRate: 0.040, outlierSigmaMm: 48, bedOffsetMm: 0.9, bounceOutRate: 0.018, deflectionRadiusMm: 8 },
  11: { sigmaAlongMm: 10, sigmaAcrossMm: 13, covarianceRotationDegrees: 0, biasXMm: 2, biasYMm: 2, outlierRate: 0.035, outlierSigmaMm: 45, bedOffsetMm: 0.7, bounceOutRate: 0.015, deflectionRadiusMm: 7 },
  12: { sigmaAlongMm: 9, sigmaAcrossMm: 11, covarianceRotationDegrees: 0, biasXMm: 1, biasYMm: 2, outlierRate: 0.030, outlierSigmaMm: 42, bedOffsetMm: 0.6, bounceOutRate: 0.013, deflectionRadiusMm: 7 },
  13: { sigmaAlongMm: 8, sigmaAcrossMm: 10, covarianceRotationDegrees: 0, biasXMm: 1, biasYMm: 2, outlierRate: 0.025, outlierSigmaMm: 40, bedOffsetMm: 0.5, bounceOutRate: 0.011, deflectionRadiusMm: 6 },
  14: { sigmaAlongMm: 7, sigmaAcrossMm: 8, covarianceRotationDegrees: 0, biasXMm: 1, biasYMm: 1, outlierRate: 0.020, outlierSigmaMm: 38, bedOffsetMm: 0.4, bounceOutRate: 0.009, deflectionRadiusMm: 6 },
  15: { sigmaAlongMm: 6, sigmaAcrossMm: 7, covarianceRotationDegrees: 0, biasXMm: 0, biasYMm: 1, outlierRate: 0.015, outlierSigmaMm: 35, bedOffsetMm: 0.3, bounceOutRate: 0.007, deflectionRadiusMm: 5 },
};

export function skillProfileForLevel(level: number): SkillProfile {
  const clamped = Math.min(15, Math.max(1, Math.round(level)));
  const profile = LEVEL_SKILL_TABLE[clamped];
  if (!profile) {
    throw new Error(`No skill profile for level ${clamped}`);
  }
  return profile;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/dartbot/skill-profile.module.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/dartbot/types.ts app/src/modules/dartbot/skill-profile.module.ts app/tests/modules/dartbot/skill-profile.module.test.ts
git commit -m "feat: add DartBot hand-set level curve"
```

---

### Task 4: Aim resolver

Resolves a declared `{ targetNumber, zoneKey }` intent to an aim point in millimetres, reusing the shared `zoneCentroid()` — the only place "where in the bed" is decided (`08-DartBot.md` §The Throw Pipeline).

**Files:**
- Modify: `app/src/modules/dartbot/types.ts`
- Create: `app/src/modules/dartbot/aim-resolver.module.ts`
- Test: `app/tests/modules/dartbot/aim-resolver.module.test.ts`

**Interfaces:**
- Consumes: `SkillProfile` (Task 3)
- Produces: `ThrowIntent` type, `resolveAimPoint(intent: ThrowIntent, profile: SkillProfile): BoardPoint`

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/modules/dartbot/aim-resolver.module.test.ts
import { describe, expect, it } from "vitest";
import { zoneCentroid } from "@lib/game/board/board-geometry.module";
import { resolveAimPoint } from "@modules/dartbot/aim-resolver.module";
import type { SkillProfile } from "@modules/dartbot/types";

const ZERO_OFFSET_PROFILE: SkillProfile = {
  sigmaAlongMm: 10,
  sigmaAcrossMm: 10,
  covarianceRotationDegrees: 0,
  biasXMm: 0,
  biasYMm: 0,
  outlierRate: 0,
  outlierSigmaMm: 0,
  bedOffsetMm: 0,
  bounceOutRate: 0,
  deflectionRadiusMm: 0,
};

describe("resolveAimPoint", () => {
  it("aims at the shared geometry's centroid when bedOffset is zero", () => {
    const centroid = zoneCentroid(20, "TREBLE");
    const aim = resolveAimPoint(
      { targetNumber: 20, zoneKey: "TREBLE" },
      ZERO_OFFSET_PROFILE,
    );
    expect(aim).toEqual(centroid);
  });

  it("pushes the aim point radially outward by bedOffsetMm", () => {
    const centroid = zoneCentroid(20, "DOUBLE")!;
    const profile: SkillProfile = { ...ZERO_OFFSET_PROFILE, bedOffsetMm: 5 };
    const aim = resolveAimPoint({ targetNumber: 20, zoneKey: "DOUBLE" }, profile);
    const centroidRadius = Math.hypot(centroid.x, centroid.y);
    const aimRadius = Math.hypot(aim.x, aim.y);
    expect(aimRadius).toBeCloseTo(centroidRadius + 5, 6);
  });

  it("falls back to the bull when the intent has no centroid", () => {
    const aim = resolveAimPoint(
      { targetNumber: null, zoneKey: "MISS" },
      ZERO_OFFSET_PROFILE,
    );
    expect(aim).toEqual({ x: 0, y: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/dartbot/aim-resolver.module.test.ts`
Expected: FAIL — `Cannot find module '@modules/dartbot/aim-resolver.module'`

- [ ] **Step 3: Add `ThrowIntent` to types.ts**

```typescript
// app/src/modules/dartbot/types.ts — add above SkillProfile
import type { DartZoneKey } from "@modules/types";

export type ThrowIntent = {
  targetNumber: number | null;
  zoneKey: DartZoneKey;
};
```

- [ ] **Step 4: Write the implementation**

```typescript
// app/src/modules/dartbot/aim-resolver.module.ts
import { zoneCentroid } from "@lib/game/board/board-geometry.module";
import type { BoardPoint } from "@lib/game/board/types";
import type { SkillProfile, ThrowIntent } from "./types";

export function resolveAimPoint(
  intent: ThrowIntent,
  profile: SkillProfile,
): BoardPoint {
  const centroid = zoneCentroid(intent.targetNumber, intent.zoneKey);
  if (centroid === null) {
    return { x: 0, y: 0 };
  }
  const radius = Math.hypot(centroid.x, centroid.y);
  if (radius === 0) {
    return centroid;
  }
  const scale = (radius + profile.bedOffsetMm) / radius;
  return { x: centroid.x * scale, y: centroid.y * scale };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/dartbot/aim-resolver.module.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/dartbot/types.ts app/src/modules/dartbot/aim-resolver.module.ts app/tests/modules/dartbot/aim-resolver.module.test.ts
git commit -m "feat: add DartBot aim resolver"
```

---

### Task 5: Throw engine — scatter, bounce, classify

The orchestration stage: aim, anisotropic Gaussian scatter with a heavy-tail outlier draw, wire bounce-out, then classification through the shared geometry (`08-DartBot.md` §The Throw Pipeline, §The scatter model).

**Files:**
- Modify: `app/src/modules/dartbot/types.ts`
- Create: `app/src/modules/dartbot/throw-engine.module.ts`
- Test: `app/tests/modules/dartbot/throw-engine.module.test.ts`

**Interfaces:**
- Consumes: `DartRng` (Task 2), `ThrowIntent`/`SkillProfile` (Tasks 3–4), `resolveAimPoint` (Task 4)
- Produces: `BotThrow` type, `throwDart(intent: ThrowIntent, profile: SkillProfile, rng: DartRng): BotThrow`

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/modules/dartbot/throw-engine.module.test.ts
import { describe, expect, it, vi } from "vitest";
import { classify } from "@lib/game/board/board-geometry.module";
import { throwDart } from "@modules/dartbot/throw-engine.module";
import type { DartRng } from "@modules/dartbot/interfaces";
import type { SkillProfile, ThrowIntent } from "@modules/dartbot/types";

function stubRng(uniforms: number[], gaussianPairs: [number, number][]): DartRng {
  let uIndex = 0;
  let gIndex = 0;
  return {
    uniform: () => uniforms[uIndex++]!,
    gaussianPair: () => gaussianPairs[gIndex++]!,
  };
}

const BASE_PROFILE: SkillProfile = {
  sigmaAlongMm: 5,
  sigmaAcrossMm: 5,
  covarianceRotationDegrees: 0,
  biasXMm: 0,
  biasYMm: 0,
  outlierRate: 0.1,
  outlierSigmaMm: 100,
  bedOffsetMm: 0,
  bounceOutRate: 0.1,
  deflectionRadiusMm: 20,
};

const T20_TREBLE: ThrowIntent = { targetNumber: 20, zoneKey: "TREBLE" };

describe("throwDart", () => {
  it("uses the wide outlier sigma when the outlier draw succeeds", () => {
    const rng = stubRng([0.01, 0.9], [[3, 0]]);
    const thrown = throwDart(T20_TREBLE, BASE_PROFILE, rng);
    const distanceFromAim = Math.hypot(
      thrown.landing.x - thrown.aim.x,
      thrown.landing.y - thrown.aim.y,
    );
    expect(distanceFromAim).toBeCloseTo(300, 6);
  });

  it("uses the normal sigma when the outlier draw fails", () => {
    const rng = stubRng([0.99, 0.9], [[3, 0]]);
    const thrown = throwDart(T20_TREBLE, BASE_PROFILE, rng);
    const distanceFromAim = Math.hypot(
      thrown.landing.x - thrown.aim.x,
      thrown.landing.y - thrown.aim.y,
    );
    expect(distanceFromAim).toBeCloseTo(15, 6);
  });

  it("bounces the landing point outward when the bounce draw succeeds", () => {
    const rng = stubRng([0.99, 0.01], [[0, 0]]);
    const thrown = throwDart(T20_TREBLE, BASE_PROFILE, rng);
    expect(thrown.bounced).toBe(true);
    const radiusBeforeBounce = Math.hypot(thrown.aim.x, thrown.aim.y);
    const radiusAfterBounce = Math.hypot(thrown.landing.x, thrown.landing.y);
    expect(radiusAfterBounce).toBeCloseTo(radiusBeforeBounce + 20, 6);
  });

  it("does not bounce when the bounce draw fails", () => {
    const rng = stubRng([0.99, 0.99], [[0, 0]]);
    const thrown = throwDart(T20_TREBLE, BASE_PROFILE, rng);
    expect(thrown.bounced).toBe(false);
  });

  it("classifies the landing point through the shared geometry module", () => {
    const rng = stubRng([0.99, 0.99], [[0, 0]]);
    const thrown = throwDart(T20_TREBLE, BASE_PROFILE, rng);
    expect(thrown.hit).toEqual(classify(thrown.landing.x, thrown.landing.y));
  });

  it("never calls Math.random", () => {
    const spy = vi.spyOn(Math, "random");
    const rng = stubRng([0.99, 0.99], [[0, 0]]);
    throwDart(T20_TREBLE, BASE_PROFILE, rng);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/dartbot/throw-engine.module.test.ts`
Expected: FAIL — `Cannot find module '@modules/dartbot/throw-engine.module'`

- [ ] **Step 3: Add `BotThrow` to types.ts**

```typescript
// app/src/modules/dartbot/types.ts — add below the other types
import type { BoardHit, BoardPoint } from "@lib/game/board/types";

export type BotThrow = {
  aim: BoardPoint;
  landing: BoardPoint;
  hit: BoardHit;
  bounced: boolean;
};
```

- [ ] **Step 4: Write the implementation**

```typescript
// app/src/modules/dartbot/throw-engine.module.ts
import { classify } from "@lib/game/board/board-geometry.module";
import type { BoardPoint } from "@lib/game/board/types";
import { resolveAimPoint } from "./aim-resolver.module";
import type { DartRng } from "./interfaces";
import type { BotThrow, SkillProfile, ThrowIntent } from "./types";

function rotate(point: BoardPoint, degrees: number): BoardPoint {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

function scatterOffset(profile: SkillProfile, rng: DartRng): BoardPoint {
  const isOutlier = rng.uniform() < profile.outlierRate;
  const [zAlong, zAcross] = rng.gaussianPair();
  const sigmaAlong = isOutlier ? profile.outlierSigmaMm : profile.sigmaAlongMm;
  const sigmaAcross = isOutlier ? profile.outlierSigmaMm : profile.sigmaAcrossMm;
  const local = { x: zAcross * sigmaAcross, y: zAlong * sigmaAlong };
  return rotate(local, profile.covarianceRotationDegrees);
}

function applyBounce(
  landing: BoardPoint,
  profile: SkillProfile,
  rng: DartRng,
): { landing: BoardPoint; bounced: boolean } {
  if (rng.uniform() >= profile.bounceOutRate) {
    return { landing, bounced: false };
  }
  const radius = Math.hypot(landing.x, landing.y);
  if (radius === 0) {
    return { landing: { x: profile.deflectionRadiusMm, y: 0 }, bounced: true };
  }
  const scale = (radius + profile.deflectionRadiusMm) / radius;
  return { landing: { x: landing.x * scale, y: landing.y * scale }, bounced: true };
}

export function throwDart(
  intent: ThrowIntent,
  profile: SkillProfile,
  rng: DartRng,
): BotThrow {
  const aim = resolveAimPoint(intent, profile);
  const offset = scatterOffset(profile, rng);
  const preBounce = {
    x: aim.x + profile.biasXMm + offset.x,
    y: aim.y + profile.biasYMm + offset.y,
  };
  const { landing, bounced } = applyBounce(preBounce, profile, rng);
  const hit = classify(landing.x, landing.y);
  return { aim, landing, hit, bounced };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/dartbot/throw-engine.module.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/dartbot/types.ts app/src/modules/dartbot/throw-engine.module.ts app/tests/modules/dartbot/throw-engine.module.test.ts
git commit -m "feat: add DartBot throw engine"
```

---

### Task 6: Deterministic snapshot test — the phase gate

Proves the phase 1 gate directly: "the same `(seed, level, context)` produces a byte-identical dart stream; snapshot-tested" (`08-DartBot.md` §Test Strategy).

**Files:**
- Test: `app/tests/modules/dartbot/throw-engine.determinism.test.ts`
- Create (generated by Vitest): `app/tests/modules/dartbot/__snapshots__/throw-engine.determinism.test.ts.snap`

**Interfaces:**
- Consumes: `createDartRng` (Task 2), `skillProfileForLevel` (Task 3), `throwDart` (Task 5)

- [ ] **Step 1: Write the test**

```typescript
// app/tests/modules/dartbot/throw-engine.determinism.test.ts
import { describe, expect, it } from "vitest";
import { createDartRng } from "@modules/dartbot/rng.module";
import { skillProfileForLevel } from "@modules/dartbot/skill-profile.module";
import { throwDart } from "@modules/dartbot/throw-engine.module";
import type { ThrowIntent } from "@modules/dartbot/types";

const T20_TREBLE: ThrowIntent = { targetNumber: 20, zoneKey: "TREBLE" };

function throwFiveDarts(seed: number, level: number) {
  const profile = skillProfileForLevel(level);
  return Array.from({ length: 5 }, (_, dartIndex) =>
    throwDart(T20_TREBLE, profile, createDartRng(seed, dartIndex)),
  );
}

describe("throwDart determinism", () => {
  it("produces a byte-identical dart stream for the same (seed, level, context)", () => {
    expect(throwFiveDarts(42, 8)).toEqual(throwFiveDarts(42, 8));
  });

  it("matches the committed snapshot for seed 42 at level 8", () => {
    expect(throwFiveDarts(42, 8)).toMatchSnapshot();
  });

  it("produces a different stream for a different seed", () => {
    expect(throwFiveDarts(42, 8)).not.toEqual(throwFiveDarts(43, 8));
  });

  it("produces a different stream for a different level", () => {
    expect(throwFiveDarts(42, 8)).not.toEqual(throwFiveDarts(42, 4));
  });
});
```

- [ ] **Step 2: Run the test to generate and commit the snapshot**

Run: `cd app && npx vitest run tests/modules/dartbot/throw-engine.determinism.test.ts`
Expected: PASS (4 tests), and `app/tests/modules/dartbot/__snapshots__/throw-engine.determinism.test.ts.snap` is created on disk.

- [ ] **Step 3: Run it again to confirm the snapshot is stable**

Run: `cd app && npx vitest run tests/modules/dartbot/throw-engine.determinism.test.ts`
Expected: PASS (4 tests) — the second run reads the committed snapshot rather than regenerating it, proving the stream really is byte-identical across process runs, not just within one.

- [ ] **Step 4: Commit**

```bash
git add app/tests/modules/dartbot/throw-engine.determinism.test.ts app/tests/modules/dartbot/__snapshots__/throw-engine.determinism.test.ts.snap
git commit -m "test: add DartBot deterministic snapshot test (phase 1 gate)"
```

---

### Task 7: Context maintenance and full validation

Repo-mandatory close-out (root `CLAUDE.md` §Context Maintenance) — not optional, regardless of this plan.

- [ ] **Step 1: Run the full app validation chain**

```bash
cd app && npm run format
cd app && npm run validate:app
```

Expected: `npm run format` reports no diffs (or the diffs it makes are committed in Step 3 below); `validate:app` exits zero with 0 errors, 0 warnings, 0 hints.

- [ ] **Step 2: Run the `context-maintenance` skill**

Invoke the `context-maintenance` skill per root `CLAUDE.md`. It updates the context map / File Inventory / decision ledger if this phase's changes require it beyond Task 1's edits (new file registration, budget drift) and confirms `scripts/check-context-map.sh`, `scripts/check-doc-links.sh`, `scripts/check-context-budget.sh` all pass.

- [ ] **Step 3: Commit any formatting or context-maintenance fixes**

```bash
git add -A
git status
```

Review the diff before committing — commit only if `git status` shows changes from Steps 1–2.

```bash
git commit -m "chore: context maintenance for DartBot phase 1"
```

- [ ] **Step 4: Push**

```bash
git push -u origin dartbot-1-throw-engine
```

---

## Self-Review

**Spec coverage:** every row of the phase-1 inheritance table in `docs/superpowers/specs/2026-09-01-dartbot-v1-delivery-design.md` is covered — Module Boundary (Task 1, File Structure), Throw Pipeline + scatter model (Tasks 4–5), Skill Model (Task 3), Determinism and Replay (Tasks 2, 6), the four named Anti-Patterns rows (Math.random ban tested in Tasks 2 and 5; geometry duplication guarded by Task 4/5 reusing `zoneCentroid`/`classify` and asserted in tests; score-steering is a design absence — no task reads `hit.score` for a decision; timers — no task imports a clock), and all three named Test Strategy rows (geometry reuse — Task 4; determinism — Task 6; injected rng — Task 5). The phase 1 gate itself ("Deterministic snapshot tests green") is Task 6.

**Placeholder scan:** no TBD/TODO; every step has real code or a real command with expected output.

**Type consistency:** `ThrowIntent`, `SkillProfile`, `BotThrow` are each defined once (Tasks 3–5) and referenced by the same names and shapes in every later task; `DartRng` is defined once (Task 2) and consumed unchanged by Task 5's stub and Task 6's real implementation.

**Scope:** no strategy, no `DartBot` class, no pressure/form/pacing, no persistence, no game engine wiring — all correctly deferred to phases 2–7 per the delivery design. `SkillProfile` carries only the axes phase 1 consumes (execution, aim, collision); `decision`/`pressure`/`form`/`correlation` are added to the same type by later phases rather than stubbed here now.

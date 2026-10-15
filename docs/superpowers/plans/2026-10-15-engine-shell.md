# Engine Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the duplicated class shell of dart-input engines with two generic shell factories, proven behaviour-identical by a differential oracle on Doubles Training, Bob's 27 and Target Scoring.

**Architecture:** L2 of the rule-kernels design. A *shell spec* hands the shell an engine's existing pure functions (`fold`, `refusal`, `intent`, `isVisitOpen`, `wouldComplete`); the shell owns the fact log, keys, `completedAt`, undo and rehydration. The old class is kept as a test-only oracle until the new engine matches it step for step, then replaced by golden snapshots. No rules, facts, `state()` shapes, ruleset keys or registries change.

**Tech Stack:** TypeScript, Vitest 4, existing `turn-log` / `seeded-rng` modules. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-15-rule-kernels-design.md` (§3, §6).

**Execute after the Neon reset only.** Every task touches `app/`; merging runs `deploy`. No task touches `database/`.

## Global Constraints

- `rulesetVersionKey` / `exerciseRulesetVersionKey`, `EngineFacts` shape and `state()` shape of every migrated engine stay byte-identical.
- Exported names stay importable with the same meaning: `DoublesTrainingEngine`, `doublesTrainingEngineFactory`, `foldDoublesTrainingState`, `applyDoublesTrainingDart`, `initialDoublesTrainingState`, `Bobs27Engine`, `bobs27EngineFactory`, `foldBobs27State`, `applyBobs27Dart`, `TargetScoringEngine`, `targetScoringEngineFactory`, `foldTargetScoringState`, `targetScoringPoints`, `targetScoringTargetLabel`. Each `*Engine` stays usable both as `new X(config, prior?)` and as a type.
- Engine files keep `export const <name>EngineFactory`, a `registerEngineFactory(` / `registerDartExerciseEngineFactory(` call, and a literal `rulesetVersionKey: "<KEY>"` — `scripts/check-game-engines.sh` greps for all three.
- No `//` or `/* */` comments inside function bodies in `app/src/**` (app/CLAUDE.md). JSDoc above declarations only; cite decisions as `(D-n)`, never narrate them.
- Tests live under `app/tests/` mirroring `app/src/`; every changed `app/src` `.ts` file needs a changed test importing it (`check-test-coverage.sh`).
- One engine per commit series; land the full change for an engine in one commit so pre-commit gates never see a half-migrated engine.
- Run all commands from `app/` unless stated.

## Review Focus

1. **Rehydration mid-visit** — `create(config, prior)` with a prior whose last turn is open must accept the next dart into that same turn. Pinned in Task 1's oracle (`rehydrateEvery`) and Task 2's shell test.
2. **Undo across a seat boundary** in a 2-seat game — undo of the first dart of seat B's visit must make seat A active again with its visit reopened (`completedAt` null). Pinned by the oracle's 2-seat runs (Tasks 3, 4).
3. **Record after completion** — must throw *and* leave `facts()` unchanged; the message text must equal the old engine's (existing tests assert it). Pinned in Task 2 and by the oracle's `throws` comparison.
4. **Returned objects are detached** — mutating the result of `state()` or `facts()` must not affect the engine. Pinned in Task 2.
5. **Expired exercise then undo** — Target Scoring's `undo()` after `expireTimer()` un-expires without popping a dart. Pinned in Task 5.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `app/tests/modules/game/support/engine-oracle.ts` (create) | Seeded dart generator, fact/state normaliser, differential runner |
| `app/tests/modules/game/support/engine-oracle.test.ts` (create) | Proves the oracle detects divergence |
| `app/src/modules/game/dart-engine-shell.module.ts` (create) | `DartGameSpec`, `dartGameEngineClass`, `dartGameEngineFactory` |
| `app/tests/modules/game/dart-engine-shell.module.test.ts` (create) | Shell contract tests on a toy spec |
| `app/src/modules/game/doubles-training.engine.module.ts` (modify) | Class → spec + shell |
| `app/src/modules/game/bobs27.engine.module.ts` (modify) | Class → spec + shell |
| `app/src/modules/training/exercises/dart-exercise-shell.module.ts` (create) | `DartExerciseSpec`, `dartExerciseEngineClass`, `dartExerciseEngineFactory` |
| `app/tests/modules/training/exercises/dart-exercise-shell.module.test.ts` (create) | Exercise shell contract tests |
| `app/src/modules/training/exercises/target-scoring.engine.module.ts` (modify) | Class → spec + shell |
| `app/tests/modules/game/*.golden.test.ts`, `app/tests/modules/training/exercises/target-scoring.golden.test.ts` (create) | Golden snapshots replacing the oracle |
| `docs/architecture/04-Architecture-patterns.md`, `app/src/modules/game/CLAUDE.md`, `app/src/modules/training/CLAUDE.md`, `docs/architecture/07-Frontend/09-Adding-A-Game.md`, `decisions/game-engine.md` (modify) | Canonical docs |

---

### Task 1: Differential oracle harness

**Files:**
- Create: `app/tests/modules/game/support/engine-oracle.ts`
- Test: `app/tests/modules/game/support/engine-oracle.test.ts`

**Interfaces:**
- Produces:
  - `randomObservation(rand: () => number): DartObservation`
  - `normalise<T>(value: T): T` — replaces every `clientKey` / `stageClientKey` string with `k1`, `k2`, … in first-seen order, and every non-null `completedAt` with `"<t>"`.
  - `type OracleEngine = { record(o: DartObservation): unknown; undo(): boolean; state(): unknown; facts(): EngineFacts; isComplete(): boolean; wouldComplete?(o: DartObservation): boolean; expireTimer?(): void }`
  - `runOracle(opts: OracleOptions): void` where `OracleOptions = { build: (prior?: EngineFacts) => OracleEngine; legacy: (prior?: EngineFacts) => OracleEngine; seeds: readonly number[]; steps: number; undoRate?: number; expireAt?: number; rehydrateEvery?: number }` — throws an `Error` naming seed, step and the diverging field on the first mismatch.
  - Split into `compare` / `throwDart` / `act` / `rehydrate` helpers so `runOracle` stays under fallow's cognitive-complexity threshold of 15 (a single-function version measured 17 in a spike).

- [ ] **Step 1: Write the failing test**

```ts
// app/tests/modules/game/support/engine-oracle.test.ts
import { describe, it, expect } from "vitest";
import {
  normalise,
  randomObservation,
  runOracle,
  type OracleEngine,
} from "./engine-oracle";
import { seededUniform } from "@modules/game/seeded-rng.module";
import type { DartObservation, EngineFacts } from "@modules/types";

function counter(bias = 0): (prior?: EngineFacts) => OracleEngine {
  return (prior) => {
    const darts: DartObservation[] = prior
      ? prior.turns.flatMap((t) =>
          t.darts.map((d) => ({
            hitTargetNumber: d.hitTargetNumber,
            hitZoneKey: d.hitZoneKey,
            locationX: d.locationX,
            locationY: d.locationY,
          })),
        )
      : [];
    const facts = (): EngineFacts => ({
      stages: [],
      turns: darts.map((d, i) => ({
        clientKey: `random-${Math.random()}`,
        stageClientKey: "block-1",
        participantRef: "p",
        sequence: i + 1,
        completedAt: new Date().toISOString(),
        totalScore: 0,
        darts: [
          {
            sequence: 1,
            intendedTargetNumber: null,
            intendedZoneKey: null,
            hitTargetNumber: d.hitTargetNumber,
            hitZoneKey: d.hitZoneKey,
            score: 0,
            locationX: d.locationX,
            locationY: d.locationY,
          },
        ],
      })),
    });
    return {
      record: (o) => {
        darts.push(o);
        return { n: darts.length + (darts.length > 5 ? bias : 0) };
      },
      undo: () => darts.pop() !== undefined,
      state: () => ({ n: darts.length + (darts.length > 5 ? bias : 0) }),
      facts,
      isComplete: () => false,
    };
  };
}

describe("randomObservation", () => {
  it("is deterministic per seed and always a legal board hit", () => {
    const a = seededUniform(7, 0);
    const b = seededUniform(7, 0);
    for (let i = 0; i < 200; i += 1) {
      const o = randomObservation(a);
      expect(o).toEqual(randomObservation(b));
      if (o.hitZoneKey === "MISS") expect(o.hitTargetNumber).toBeNull();
      else if (o.hitZoneKey === "OUTER_BULL" || o.hitZoneKey === "INNER_BULL")
        expect(o.hitTargetNumber).toBe(25);
      else expect(o.hitTargetNumber).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("normalise", () => {
  it("renames client keys by first appearance and masks timestamps", () => {
    expect(
      normalise({
        turns: [
          { clientKey: "x", stageClientKey: "s", completedAt: "2026-01-01" },
          { clientKey: "y", stageClientKey: "s", completedAt: null },
        ],
      }),
    ).toEqual({
      turns: [
        { clientKey: "k2", stageClientKey: "k1", completedAt: "<t>" },
        { clientKey: "k3", stageClientKey: "k1", completedAt: null },
      ],
    });
  });
});

describe("runOracle", () => {
  it("passes when both sides behave the same", () => {
    expect(() =>
      runOracle({
        build: counter(),
        legacy: counter(),
        seeds: [1, 2, 3],
        steps: 40,
        undoRate: 0.2,
        rehydrateEvery: 7,
      }),
    ).not.toThrow();
  });

  it("names the seed and step of the first divergence", () => {
    expect(() =>
      runOracle({
        build: counter(1),
        legacy: counter(),
        seeds: [1],
        steps: 40,
      }),
    ).toThrow(/seed 1 step \d+: (record|state) diverged/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/modules/game/support/engine-oracle.test.ts`
Expected: FAIL — `Cannot find module './engine-oracle'`.

- [ ] **Step 3: Write the implementation**

```ts
// app/tests/modules/game/support/engine-oracle.ts
import { expect } from "vitest";
import { seededUniform } from "@modules/game/seeded-rng.module";
import type { DartObservation, DartZoneKey, EngineFacts } from "@modules/types";

export type OracleEngine = {
  record(o: DartObservation): unknown;
  undo(): boolean;
  state(): unknown;
  facts(): EngineFacts;
  isComplete(): boolean;
  wouldComplete?(o: DartObservation): boolean;
  expireTimer?(): void;
};

const NUMBER_ZONES: readonly DartZoneKey[] = [
  "INNER_SINGLE",
  "OUTER_SINGLE",
  "DOUBLE",
  "TREBLE",
];

/** A legal board hit: 10% miss, 10% bull, otherwise a ring on 1–20. */
export function randomObservation(rand: () => number): DartObservation {
  const roll = rand();
  const base = { locationX: null, locationY: null };
  if (roll < 0.1) return { ...base, hitTargetNumber: null, hitZoneKey: "MISS" };
  if (roll < 0.2)
    return {
      ...base,
      hitTargetNumber: 25,
      hitZoneKey: rand() < 0.5 ? "OUTER_BULL" : "INNER_BULL",
    };
  return {
    ...base,
    hitTargetNumber: 1 + Math.floor(rand() * 20),
    hitZoneKey: NUMBER_ZONES[Math.floor(rand() * NUMBER_ZONES.length)],
  };
}

/** Masks the two values that legitimately differ between runs. */
export function normalise<T>(value: T): T {
  const keys = new Map<string, string>();
  const rename = (key: string) => {
    if (!keys.has(key)) keys.set(key, `k${keys.size + 1}`);
    return keys.get(key);
  };
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (node === null || typeof node !== "object") return node;
    const obj = node as Record<string, unknown>;
    if (typeof obj.stageClientKey === "string") rename(obj.stageClientKey);
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => {
        if ((k === "clientKey" || k === "stageClientKey") && typeof v === "string")
          return [k, rename(v)];
        if (k === "completedAt" && typeof v === "string") return [k, "<t>"];
        return [k, walk(v)];
      }),
    );
  };
  return walk(value) as T;
}

function attempt<T>(fn: () => T): { ok: true; value: T } | { ok: false; message: string } {
  try {
    return { ok: true, value: fn() };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

function same(label: string, actual: unknown, expected: unknown, where: string) {
  try {
    expect(normalise(actual)).toEqual(normalise(expected));
  } catch {
    throw new Error(`${where}: ${label} diverged\n${JSON.stringify(normalise(actual))}\n!==\n${JSON.stringify(normalise(expected))}`);
  }
}

type OracleOptions = {
  build: (prior?: EngineFacts) => OracleEngine;
  legacy: (prior?: EngineFacts) => OracleEngine;
  seeds: readonly number[];
  steps: number;
  undoRate?: number;
  expireAt?: number;
  rehydrateEvery?: number;
};

type Pair = { next: OracleEngine; old: OracleEngine };

function compare(pair: Pair, where: string): void {
  same("state", pair.next.state(), pair.old.state(), where);
  same("facts", pair.next.facts(), pair.old.facts(), where);
  same("isComplete", pair.next.isComplete(), pair.old.isComplete(), where);
}

function throwDart(pair: Pair, o: DartObservation, where: string): void {
  same(
    "wouldComplete",
    attempt(() => pair.next.wouldComplete?.(o)),
    attempt(() => pair.old.wouldComplete?.(o)),
    where,
  );
  same("record", attempt(() => pair.next.record(o)), attempt(() => pair.old.record(o)), where);
}

function act(pair: Pair, step: number, rand: () => number, opts: OracleOptions, where: string): void {
  if (opts.expireAt === step) {
    pair.next.expireTimer?.();
    pair.old.expireTimer?.();
    return;
  }
  if (rand() < (opts.undoRate ?? 0)) {
    same("undo", pair.next.undo(), pair.old.undo(), where);
    return;
  }
  throwDart(pair, randomObservation(rand), where);
}

function rehydrate(pair: Pair, opts: OracleOptions, where: string): Pair {
  const next = opts.build(pair.next.facts());
  const old = opts.legacy(pair.old.facts());
  same("rehydrated state", next.state(), old.state(), where);
  return { next, old };
}

/**
 * Drives `build` and `legacy` with the same seeded inputs and asserts they
 * stay indistinguishable through every public method, including thrown
 * error messages and rehydration from their own facts.
 */
export function runOracle(opts: OracleOptions): void {
  for (const seed of opts.seeds) {
    const rand = seededUniform(seed, 0);
    let pair: Pair = { next: opts.build(), old: opts.legacy() };
    for (let step = 0; step < opts.steps; step += 1) {
      const where = `seed ${seed} step ${step}`;
      act(pair, step, rand, opts, where);
      compare(pair, where);
      const every = opts.rehydrateEvery ?? 0;
      if (every > 0 && step % every === every - 1) pair = rehydrate(pair, opts, where);
    }
  }
}
```

Note: `normalise` numbers an object's `stageClientKey` before its `clientKey`, so a turn's stage key is numbered first whatever the property order — matching the test's expected `k1` / `k2`, and matching `facts().stages[0].clientKey` when stages precede turns.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/modules/game/support/engine-oracle.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add tests/modules/game/support/
git commit -m "test(engine): differential oracle harness"
```

---

### Task 2: Game engine shell

**Files:**
- Create: `app/src/modules/game/dart-engine-shell.module.ts`
- Test: `app/tests/modules/game/dart-engine-shell.module.test.ts`

**Interfaces:**
- Consumes: `appendObservedDart`, `cloneTurns`, `exerciseBlockStage`, `openOrCreateTurn`, `undoLastDart` (`turn-log.module.ts`); `GameEngine`, `GameEngineFactory` (`interfaces.ts`).
- Produces:

```ts
export interface DartGameSpec<TConfig, TState extends ShellState> {
  readonly rulesetVersionKey: RulesetVersionKey;
  readonly stageOwnership: StageOwnership;
  fold(facts: EngineFacts, config: TConfig): TState;
  refusal(state: TState): string | null;
  intent(state: TState, config: TConfig): DartIntent;
  isVisitOpen(turn: TurnFact): boolean;
  wouldComplete(state: TState, observation: DartObservation, config: TConfig): boolean;
}
export type ShellState = { activeParticipantRef: string; status: string };
export type ShellGameEngine<TConfig, TState extends ShellState> =
  GameEngine<DartObservation, TState> & { readonly spec: DartGameSpec<TConfig, TState> };
export type DartGameEngineClass<TConfig, TState extends ShellState> =
  new (config: TConfig, prior?: EngineFacts) => ShellGameEngine<TConfig, TState>;
export function dartGameEngineClass<TConfig, TState extends ShellState>(
  spec: DartGameSpec<TConfig, TState>,
): DartGameEngineClass<TConfig, TState>;
export function dartGameEngineFactory<TConfig, TState extends ShellState>(
  spec: DartGameSpec<TConfig, TState>,
  Engine: DartGameEngineClass<TConfig, TState>,
): GameEngineFactory<TConfig, DartObservation, TState>;
```

Scope: one `EXERCISE_BLOCK` stage, dart input only, `undoLastDart`. `isComplete()` is `state.status !== "IN_PROGRESS"`.

**Why the `spec` brand:** play controllers narrow with `engine instanceof DoublesTrainingEngine` (e.g. `lib/game/doubles-training-play.data.ts:93`). Without a member `GameEngine<unknown, unknown>` lacks, TypeScript will not narrow and `npm run check` fails with TS2322 — found in a spike. The readonly `spec` property is that member.

- [ ] **Step 1: Write the failing test**

```ts
// app/tests/modules/game/dart-engine-shell.module.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  dartGameEngineClass,
  dartGameEngineFactory,
  type DartGameSpec,
} from "@modules/game/dart-engine-shell.module";
import type { DartObservation, EngineFacts } from "@modules/types";

type Toy = { activeParticipantRef: string; status: string; darts: number };

const spec: DartGameSpec<{ limit: number }, Toy> = {
  rulesetVersionKey: "BOBS27_V1",
  stageOwnership: "PER_SEAT",
  fold: (facts, config) => {
    const darts = facts.turns.reduce((n, t) => n + t.darts.length, 0);
    return {
      activeParticipantRef: "p1",
      status: darts >= config.limit ? "COMPLETE" : "IN_PROGRESS",
      darts,
    };
  },
  refusal: (s) => (s.status === "IN_PROGRESS" ? null : "toy is over"),
  intent: () => ({ intendedTargetNumber: 20, intendedZoneKey: "TREBLE" }),
  isVisitOpen: (t) => t.darts.length < 3,
  wouldComplete: (s, _o, c) => s.darts + 1 >= c.limit,
};

const T20: DartObservation = {
  hitTargetNumber: 20,
  hitZoneKey: "TREBLE",
  locationX: null,
  locationY: null,
};

const Toy = dartGameEngineClass(spec);

afterEach(() => vi.useRealTimers());

describe("dartGameEngineClass", () => {
  it("records into one visit until it closes, stamping completedAt on the closing dart", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
    const engine = new Toy({ limit: 10 });
    engine.record(T20);
    engine.record(T20);
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.facts().turns[0].completedAt).toBeNull();
    engine.record(T20);
    expect(engine.facts().turns[0].completedAt).toBe("2026-11-01T10:00:00.000Z");
    engine.record(T20);
    expect(engine.facts().turns).toHaveLength(2);
    expect(engine.facts().turns[0].darts[0]).toMatchObject({
      intendedTargetNumber: 20,
      intendedZoneKey: "TREBLE",
      score: 60,
    });
  });

  it("refuses with the spec's message and leaves facts untouched", () => {
    const engine = new Toy({ limit: 1 });
    engine.record(T20);
    const before = engine.facts();
    expect(() => engine.record(T20)).toThrow("toy is over");
    expect(engine.facts()).toEqual(before);
    expect(engine.isComplete()).toBe(true);
  });

  it("undo reopens a closed visit and empties to false", () => {
    const engine = new Toy({ limit: 10 });
    [T20, T20, T20].forEach((o) => engine.record(o));
    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns[0].completedAt).toBeNull();
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(false);
    expect(engine.facts().turns).toHaveLength(0);
  });

  it("rehydrates mid-visit and keeps appending to the open turn", () => {
    const first = new Toy({ limit: 10 });
    first.record(T20);
    const prior: EngineFacts = first.facts();
    const second = new Toy({ limit: 10 }, prior);
    second.record(T20);
    expect(second.facts().turns).toHaveLength(1);
    expect(second.facts().turns[0].darts).toHaveLength(2);
  });

  it("returns detached copies from state() and facts()", () => {
    const engine = new Toy({ limit: 10 });
    engine.record(T20);
    engine.facts().turns.pop();
    (engine.state() as Toy).darts = 99;
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.state().darts).toBe(1);
  });

  it("delegates wouldComplete to the spec without mutating", () => {
    const engine = new Toy({ limit: 2 });
    engine.record(T20);
    expect(engine.wouldComplete(T20)).toBe(true);
    expect(engine.facts().turns[0].darts).toHaveLength(1);
  });
});

describe("dartGameEngineFactory", () => {
  it("carries the spec's key and ownership and builds the class", () => {
    const factory = dartGameEngineFactory(spec, Toy);
    expect(factory.rulesetVersionKey).toBe("BOBS27_V1");
    expect(factory.stageOwnership).toBe("PER_SEAT");
    expect(factory.create({ limit: 3 })).toBeInstanceOf(Toy);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/modules/game/dart-engine-shell.module.test.ts`
Expected: FAIL — cannot resolve `@modules/game/dart-engine-shell.module`.

- [ ] **Step 3: Write the implementation**

```ts
// app/src/modules/game/dart-engine-shell.module.ts
import type { RulesetVersionKey } from "@lib/types";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import {
  appendObservedDart,
  cloneTurns,
  exerciseBlockStage,
  openOrCreateTurn,
  undoLastDart,
} from "./turn-log.module";
import type {
  DartIntent,
  DartObservation,
  EngineFacts,
  StageOwnership,
  TurnFact,
} from "./types";

/** The two fields the shell reads from any folded state. */
export type ShellState = { activeParticipantRef: string; status: string };

/**
 * What a single-stage, dart-input engine decides; everything else — the log,
 * keys, `completedAt`, undo, rehydration — is the shell's (Pattern 18).
 * `refusal` returns the error `record()` throws, or null to accept.
 */
export interface DartGameSpec<TConfig, TState extends ShellState> {
  readonly rulesetVersionKey: RulesetVersionKey;
  readonly stageOwnership: StageOwnership;
  fold(facts: EngineFacts, config: TConfig): TState;
  refusal(state: TState): string | null;
  intent(state: TState, config: TConfig): DartIntent;
  isVisitOpen(turn: TurnFact): boolean;
  wouldComplete(
    state: TState,
    observation: DartObservation,
    config: TConfig,
  ): boolean;
}

/** A shell-built engine; `spec` brands it so `instanceof` narrows to it. */
export type ShellGameEngine<TConfig, TState extends ShellState> = GameEngine<
  DartObservation,
  TState
> & { readonly spec: DartGameSpec<TConfig, TState> };

export type DartGameEngineClass<TConfig, TState extends ShellState> = new (
  config: TConfig,
  prior?: EngineFacts,
) => ShellGameEngine<TConfig, TState>;

/**
 * Builds a `GameEngine` class over one `EXERCISE_BLOCK` stage from `spec`.
 * `undo()` pops one dart (`undoLastDart`); `isComplete()` is any status
 * other than `IN_PROGRESS`.
 */
export function dartGameEngineClass<TConfig, TState extends ShellState>(
  spec: DartGameSpec<TConfig, TState>,
): DartGameEngineClass<TConfig, TState> {
  const stage = exerciseBlockStage();
  return class implements ShellGameEngine<TConfig, TState> {
    readonly spec = spec;
    readonly rulesetVersionKey = spec.rulesetVersionKey;
    readonly stageOwnership = spec.stageOwnership;
    private readonly turns: TurnFact[];

    constructor(
      private readonly config: TConfig,
      prior?: EngineFacts,
    ) {
      this.turns = prior ? cloneTurns(prior.turns) : [];
    }

    private deriveState(): TState {
      return spec.fold(
        { stages: [{ ...stage }], turns: this.turns },
        this.config,
      );
    }

    record(observation: DartObservation): TState {
      const before = this.deriveState();
      const refusal = spec.refusal(before);
      if (refusal !== null) throw new Error(refusal);
      const turn = openOrCreateTurn(
        this.turns,
        stage.clientKey,
        before.activeParticipantRef,
        spec.isVisitOpen,
      );
      appendObservedDart(turn, observation, spec.intent(before, this.config));
      if (!spec.isVisitOpen(turn)) turn.completedAt = new Date().toISOString();
      return this.deriveState();
    }

    undo(): boolean {
      return undoLastDart(this.turns);
    }

    wouldComplete(observation: DartObservation): boolean {
      return spec.wouldComplete(this.deriveState(), observation, this.config);
    }

    isComplete(): boolean {
      return this.deriveState().status !== "IN_PROGRESS";
    }

    state(): TState {
      return this.deriveState();
    }

    facts(): EngineFacts {
      return { stages: [{ ...stage }], turns: cloneTurns(this.turns) };
    }
  };
}

/** The registry-facing factory for a shell-built engine class. */
export function dartGameEngineFactory<TConfig, TState extends ShellState>(
  spec: DartGameSpec<TConfig, TState>,
  Engine: DartGameEngineClass<TConfig, TState>,
): GameEngineFactory<TConfig, DartObservation, TState> {
  return {
    rulesetVersionKey: spec.rulesetVersionKey,
    stageOwnership: spec.stageOwnership,
    create: (config, prior) => new Engine(config, prior),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/modules/game/dart-engine-shell.module.test.ts`
Expected: PASS, 7 tests. If "returns detached copies" fails on `state()`, the spec's `fold` is returning a shared object — the toy's does not, so investigate the shell.

- [ ] **Step 5: Gates and commit**

Run: `npx tsc --noEmit -p . && bash ../scripts/fallow-gate.sh`
Expected: 0 errors. Fallow may flag `dart-engine-shell.module.ts` exports as unused until Task 3 — if it fails on that, do not commit separately: continue to Task 3 and commit both together.

```bash
git add src/modules/game/dart-engine-shell.module.ts tests/modules/game/dart-engine-shell.module.test.ts
git commit -m "feat(engine): dart game engine shell"
```

---

### Task 3: Migrate Doubles Training onto the shell

**Files:**
- Create (temporary): `app/tests/modules/game/legacy/doubles-training.legacy.ts`
- Create: `app/tests/modules/game/doubles-training.golden.test.ts`
- Modify: `app/src/modules/game/doubles-training.engine.module.ts` (the `DoublesTrainingEngine` class and `doublesTrainingEngineFactory`, currently lines ~172–281)
- Test (unchanged, must pass): `app/tests/modules/game/doubles-training.engine.module.test.ts`

**Interfaces:**
- Consumes: Task 1 `runOracle`, `normalise`, `randomObservation`; Task 2 `dartGameEngineClass`, `dartGameEngineFactory`, `DartGameSpec`.
- Produces: `DoublesTrainingEngine` (value + type); `doublesTrainingEngineFactory` unchanged in shape. The spec constant is module-private — exporting it is a fallow unused-export failure (found in a spike).

- [ ] **Step 1: Freeze the legacy oracle**

Copy the current `DoublesTrainingEngine` class verbatim from `src/modules/game/doubles-training.engine.module.ts` into `tests/modules/game/legacy/doubles-training.legacy.ts`, renamed `LegacyDoublesTrainingEngine`. Change only its imports to absolute aliases:

```ts
import type { DoublesTrainingSnapshot, Seated } from "@lib/types";
import { doublesPath, isHitOn, targetAt } from "@modules/game/board-progression.module";
import { activeSeatState, otherSeatsComplete } from "@modules/game/seat-state.module";
import {
  appendObservedDart,
  cloneTurns,
  doubleTargetIntent,
  exerciseBlockStage,
  openOrCreateTurn,
  undoLastDart,
} from "@modules/game/turn-log.module";
import {
  applyDoublesTrainingDart,
  foldDoublesTrainingState,
} from "@modules/game/doubles-training.engine.module";
import type { GameEngine } from "@modules/game/interfaces";
import type {
  DartFact,
  DartObservation,
  DoublesTrainingState,
  EngineFacts,
  TurnFact,
} from "@modules/types";
```

Also copy the private helpers it uses (`STAGE`, `dartHitIntendedTarget`, `isVisitOpen`) into the legacy file. Do **not** call `registerEngineFactory` there.

- [ ] **Step 2: Write the oracle test (fails until Step 4)**

```ts
// app/tests/modules/game/doubles-training.golden.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DoublesTrainingEngine } from "@modules/game/doubles-training.engine.module";
import { LegacyDoublesTrainingEngine } from "./legacy/doubles-training.legacy";
import { normalise, randomObservation, runOracle } from "./support/engine-oracle";
import { seededUniform } from "@modules/game/seeded-rng.module";
import type { DoublesTrainingSnapshot, Seated } from "@lib/types";
import type { EngineFacts } from "@modules/types";

const seat = (n: number, side: string) => ({
  participantRef: `participant-${n}`,
  displayName: `P${n}`,
  sideKey: side,
  participantTypeKey: "PLAYER" as const,
});
const ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25];
const CONFIGS: Record<string, Seated<DoublesTrainingSnapshot>> = {
  solo: { mode: "EASY", orderMode: "LOW_TO_HIGH", targetOrder: ORDER, seats: [seat(1, "A")] },
  duo: { mode: "EASY", orderMode: "LOW_TO_HIGH", targetOrder: ORDER, seats: [seat(1, "A"), seat(2, "B")] },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Doubles Training shell migration — oracle", () => {
  for (const [name, config] of Object.entries(CONFIGS)) {
    it(`${name}: matches the legacy engine step for step`, () => {
      runOracle({
        build: (prior?: EngineFacts) => new DoublesTrainingEngine(config, prior),
        legacy: (prior?: EngineFacts) => new LegacyDoublesTrainingEngine(config, prior),
        seeds: Array.from({ length: 20 }, (_, i) => i + 1),
        steps: 120,
        undoRate: 0.15,
        rehydrateEvery: 11,
      });
    }, 60_000);
  }
});

describe("Doubles Training — golden", () => {
  for (const [name, config] of Object.entries(CONFIGS)) {
    it(`${name}: seed 42 run is unchanged`, () => {
      const engine = new DoublesTrainingEngine(config);
      const rand = seededUniform(42, 0);
      for (let i = 0; i < 160 && !engine.isComplete(); i += 1) {
        if (rand() < 0.1) engine.undo();
        else engine.record(randomObservation(rand));
      }
      expect(normalise({ facts: engine.facts(), state: engine.state() })).toMatchSnapshot();
    });
  }
});
```

Run: `npx vitest run tests/modules/game/doubles-training.golden.test.ts`
Expected: oracle tests PASS (both sides are still the old class), golden tests write snapshots. **Delete the written snapshot file** (`tests/modules/game/__snapshots__/doubles-training.golden.test.ts.snap`) — goldens are recorded only after the oracle proves the new engine, in Step 5.

- [ ] **Step 3: Replace the class with a spec + shell**

In `src/modules/game/doubles-training.engine.module.ts`, delete the `DoublesTrainingEngine` class and the `doublesTrainingEngineFactory` object; drop now-unused imports (`appendObservedDart`, `cloneTurns`, `openOrCreateTurn`, `undoLastDart`, `GameEngine`, `GameEngineFactory`, `activeSeatState` stays — used below). Add:

```ts
import {
  dartGameEngineClass,
  dartGameEngineFactory,
  type DartGameSpec,
} from "./dart-engine-shell.module";

const COMPLETE_REFUSAL =
  "Cannot record a dart once the session is complete; undo first to correct it.";

/**
 * Doubles Training's rules for the dart engine shell: a 21-target path (the
 * 20 doubles and BULL), each visit ending the instant a dart hits its double
 * or after 3 misses, per seat. Score-compare, most doubles hit wins.
 */
const doublesTrainingSpec: DartGameSpec<
  Seated<DoublesTrainingSnapshot>,
  DoublesTrainingState
> = {
  rulesetVersionKey: "DOUBLES_TRAINING_V1",
  stageOwnership: "PER_SEAT",
  fold: foldDoublesTrainingState,
  refusal: (state) =>
    activeSeatState(state).status === "IN_PROGRESS" ? null : COMPLETE_REFUSAL,
  intent: (state, config) =>
    doubleTargetIntent(
      targetAt(doublesPath(config.targetOrder), activeSeatState(state).targetIndex),
    ),
  isVisitOpen,
  wouldComplete: (state, observation, config) => {
    const seat = activeSeatState(state);
    if (seat.status !== "IN_PROGRESS") return false;
    if (applyDoublesTrainingDart(config, seat, observation).status !== "COMPLETE")
      return false;
    return otherSeatsComplete(
      state.seats,
      seat.participantRef,
      (other) => other.status === "COMPLETE",
    );
  },
};

/** Doubles Training engine (Pattern 18), built by the dart engine shell. */
export const DoublesTrainingEngine = dartGameEngineClass(doublesTrainingSpec);
export type DoublesTrainingEngine = InstanceType<typeof DoublesTrainingEngine>;

export const doublesTrainingEngineFactory = dartGameEngineFactory(
  doublesTrainingSpec,
  DoublesTrainingEngine,
);

registerEngineFactory(doublesTrainingEngineFactory);
```

Keep the `STAGE` constant only if `foldDoublesTrainingState` or another export still uses it; otherwise delete it (fallow flags unused locals).

- [ ] **Step 4: Run oracle + existing tests**

Run: `npx vitest run tests/modules/game/doubles-training`
Expected: oracle PASS (2), existing `doubles-training.engine.module.test.ts` PASS unchanged, golden tests write fresh snapshots.
If the oracle fails, the error names seed/step/field — fix the spec, never the oracle or the legacy copy.

- [ ] **Step 5: Lock goldens, delete legacy**

Keep the snapshot file written in Step 4 (it was recorded while the oracle proved new ≡ legacy). Then:
- delete `tests/modules/game/legacy/doubles-training.legacy.ts`;
- delete the `"Doubles Training shell migration — oracle"` `describe` block and the `LegacyDoublesTrainingEngine` / `runOracle` imports from the golden test.

Run: `npx vitest run tests/modules/game/doubles-training && npx tsc --noEmit -p .`
Expected: PASS; 0 type errors.

- [ ] **Step 6: Gates and commit**

Run from repo root: `bash scripts/check-game-engines.sh && bash scripts/check-game-wiring.sh && bash scripts/check-test-coverage.sh`, then from `app/`: `npm test && bash ../scripts/fallow-gate.sh && npm run check`
Expected: all exit 0; `npm run check` reports 0 errors, 0 warnings, 0 hints.

```bash
git add -A src/modules/game tests/modules/game
git commit -m "refactor(engine): Doubles Training on the dart engine shell"
```

---

### Task 4: Migrate Bob's 27 onto the shell

**Files:**
- Create (temporary): `app/tests/modules/game/legacy/bobs27.legacy.ts`
- Create: `app/tests/modules/game/bobs27.golden.test.ts`
- Modify: `app/src/modules/game/bobs27.engine.module.ts` (the `Bobs27Engine` class and `bobs27EngineFactory`, currently lines ~179–298)
- Modify: `docs/architecture/07-Frontend/09-Adding-A-Game.md` (exemplar paragraph)
- Test (unchanged, must pass): `app/tests/modules/game/bobs27.engine.module.test.ts`

**Interfaces:**
- Consumes: as Task 3.
- Produces: `Bobs27Engine` (value + type), `bobs27EngineFactory`. `bobs27Spec` stays module-private.

- [ ] **Step 1: Freeze the legacy oracle**

Copy the current `Bobs27Engine` class verbatim into `tests/modules/game/legacy/bobs27.legacy.ts` as `LegacyBobs27Engine`, imports rewritten to `@modules/...` aliases, including its local `STAGE = exerciseBlockStage()`. Import `applyBobs27Dart` and `foldBobs27State` from `@modules/game/bobs27.engine.module`. No registration.

- [ ] **Step 2: Write the oracle + golden test**

```ts
// app/tests/modules/game/bobs27.golden.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Bobs27Engine } from "@modules/game/bobs27.engine.module";
import { LegacyBobs27Engine } from "./legacy/bobs27.legacy";
import { normalise, randomObservation, runOracle } from "./support/engine-oracle";
import { seededUniform } from "@modules/game/seeded-rng.module";
import type { Bobs27Snapshot, Seated } from "@lib/types";
import type { EngineFacts } from "@modules/types";

const seat = (n: number, side: string) => ({
  participantRef: `participant-${n}`,
  displayName: `P${n}`,
  sideKey: side,
  participantTypeKey: "PLAYER" as const,
});
const CONFIGS: Record<string, Seated<Bobs27Snapshot>> = {
  solo: { startScore: 27, bullHitValue: 50, missPenaltyMultiplier: 1, seats: [seat(1, "A")] },
  duo: { startScore: 27, bullHitValue: 50, missPenaltyMultiplier: 1, seats: [seat(1, "A"), seat(2, "B")] },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Bob's 27 shell migration — oracle", () => {
  for (const [name, config] of Object.entries(CONFIGS)) {
    it(`${name}: matches the legacy engine step for step`, () => {
      runOracle({
        build: (prior?: EngineFacts) => new Bobs27Engine(config, prior),
        legacy: (prior?: EngineFacts) => new LegacyBobs27Engine(config, prior),
        seeds: Array.from({ length: 20 }, (_, i) => i + 1),
        steps: 120,
        undoRate: 0.15,
        rehydrateEvery: 11,
      });
    }, 60_000);
  }
});

describe("Bob's 27 — golden", () => {
  for (const [name, config] of Object.entries(CONFIGS)) {
    it(`${name}: seed 42 run is unchanged`, () => {
      const engine = new Bobs27Engine(config);
      const rand = seededUniform(42, 0);
      for (let i = 0; i < 160 && !engine.isComplete(); i += 1) {
        if (rand() < 0.1) engine.undo();
        else engine.record(randomObservation(rand));
      }
      expect(normalise({ facts: engine.facts(), state: engine.state() })).toMatchSnapshot();
    });
  }
});
```

Run: `npx vitest run tests/modules/game/bobs27.golden.test.ts`
Expected: PASS against the old class. Delete the written `__snapshots__/bobs27.golden.test.ts.snap`.

- [ ] **Step 3: Replace the class with a spec + shell**

Delete the `Bobs27Engine` class and `bobs27EngineFactory` object and the now-unused imports. Add:

```ts
import {
  dartGameEngineClass,
  dartGameEngineFactory,
  type DartGameSpec,
} from "./dart-engine-shell.module";

const MATCH_ENDED =
  "Cannot record a dart once the match has ended; undo first to correct it.";
const GAME_ENDED =
  "Cannot record a dart once the game has ended; undo first to correct it.";

/**
 * Bob's 27's rules for the dart engine shell: three darts at each double in
 * turn, D1 to BULL; elimination when a seat's derived score drops to zero
 * or below. Only a visit's 3rd dart can end a seat.
 */
const bobs27Spec: DartGameSpec<Seated<Bobs27Snapshot>, Bobs27State> = {
  rulesetVersionKey: "BOBS27_V1",
  stageOwnership: "PER_SEAT",
  fold: foldBobs27State,
  refusal: (state) => {
    if (state.status !== "IN_PROGRESS") return MATCH_ENDED;
    return activeSeatState(state).status === "IN_PROGRESS" ? null : GAME_ENDED;
  },
  intent: (state) =>
    doubleTargetIntent(targetAt(doublesPath(), activeSeatState(state).targetIndex)),
  isVisitOpen: (turn) => turn.darts.length < 3,
  wouldComplete: (state, observation, config) => {
    if (state.status !== "IN_PROGRESS") return false;
    const seat = activeSeatState(state);
    if (seat.status !== "IN_PROGRESS") return false;
    if (seat.dartsThisVisit.length < 2) return false;
    return applyBobs27Dart(config, seat, observation).status !== "IN_PROGRESS";
  },
};

/** Bob's 27 engine (Pattern 18), built by the dart engine shell. */
export const Bobs27Engine = dartGameEngineClass(bobs27Spec);
export type Bobs27Engine = InstanceType<typeof Bobs27Engine>;

export const bobs27EngineFactory = dartGameEngineFactory(bobs27Spec, Bobs27Engine);

registerEngineFactory(bobs27EngineFactory);
```

- [ ] **Step 4: Run oracle + existing tests**

Run: `npx vitest run tests/modules/game/bobs27`
Expected: oracle PASS (2), existing engine test PASS unchanged, goldens written.

- [ ] **Step 5: Lock goldens, delete legacy, update the exemplar doc**

Delete `tests/modules/game/legacy/bobs27.legacy.ts` (and the now-empty `legacy/` directory) and the oracle block + its imports from the golden test. In `docs/architecture/07-Frontend/09-Adding-A-Game.md`, replace the sentence

`When a step below says "copy the existing shape", copy Bob's 27's — \`bobs27-setup.data.ts\`, \`bobs27.validator.ts\`, \`bobs27.engine.module.ts\`.`

with

`When a step below says "copy the existing shape", copy Bob's 27's — \`bobs27-setup.data.ts\`, \`bobs27.validator.ts\`, \`bobs27.engine.module.ts\`. Its engine is a \`DartGameSpec\` bound to the shell in \`modules/game/dart-engine-shell.module.ts\`; a single-stage dart engine copies that shape, not a hand-written class.`

and set the front-matter `updated:` to the execution date.

- [ ] **Step 6: Gates and commit**

Same commands as Task 3 Step 6, plus from repo root `bash scripts/check-doc-links.sh && bash scripts/check-context-budget.sh`.

```bash
git add -A src/modules/game tests/modules/game ../docs/architecture/07-Frontend/09-Adding-A-Game.md
git commit -m "refactor(engine): Bob's 27 on the dart engine shell"
```

---

### Task 5: Exercise engine shell + Target Scoring

**Files:**
- Create: `app/src/modules/training/exercises/dart-exercise-shell.module.ts`
- Test: `app/tests/modules/training/exercises/dart-exercise-shell.module.test.ts`
- Create (temporary): `app/tests/modules/training/exercises/legacy/target-scoring.legacy.ts`
- Create: `app/tests/modules/training/exercises/target-scoring.golden.test.ts`
- Modify: `app/src/modules/training/exercises/target-scoring.engine.module.ts` (the `TargetScoringEngine` class and factory, currently lines ~176–250)
- Test (unchanged, must pass): `app/tests/modules/training/exercises/target-scoring.engine.module.test.ts`, and the routine controller tests that call `targetScoringEngine?.expireTimer()` (`tests/lib/training/routines/routine-play.data.test.ts`)

**Interfaces:**
- Consumes: Task 1 oracle; `turn-log` helpers; `DartExerciseEngine`, `DartExerciseEngineFactory`; `SOLO_PARTICIPANT_REF`.
- Produces:

```ts
export interface DartExerciseSpec<TConfig, TState> {
  readonly exerciseRulesetVersionKey: ExerciseRulesetVersionKey;
  parse(config: TConfig): TConfig;
  fold(facts: EngineFacts, config: TConfig, expired: boolean): TState;
  intent(state: TState, config: TConfig): DartIntent;
  isVisitOpen(turn: TurnFact): boolean;
}
export type TimedDartExerciseEngine<TConfig, TState> = DartExerciseEngine<TState> & {
  readonly spec: DartExerciseSpec<TConfig, TState>;
  expireTimer(): void;
};
export type DartExerciseEngineClass<TConfig, TState> =
  new (config: TConfig, prior?: EngineFacts) => TimedDartExerciseEngine<TConfig, TState>;
export function dartExerciseEngineClass<TConfig, TState>(spec: DartExerciseSpec<TConfig, TState>): DartExerciseEngineClass<TConfig, TState>;
export function dartExerciseEngineFactory<TConfig, TState>(spec: DartExerciseSpec<TConfig, TState>, Engine: DartExerciseEngineClass<TConfig, TState>): DartExerciseEngineFactory<TConfig, TState>;
```

Scope: clockless timed exercises — completion only via `expireTimer()`; `undo()` after expiry un-expires without popping (matches Target Scoring today). Self-ending exercises extend this in their family plan.

- [ ] **Step 1: Write the failing shell test**

```ts
// app/tests/modules/training/exercises/dart-exercise-shell.module.test.ts
import { describe, it, expect } from "vitest";
import {
  dartExerciseEngineClass,
  dartExerciseEngineFactory,
  type DartExerciseSpec,
} from "@modules/training/exercises/dart-exercise-shell.module";
import type { DartObservation } from "@modules/types";

type Toy = { darts: number; expired: boolean };
const spec: DartExerciseSpec<{ n: number }, Toy> = {
  exerciseRulesetVersionKey: "TARGET_SCORING_V1",
  parse: (c) => ({ n: c.n }),
  fold: (facts, _c, expired) => ({
    darts: facts.turns.reduce((s, t) => s + t.darts.length, 0),
    expired,
  }),
  intent: () => ({ intendedTargetNumber: 20, intendedZoneKey: "TREBLE" }),
  isVisitOpen: (t) => t.darts.length < 3,
};
const T20: DartObservation = { hitTargetNumber: 20, hitZoneKey: "TREBLE", locationX: null, locationY: null };
const Toy = dartExerciseEngineClass(spec);

describe("dartExerciseEngineClass", () => {
  it("records as the solo participant in 3-dart visits", () => {
    const e = new Toy({ n: 1 });
    [T20, T20, T20, T20].forEach((o) => e.record(o));
    const turns = e.facts().turns;
    expect(turns.map((t) => t.darts.length)).toEqual([3, 1]);
    expect(turns[0].participantRef).toBe("solo");
    expect(turns[0].completedAt).not.toBeNull();
  });

  it("expireTimer completes; record then throws and leaves facts alone", () => {
    const e = new Toy({ n: 1 });
    e.record(T20);
    e.expireTimer();
    expect(e.isComplete()).toBe(true);
    expect(e.state().expired).toBe(true);
    const before = e.facts();
    expect(() => e.record(T20)).toThrow(
      "Cannot record a dart once the exercise is complete; undo first to correct it.",
    );
    expect(e.facts()).toEqual(before);
  });

  it("undo after expiry un-expires without popping a dart", () => {
    const e = new Toy({ n: 1 });
    e.record(T20);
    e.expireTimer();
    expect(e.undo()).toBe(true);
    expect(e.isComplete()).toBe(false);
    expect(e.facts().turns[0].darts).toHaveLength(1);
  });

  it("factory carries the key and builds the class", () => {
    const f = dartExerciseEngineFactory(spec, Toy);
    expect(f.exerciseRulesetVersionKey).toBe("TARGET_SCORING_V1");
    expect(f.create({ n: 1 })).toBeInstanceOf(Toy);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/modules/training/exercises/dart-exercise-shell.module.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the exercise shell**

```ts
// app/src/modules/training/exercises/dart-exercise-shell.module.ts
import type { ExerciseRulesetVersionKey } from "@lib/types";
import type {
  DartIntent,
  DartObservation,
  EngineFacts,
  TurnFact,
} from "@modules/types";
import {
  appendObservedDart,
  cloneTurns,
  exerciseBlockStage,
  openOrCreateTurn,
  undoLastDart,
} from "@modules/game/turn-log.module";
import type { DartExerciseEngine, DartExerciseEngineFactory } from "./interfaces";
import { SOLO_PARTICIPANT_REF } from "./solo-participant.module";

const EXPIRED_REFUSAL =
  "Cannot record a dart once the exercise is complete; undo first to correct it.";

/**
 * What a clockless timed dart exercise decides; the shell owns the log,
 * keys, `completedAt`, undo and expiry (D264). `fold` receives whether the
 * controller's timer has expired.
 */
export interface DartExerciseSpec<TConfig, TState> {
  readonly exerciseRulesetVersionKey: ExerciseRulesetVersionKey;
  parse(config: TConfig): TConfig;
  fold(facts: EngineFacts, config: TConfig, expired: boolean): TState;
  intent(state: TState, config: TConfig): DartIntent;
  isVisitOpen(turn: TurnFact): boolean;
}

/** A shell-built exercise; `spec` brands it so `instanceof` narrows to it. */
export type TimedDartExerciseEngine<TConfig, TState> =
  DartExerciseEngine<TState> & {
    readonly spec: DartExerciseSpec<TConfig, TState>;
    expireTimer(): void;
  };

export type DartExerciseEngineClass<TConfig, TState> = new (
  config: TConfig,
  prior?: EngineFacts,
) => TimedDartExerciseEngine<TConfig, TState>;

/**
 * Builds a `DartExerciseEngine` class over one `EXERCISE_BLOCK` stage.
 * Complete only once `expireTimer()` is called; `undo()` first reverses an
 * expiry, then pops one dart.
 */
export function dartExerciseEngineClass<TConfig, TState>(
  spec: DartExerciseSpec<TConfig, TState>,
): DartExerciseEngineClass<TConfig, TState> {
  const stage = exerciseBlockStage();
  return class implements TimedDartExerciseEngine<TConfig, TState> {
    readonly spec = spec;
    readonly exerciseRulesetVersionKey = spec.exerciseRulesetVersionKey;
    private readonly config: TConfig;
    private readonly turns: TurnFact[];
    private expired = false;

    constructor(config: TConfig, prior?: EngineFacts) {
      this.config = spec.parse(config);
      this.turns = prior ? cloneTurns(prior.turns) : [];
    }

    private deriveState(): TState {
      return spec.fold(
        { stages: [{ ...stage }], turns: this.turns },
        this.config,
        this.expired,
      );
    }

    record(observation: DartObservation): TState {
      if (this.expired) throw new Error(EXPIRED_REFUSAL);
      const intent = spec.intent(this.deriveState(), this.config);
      const turn = openOrCreateTurn(
        this.turns,
        stage.clientKey,
        SOLO_PARTICIPANT_REF,
        spec.isVisitOpen,
      );
      appendObservedDart(turn, observation, intent);
      if (!spec.isVisitOpen(turn)) turn.completedAt = new Date().toISOString();
      return this.deriveState();
    }

    undo(): boolean {
      if (this.expired) {
        this.expired = false;
        return true;
      }
      return undoLastDart(this.turns);
    }

    expireTimer(): void {
      this.expired = true;
    }

    isComplete(): boolean {
      return this.expired;
    }

    state(): TState {
      return this.deriveState();
    }

    facts(): EngineFacts {
      return { stages: [{ ...stage }], turns: cloneTurns(this.turns) };
    }
  };
}

/** The registry-facing factory for a shell-built exercise class. */
export function dartExerciseEngineFactory<TConfig, TState>(
  spec: DartExerciseSpec<TConfig, TState>,
  Engine: DartExerciseEngineClass<TConfig, TState>,
): DartExerciseEngineFactory<TConfig, TState> {
  return {
    exerciseRulesetVersionKey: spec.exerciseRulesetVersionKey,
    create: (config, prior) => new Engine(config, prior),
  };
}
```

Run: `npx vitest run tests/modules/training/exercises/dart-exercise-shell.module.test.ts` → PASS, 4 tests.

- [ ] **Step 4: Freeze legacy Target Scoring and write the oracle + golden test**

Copy the current `TargetScoringEngine` class verbatim into `tests/modules/training/exercises/legacy/target-scoring.legacy.ts` as `LegacyTargetScoringEngine` (with `STAGE`, `DARTS_PER_VISIT`, a copy of the private `intentFor`, imports rewritten to aliases; import `foldTargetScoringState` and `TargetScoringV1Config` from their modules). Then:

```ts
// app/tests/modules/training/exercises/target-scoring.golden.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TargetScoringEngine } from "@modules/training/exercises/target-scoring.engine.module";
import { LegacyTargetScoringEngine } from "./legacy/target-scoring.legacy";
import { normalise, randomObservation, runOracle } from "../../game/support/engine-oracle";
import { seededUniform } from "@modules/game/seeded-rng.module";
import type { EngineFacts } from "@modules/types";

const CONFIGS = { numbers: { targets: [20, 19, 18] }, withBull: { targets: [20, 25] } };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Target Scoring shell migration — oracle", () => {
  for (const [name, config] of Object.entries(CONFIGS)) {
    it(`${name}: matches the legacy engine step for step`, () => {
      runOracle({
        build: (prior?: EngineFacts) => new TargetScoringEngine(config, prior),
        legacy: (prior?: EngineFacts) => new LegacyTargetScoringEngine(config, prior),
        seeds: Array.from({ length: 20 }, (_, i) => i + 1),
        steps: 120,
        undoRate: 0.15,
        expireAt: 90,
        rehydrateEvery: 13,
      });
    }, 60_000);
  }
});

describe("Target Scoring — golden", () => {
  for (const [name, config] of Object.entries(CONFIGS)) {
    it(`${name}: seed 42 run is unchanged`, () => {
      const engine = new TargetScoringEngine(config);
      const rand = seededUniform(42, 0);
      for (let i = 0; i < 90; i += 1) {
        if (rand() < 0.1) engine.undo();
        else engine.record(randomObservation(rand));
      }
      engine.expireTimer();
      expect(normalise({ facts: engine.facts(), state: engine.state() })).toMatchSnapshot();
    });
  }
});
```

Note: `rehydrateEvery` rebuilds both sides from facts, which resets expiry on both — symmetric, so the comparison stays valid.

Run: `npx vitest run tests/modules/training/exercises/target-scoring.golden.test.ts` → PASS against the old class. Delete the written snapshot file.

- [ ] **Step 5: Replace the Target Scoring class**

Delete the `TargetScoringEngine` class and `targetScoringEngineFactory` object and the imports they alone used. Add:

```ts
import {
  dartExerciseEngineClass,
  dartExerciseEngineFactory,
  type DartExerciseSpec,
} from "./dart-exercise-shell.module";

/**
 * Target Scoring's rules for the exercise shell: build the highest chain on
 * the current target before a miss resets it; one three-dart visit per
 * `TurnFact`, each dart carrying its own intended target.
 */
const targetScoringSpec: DartExerciseSpec<
  TargetScoringConfigData,
  TargetScoringState
> = {
  exerciseRulesetVersionKey: EXERCISE_RULESET_VERSION_KEY,
  parse: (config) => TargetScoringV1Config.parse(config),
  fold: foldTargetScoringState,
  intent: (state) => intentFor(state.currentTargetNumber),
  isVisitOpen: (turn) => turn.darts.length < DARTS_PER_VISIT,
};

/** Target Scoring exercise engine (D264), built by the exercise shell. */
export const TargetScoringEngine = dartExerciseEngineClass(targetScoringSpec);
export type TargetScoringEngine = InstanceType<typeof TargetScoringEngine>;

export const targetScoringEngineFactory = dartExerciseEngineFactory(
  targetScoringSpec,
  TargetScoringEngine,
);

registerDartExerciseEngineFactory(targetScoringEngineFactory);
```

Check `foldTargetScoringState`'s third parameter is the `complete` boolean in that position; if its signature differs, adapt with `fold: (facts, config, expired) => foldTargetScoringState(facts, config, expired)` only — never change the fold.

- [ ] **Step 6: Run, lock goldens, delete legacy**

Run: `npx vitest run tests/modules/training tests/lib/training`
Expected: oracle PASS, existing Target Scoring and routine-play tests PASS unchanged, goldens written.
Then delete `tests/modules/training/exercises/legacy/` and the oracle block + its imports from the golden test; re-run the same command → PASS.

- [ ] **Step 7: Gates and commit**

Same commands as Task 3 Step 6.

```bash
git add -A src/modules/training/exercises tests/modules/training/exercises
git commit -m "refactor(training): exercise engine shell; Target Scoring on it"
```

---

### Task 6: Canonical docs, decision, final validation

**Files:**
- Modify: `docs/architecture/04-Architecture-patterns.md` (Pattern 18 §Application + §Rule; version line at file top)
- Modify: `app/src/modules/game/CLAUDE.md`, `app/src/modules/training/CLAUDE.md`
- Modify: `decisions/game-engine.md` (append one block)
- Modify: `docs/architecture/00-File-Inventory.md` only if `check-context-budget.sh` reports token drift for an edited file
- Modify: `docs/architecture/00-Context-Map-History.md` (append the version entry per `context-maintenance`)

- [ ] **Step 1: Pattern 18**

After the paragraph beginning "The mechanical half of an engine — everything with no ruleset content in it —", add:

```markdown
A single-stage, dart-input engine goes further: it is a `DartGameSpec` — `fold`, `refusal`, `intent`, `isVisitOpen`, `wouldComplete` — bound to the shell in `modules/game/dart-engine-shell.module.ts`, which owns the log, keys, `completedAt`, undo and rehydration. Clockless timed exercises do the same with `DartExerciseSpec` and `modules/training/exercises/dart-exercise-shell.module.ts`. A hand-written class is the opt-out for an engine the shell cannot express (multi-stage, visit input). <!-- <execution date> -->
```

Under `## Rule`, after "It never adds a new engine API, a new fact model, or a per-game payload module.", add: `Where the shell fits, a new engine is a spec bound to it, not a hand-written class.`

Bump the patterns doc version line by a minor version with a one-clause summary, following the existing format at the top of the file.

- [ ] **Step 2: Scope CLAUDE.md files**

`app/src/modules/game/CLAUDE.md`, append to the bullet list:

```markdown
- A single-stage, dart-input engine is a `DartGameSpec` bound to `dart-engine-shell.module.ts`, not a hand-written class; Doubles Training and Bob's 27 are the reference shape. A shell migration of a shipped engine must prove itself with the differential oracle (`app/tests/modules/game/support/engine-oracle.ts`) before its golden snapshots replace the legacy copy. (<execution date>, D<n>)
```

`app/src/modules/training/CLAUDE.md`, append under "Exercise engines":

```markdown
- A clockless timed dart exercise is a `DartExerciseSpec` bound to `exercises/dart-exercise-shell.module.ts`; Target Scoring is the reference shape. (<execution date>, D<n>)
```

- [ ] **Step 3: Decision block**

Take the next free number (`grep -rhoE "^### D[0-9]+" decisions | sort -t D -k2 -n | tail -1`, plus one). Append to `decisions/game-engine.md`:

```markdown
### D<n> — Dart engines are specs bound to a shared shell
Status: Accepted · Date: <execution date>
Decision: single-stage, dart-input game engines are a `DartGameSpec` bound to `dart-engine-shell.module.ts`; clockless timed dart exercises a `DartExerciseSpec` bound to `dart-exercise-shell.module.ts`. Shipped engines migrate one per PR, proven by a differential oracle against a frozen legacy copy, then locked by golden snapshots. Doubles Training, Bob's 27 and Target Scoring migrated first.
Reason: every dart engine repeated ~100–150 lines of identical class shell around its pure fold; the shell is L2 of the rule-kernels design (`docs/superpowers/specs/2026-10-15-rule-kernels-design.md`), which family kernels plug into.
Consequences: Pattern 18, `09-Adding-A-Game.md` and both engine scope guides name the shell. Multi-stage (121, TUOD, 501) and visit-input engines stay hand-written until the Checkout and Visit-points plans extend the shell. `GameEngine` and `DartExerciseEngine` stay separate contracts (D264).
Supersedes: none.
```

- [ ] **Step 4: Context maintenance and full validation**

Invoke the `context-maintenance` skill and follow it. Then run the `run-all-gates` skill for `app/` and `docs/`, and `npm run validate:app` from `app/` (needs `DATABASE_URL` — after the reset).
Expected: every step exits 0; type check 0 errors / 0 warnings / 0 hints; fallow duplication count not higher than before Task 2 (record the before/after numbers in the PR body).

- [ ] **Step 5: Format, commit, PR**

```bash
cd app && npm run format && npm run format:check && cd ..
git add -A
git commit -m "docs(engine): shell in Pattern 18, scope guides, D<n>"
```

Then finish via `superpowers:finishing-a-development-branch` + `finishing-a-dart-branch` (push + PR).

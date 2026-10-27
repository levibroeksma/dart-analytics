import { expect } from "vitest";
import { seededUniform } from "@modules/game/seeded-rng.module";
import type { DartObservation, DartZoneKey, EngineFacts } from "@modules/types";

export type OracleEngine<TInput = DartObservation> = {
  record(o: TInput): unknown;
  undo(): boolean;
  state(): unknown;
  facts(): EngineFacts;
  isComplete(): boolean;
  wouldComplete?(o: TInput): boolean;
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
        if (
          (k === "clientKey" || k === "stageClientKey") &&
          typeof v === "string"
        )
          return [k, rename(v)];
        if (k === "completedAt" && typeof v === "string") return [k, "<t>"];
        return [k, walk(v)];
      }),
    );
  };
  return walk(value) as T;
}

function attempt<T>(
  fn: () => T,
): { ok: true; value: T } | { ok: false; message: string } {
  try {
    return { ok: true, value: fn() };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}

function same(
  label: string,
  actual: unknown,
  expected: unknown,
  where: string,
) {
  try {
    expect(normalise(actual)).toEqual(normalise(expected));
  } catch {
    throw new Error(
      `${where}: ${label} diverged\n${JSON.stringify(normalise(actual))}\n!==\n${JSON.stringify(normalise(expected))}`,
    );
  }
}

type Observe<TInput> = (
  rand: () => number,
  engine: OracleEngine<TInput>,
) => TInput;

type OracleOptions<TInput> = {
  build: (prior?: EngineFacts) => OracleEngine<TInput>;
  legacy: (prior?: EngineFacts) => OracleEngine<TInput>;
  seeds: readonly number[];
  steps: number;
  undoRate?: number;
  expireAt?: number;
  rehydrateEvery?: number;
  resumeExpired?: boolean;
  observe?: Observe<TInput>;
};

type Pair<TInput> = {
  next: OracleEngine<TInput>;
  old: OracleEngine<TInput>;
};

function compare<TInput>(pair: Pair<TInput>, where: string): void {
  same("state", pair.next.state(), pair.old.state(), where);
  same("facts", pair.next.facts(), pair.old.facts(), where);
  same("isComplete", pair.next.isComplete(), pair.old.isComplete(), where);
}

function throwDart<TInput>(pair: Pair<TInput>, o: TInput, where: string): void {
  same(
    "wouldComplete",
    attempt(() => pair.next.wouldComplete?.(o)),
    attempt(() => pair.old.wouldComplete?.(o)),
    where,
  );
  same(
    "record",
    attempt(() => pair.next.record(o)),
    attempt(() => pair.old.record(o)),
    where,
  );
}

function act<TInput>(
  pair: Pair<TInput>,
  step: number,
  rand: () => number,
  opts: OracleOptions<TInput>,
  where: string,
): void {
  if (opts.expireAt === step) {
    pair.next.expireTimer?.();
    pair.old.expireTimer?.();
    return;
  }
  if (rand() < (opts.undoRate ?? 0)) {
    same("undo", pair.next.undo(), pair.old.undo(), where);
    return;
  }
  const observe =
    opts.observe ?? (randomObservation as unknown as Observe<TInput>);
  throwDart(pair, observe(rand, pair.old), where);
}

/** Whether a rebuild after `step` must re-expire, as the play page's countdown resume does. */
function resumesExpired(
  opts: { expireAt?: number; resumeExpired?: boolean },
  step: number,
): boolean {
  return (
    opts.resumeExpired === true &&
    opts.expireAt !== undefined &&
    step >= opts.expireAt
  );
}

function rehydrate<TInput>(
  pair: Pair<TInput>,
  opts: OracleOptions<TInput>,
  where: string,
): Pair<TInput> {
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
export function runOracle<TInput = DartObservation>(
  opts: OracleOptions<TInput>,
): void {
  for (const seed of opts.seeds) {
    const rand = seededUniform(seed, 0);
    let pair: Pair<TInput> = { next: opts.build(), old: opts.legacy() };
    for (let step = 0; step < opts.steps; step += 1) {
      const where = `seed ${seed} step ${step}`;
      act(pair, step, rand, opts, where);
      compare(pair, where);
      const every = opts.rehydrateEvery ?? 0;
      if (every > 0 && step % every === every - 1) {
        pair = rehydrate(pair, opts, where);
        if (resumesExpired(opts, step)) {
          pair.next.expireTimer?.();
          pair.old.expireTimer?.();
          compare(pair, `${where} (resumed expired)`);
        }
      }
    }
  }
}

type TraceOptions<TInput> = {
  build: (prior?: EngineFacts) => OracleEngine<TInput>;
  seed: number;
  steps: number;
  undoRate: number;
  rehydrateEvery: number;
  expireAt?: number;
  resumeExpired?: boolean;
  observe?: Observe<TInput>;
  describe?: (input: TInput) => string;
};

function describeObservation(o: unknown): string {
  const observation = o as DartObservation;
  return `${observation.hitZoneKey}/${observation.hitTargetNumber}`;
}

function outcomeLabel(result: ReturnType<typeof attempt>): string {
  return result.ok ? String(result.value) : `throws ${result.message}`;
}

function traceStep<TInput>(
  engine: OracleEngine<TInput>,
  rand: () => number,
  step: number,
  opts: TraceOptions<TInput>,
): string {
  if (opts.expireAt === step) {
    engine.expireTimer?.();
    return "expire";
  }
  if (rand() < opts.undoRate) return `undo ${engine.undo()}`;
  const observe =
    opts.observe ?? (randomObservation as unknown as Observe<TInput>);
  const o = observe(rand, engine);
  const would = outcomeLabel(attempt(() => engine.wouldComplete?.(o)));
  const recorded = outcomeLabel(
    attempt(() => {
      engine.record(o);
      return "ok";
    }),
  );
  return `record ${(opts.describe ?? describeObservation)(o)} would=${would} -> ${recorded}`;
}

/**
 * One seeded run through one engine as a line per step — every
 * `wouldComplete` answer, every `record` outcome or thrown message, every
 * undo result — with periodic rehydration from its own facts, then the
 * final facts and state. Snapshotted, it pins what the oracle pinned once
 * the legacy copy is gone.
 */
export function goldenTrace<TInput = DartObservation>(
  opts: TraceOptions<TInput>,
): unknown {
  const rand = seededUniform(opts.seed, 0);
  let engine = opts.build();
  const steps: string[] = [];
  for (let step = 0; step < opts.steps; step += 1) {
    steps.push(traceStep(engine, rand, step, opts));
    if (step % opts.rehydrateEvery === opts.rehydrateEvery - 1) {
      engine = opts.build(engine.facts());
      if (resumesExpired(opts, step)) engine.expireTimer?.();
    }
  }
  return normalise({
    steps,
    isComplete: engine.isComplete(),
    facts: engine.facts(),
    state: engine.state(),
  });
}

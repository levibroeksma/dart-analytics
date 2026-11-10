import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getEngineFactory } from "@modules/game/engine.registry";
import { RULESET_CONFIGS } from "@lib/game/rulesets/types";
import { DartFact } from "@routes/sessions/types";
import type { RulesetVersionKey } from "@lib/types";
import type { DartObservation, DartZoneKey } from "@modules/types";

/**
 * Contract: every dart any registered engine emits is accepted by the API's
 * `DartFact` schema, which mirrors the `darts` table CHECK constraints
 * (`chk_dart_target_consistency`, `chk_dart_location_pair`, target range).
 * An engine that stores a dart the API refuses can never be uploaded.
 *
 * Engines are discovered from `src/modules/game/*.engine.module.ts`, so a new
 * engine is covered the day it lands. A seeded random walk of dart
 * observations drives each one. An engine whose input is not a dart
 * observation (visit totals, attempts) must be listed in `NO_DART_ROWS`; an
 * engine that needs more than seats in its config must have a row in
 * `CONFIG_EXTRAS`. Both lists fail loudly rather than skip silently.
 */

const ENGINE_DIR = path.resolve(__dirname, "../../../src/modules/game");

/**
 * Visit- or attempt-level engines: input is a visit total or attempt, not a
 * dart observation, so the walk does not apply. Their "no dart rows" shape is
 * asserted in `dart-fact-target-consistency.test.ts`.
 */
const NO_DART_ROWS: ReadonlySet<RulesetVersionKey> = new Set([
  "501_V1",
  "501_V2",
  "SCORE_TRAINING_V1",
  "TUOD_V1",
]);

/** Config fields beyond `seats`, for engines that require them. */
const CONFIG_EXTRAS: Partial<Record<RulesetVersionKey, object>> = {
  ACE_V1: { rounds: 3, drawSeed: 7 },
  KILLER_V1: { lives: 3, seatNumbers: [5, 12] },
  FOLLOW_THE_LEADER_V1: { lives: 3 },
  PRISONER_V1: { darts: 3 },
};

const SEATS = [
  {
    participantRef: "p1",
    displayName: "Player 1",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
  {
    participantRef: "p2",
    displayName: "Player 2",
    sideKey: "B",
    participantTypeKey: "PLAYER" as const,
  },
];

const ZONES: readonly DartZoneKey[] = [
  "SINGLE",
  "INNER_SINGLE",
  "OUTER_SINGLE",
  "DOUBLE",
  "TREBLE",
  "OUTER_BULL",
  "INNER_BULL",
  "MISS",
];

/** Small LCG so a failure replays from the seed. */
function rng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function observation(next: () => number): DartObservation {
  const zone = ZONES[Math.floor(next() * ZONES.length)];
  if (zone === "MISS") {
    return {
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    };
  }
  const isBull = zone === "OUTER_BULL" || zone === "INNER_BULL";
  return {
    hitTargetNumber: isBull ? 25 : 1 + Math.floor(next() * 20),
    hitZoneKey: zone,
    locationX: null,
    locationY: null,
  };
}

const engineFiles = readdirSync(ENGINE_DIR).filter((file) =>
  file.endsWith(".engine.module.ts"),
);

async function loadEngines(): Promise<void> {
  for (const file of engineFiles) {
    await import(/* @vite-ignore */ path.join(ENGINE_DIR, file));
  }
}

function playRandom(key: RulesetVersionKey, seed: number) {
  const factory = getEngineFactory(key);
  if (!factory) throw new Error(`no engine registered for ${key}`);
  const engine = factory.create({ ...CONFIG_EXTRAS[key], seats: SEATS });
  const next = rng(seed);
  for (let step = 0; step < 600 && !engine.isComplete(); step++) {
    try {
      engine.record(observation(next));
    } catch {
      // A refused observation (wrong shape for this engine) is not a fact.
    }
  }
  return engine.facts();
}

describe("every registered engine's darts satisfy the API DartFact schema", async () => {
  await loadEngines();
  const keys = (Object.keys(RULESET_CONFIGS) as RulesetVersionKey[]).filter(
    (key) => getEngineFactory(key) !== undefined,
  );

  it("discovers the engine modules", () => {
    expect(engineFiles.length).toBeGreaterThan(10);
    expect(keys.length).toBeGreaterThanOrEqual(engineFiles.length);
  });

  for (const key of keys) {
    it.skipIf(NO_DART_ROWS.has(key))(
      `${key}: emits only uploadable darts`,
      () => {
        const darts = [11, 23, 47].flatMap((seed) =>
          playRandom(key, seed).turns.flatMap((turn) => turn.darts),
        );
        // Zero darts means the random walk never reached this engine: add a
        // CONFIG_EXTRAS row (or list it in NO_DART_ROWS if it is visit-level).
        expect(darts.length).toBeGreaterThan(0);
        for (const dart of darts) {
          const parsed = DartFact.safeParse(dart);
          expect(
            parsed.success,
            parsed.success ? "" : JSON.stringify(parsed.error.issues),
          ).toBe(true);
        }
      },
    );
  }
});

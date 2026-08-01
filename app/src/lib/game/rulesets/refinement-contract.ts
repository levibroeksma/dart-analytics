import { z } from "zod";
import { ScoreTrainingConfig } from "./types";
import type { SchemaRefinementContract } from "./types";

type ScoreTrainingInput = z.input<typeof ScoreTrainingConfig>;

const scoreTrainingRoundsBase = {
  duration_type: "ROUNDS",
  duration_value: 1,
  max_darts_per_turn: 3,
  max_visit_score: 180,
} satisfies ScoreTrainingInput;

const scoreTrainingMinutesBase = {
  ...scoreTrainingRoundsBase,
  duration_type: "MINUTES",
  duration_value: 5,
} satisfies ScoreTrainingInput;

/**
 * `ScoreTrainingConfig.duration_value` is bounded conditionally by
 * `duration_type` (ROUNDS 1..100, MINUTES 3..30), which is why it lives in a
 * whole-object `superRefine` instead of `.min()`/`.max()` on the field. That
 * refinement was silently dropped once during a shared-schema consolidation;
 * these probes are what make its absence fail the suite.
 *
 * Known blind spot, stated rather than papered over, and now asymmetric
 * between the two duration types. ROUNDS floor is still unprotected: its
 * refinement floor (1) matches the field-level `.min(1)` exactly, so
 * `duration_value: 0` for ROUNDS is rejected whether or not the refinement's
 * floor survives. Lower that floor and the ROUNDS reject-0 probe keeps
 * passing, same as before. MINUTES floor is different: its refinement floor
 * is 3, strictly above the field-level `.min(1)`, so `duration_value: 2` for
 * MINUTES clears `.min(1)` and is rejected only by the `superRefine`. That
 * makes the `duration_value 2 for MINUTES` reject probe below the first
 * load-bearing floor probe in this contract — weaken or delete the MINUTES
 * floor and it starts parsing successfully, failing the suite. Ceiling probes
 * on both duration types remain load-bearing as before: nothing else bounds
 * the top. A probe proves the schema rejected a value, never which constraint
 * rejected it, so any refinement bound that duplicates a field-level bound
 * (ROUNDS floor 1) stays unprotected on that side.
 */
const scoreTrainingContract: SchemaRefinementContract<ScoreTrainingInput> = {
  schemaName: "ScoreTrainingConfig",
  schema: ScoreTrainingConfig,
  fields: [
    {
      field: "duration_value",
      accept: [
        {
          label: "duration_value 1 for ROUNDS, the floor",
          config: { ...scoreTrainingRoundsBase, duration_value: 1 },
        },
        {
          label: "duration_value 100 for ROUNDS, the ceiling",
          config: { ...scoreTrainingRoundsBase, duration_value: 100 },
        },
      ],
      reject: [
        {
          label: "duration_value 0 for ROUNDS, one below the floor",
          config: { ...scoreTrainingRoundsBase, duration_value: 0 },
        },
        {
          label: "duration_value 101 for ROUNDS, one past the ceiling",
          config: { ...scoreTrainingRoundsBase, duration_value: 101 },
        },
      ],
    },
    {
      field: "duration_value",
      accept: [
        {
          label: "duration_value 3 for MINUTES, the floor",
          config: { ...scoreTrainingMinutesBase, duration_value: 3 },
        },
        {
          label: "duration_value 30 for MINUTES, the ceiling",
          config: { ...scoreTrainingMinutesBase, duration_value: 30 },
        },
      ],
      reject: [
        {
          label: "duration_value 2 for MINUTES, one below the floor",
          config: { ...scoreTrainingMinutesBase, duration_value: 2 },
        },
        {
          label: "duration_value 31 for MINUTES, one past the ceiling",
          config: { ...scoreTrainingMinutesBase, duration_value: 31 },
        },
      ],
    },
  ],
};

/**
 * Every schema in `types.ts` that carries a `.superRefine(`/`.refine(`, with
 * the boundaries each refined field must accept and reject. Adding a
 * refinement without a matching entry here fails
 * `scripts/check-refinement-coverage.sh`.
 */
export const REFINEMENT_CONTRACTS: readonly SchemaRefinementContract[] = [
  scoreTrainingContract,
];

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
} satisfies ScoreTrainingInput;

/**
 * `ScoreTrainingConfig.duration_value` is bounded conditionally by
 * `duration_type` (ROUNDS 1..50, MINUTES 1..180), which is why it lives in a
 * whole-object `superRefine` instead of `.min()`/`.max()` on the field. That
 * refinement was silently dropped once during a shared-schema consolidation;
 * these probes are what make its absence fail the suite.
 *
 * Known blind spot, stated rather than papered over: the floor probes below
 * are not load-bearing. `duration_value` also carries a field-level `.min(1)`,
 * so `duration_value: 0` is rejected whether or not the refinement's floor
 * still exists. Lower or delete that floor and every probe here keeps passing,
 * and `scripts/check-refinement-coverage.sh` — which only checks that the
 * refinement exists at all — keeps passing too. Only the ceiling probes
 * actually pin the refinement. A probe proves the schema rejected a value,
 * never which constraint rejected it, so any refinement that duplicates a
 * field-level bound is unprotected on that side.
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
          label: "duration_value 50 for ROUNDS, the ceiling",
          config: { ...scoreTrainingRoundsBase, duration_value: 50 },
        },
      ],
      reject: [
        {
          label: "duration_value 0 for ROUNDS, one below the floor",
          config: { ...scoreTrainingRoundsBase, duration_value: 0 },
        },
        {
          label: "duration_value 51 for ROUNDS, one past the ceiling",
          config: { ...scoreTrainingRoundsBase, duration_value: 51 },
        },
      ],
    },
    {
      field: "duration_value",
      accept: [
        {
          label: "duration_value 1 for MINUTES, the floor",
          config: { ...scoreTrainingMinutesBase, duration_value: 1 },
        },
        {
          label: "duration_value 180 for MINUTES, the ceiling",
          config: { ...scoreTrainingMinutesBase, duration_value: 180 },
        },
      ],
      reject: [
        {
          label: "duration_value 0 for MINUTES, one below the floor",
          config: { ...scoreTrainingMinutesBase, duration_value: 0 },
        },
        {
          label: "duration_value 181 for MINUTES, one past the ceiling",
          config: { ...scoreTrainingMinutesBase, duration_value: 181 },
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

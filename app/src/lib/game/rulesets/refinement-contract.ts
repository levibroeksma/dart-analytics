import { z } from "zod";
import {
  DoublesTrainingConfig,
  OneTwentyOneV2Config,
  ScoreTrainingConfig,
  SinglesConfig,
  SinglesV2Config,
  TuodConfig,
} from "./types";
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

type SinglesInput = z.input<typeof SinglesConfig>;
type DoublesTrainingInput = z.input<typeof DoublesTrainingConfig>;

const ASCENDING_TARGET_ORDER = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
];

const singlesBase = {
  order_mode: "LOW_TO_HIGH",
  difficulty: "EASY",
  points_single: 1,
  points_double: 2,
  points_treble: 3,
} satisfies Omit<SinglesInput, "target_order">;

/**
 * The "wrong length" reject probe is not superRefine-exclusive — the
 * field-level `.length(21)` already rejects it on its own, same blind spot
 * `scoreTrainingContract`'s own comment documents for its ROUNDS floor. The
 * "duplicate value" probe is the load-bearing one: it is exactly length 21,
 * so only the superRefine's uniqueness check can reject it.
 */
const singlesTrainingContract: SchemaRefinementContract<SinglesInput> = {
  schemaName: "SinglesConfig",
  schema: SinglesConfig,
  fields: [
    {
      field: "target_order",
      accept: [
        {
          label: "a valid permutation of 1..20 and 25",
          config: { ...singlesBase, target_order: ASCENDING_TARGET_ORDER },
        },
      ],
      reject: [
        {
          label:
            "a duplicate value (two 1s, missing 2) — load-bearing, length stays 21",
          config: {
            ...singlesBase,
            target_order: [
              1, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
              20, 25,
            ],
          },
        },
        {
          label: "wrong length (20 entries, missing BULL)",
          config: {
            ...singlesBase,
            target_order: [
              1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
              20,
            ],
          },
        },
      ],
    },
  ],
};

type SinglesV2Input = z.input<typeof SinglesV2Config>;

const singlesV2Base = {
  order_mode: "LOW_TO_HIGH",
  difficulty: "EASY",
  points_single: 1,
  points_double: 2,
  points_treble: 3,
} satisfies Omit<SinglesV2Input, "target_order">;

/**
 * Mirrors `singlesTrainingContract` exactly — `SinglesV2Config` re-declares
 * the identical `target_order` `superRefine` (Zod schemas don't compose a
 * diff), so the same two probes apply verbatim.
 */
const singlesTrainingV2Contract: SchemaRefinementContract<SinglesV2Input> = {
  schemaName: "SinglesV2Config",
  schema: SinglesV2Config,
  fields: [
    {
      field: "target_order",
      accept: [
        {
          label: "a valid permutation of 1..20 and 25",
          config: { ...singlesV2Base, target_order: ASCENDING_TARGET_ORDER },
        },
      ],
      reject: [
        {
          label:
            "a duplicate value (two 1s, missing 2) — load-bearing, length stays 21",
          config: {
            ...singlesV2Base,
            target_order: [
              1, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
              20, 25,
            ],
          },
        },
        {
          label: "wrong length (20 entries, missing BULL)",
          config: {
            ...singlesV2Base,
            target_order: [
              1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
              20,
            ],
          },
        },
      ],
    },
  ],
};

const doublesBase = {
  mode: "EASY",
  order_mode: "LOW_TO_HIGH",
} satisfies Omit<DoublesTrainingInput, "target_order">;

const doublesTrainingContract: SchemaRefinementContract<DoublesTrainingInput> =
  {
    schemaName: "DoublesTrainingConfig",
    schema: DoublesTrainingConfig,
    fields: [
      {
        field: "target_order",
        accept: [
          {
            label: "a valid permutation of 1..20 and 25",
            config: { ...doublesBase, target_order: ASCENDING_TARGET_ORDER },
          },
        ],
        reject: [
          {
            label:
              "a duplicate value (two 1s, missing 2) — load-bearing, length stays 21",
            config: {
              ...doublesBase,
              target_order: [
                1, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
                19, 20, 25,
              ],
            },
          },
          {
            label: "wrong length (20 entries, missing BULL)",
            config: {
              ...doublesBase,
              target_order: [
                1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
                19, 20,
              ],
            },
          },
        ],
      },
    ],
  };

type OneTwentyOneV2Input = z.input<typeof OneTwentyOneV2Config>;

/**
 * `OneTwentyOneV2Config.duration_value` is bounded conditionally by
 * `duration_type` — omitted entirely for TARGET, 1..50 for ROUNDS, 3..30 for
 * MINUTES — which is why it lives in a whole-object `superRefine` rather than
 * `.min()`/`.max()` on the field alone. Ceiling and floor probes on both
 * ROUNDS and MINUTES are load-bearing: nothing else in the schema bounds
 * them. The TARGET-must-omit-`duration_value` rule is exercised via its own
 * `duration_type` field entry below, since it is not a bound on
 * `duration_value`'s own range.
 */
const oneTwentyOneV2Contract: SchemaRefinementContract<OneTwentyOneV2Input> = {
  schemaName: "OneTwentyOneV2Config",
  schema: OneTwentyOneV2Config,
  fields: [
    {
      field: "duration_value",
      accept: [
        {
          label: "TARGET with no duration_value",
          config: { duration_type: "TARGET" },
        },
      ],
      reject: [
        {
          label: "TARGET carrying a duration_value",
          config: { duration_type: "TARGET", duration_value: 10 },
        },
      ],
    },
    {
      field: "duration_value",
      accept: [
        {
          label: "duration_value 1 for ROUNDS, the floor",
          config: { duration_type: "ROUNDS", duration_value: 1 },
        },
        {
          label: "duration_value 50 for ROUNDS, the ceiling",
          config: { duration_type: "ROUNDS", duration_value: 50 },
        },
      ],
      reject: [
        {
          label: "duration_value 0 for ROUNDS, one below the floor",
          config: { duration_type: "ROUNDS", duration_value: 0 },
        },
        {
          label: "duration_value 51 for ROUNDS, one past the ceiling",
          config: { duration_type: "ROUNDS", duration_value: 51 },
        },
      ],
    },
    {
      field: "duration_value",
      accept: [
        {
          label: "duration_value 3 for MINUTES, the floor",
          config: { duration_type: "MINUTES", duration_value: 3 },
        },
        {
          label: "duration_value 30 for MINUTES, the ceiling",
          config: { duration_type: "MINUTES", duration_value: 30 },
        },
      ],
      reject: [
        {
          label: "duration_value 2 for MINUTES, one below the floor",
          config: { duration_type: "MINUTES", duration_value: 2 },
        },
        {
          label: "duration_value 31 for MINUTES, one past the ceiling",
          config: { duration_type: "MINUTES", duration_value: 31 },
        },
      ],
    },
  ],
};

type TuodInput = z.input<typeof TuodConfig>;

const tuodBase = {
  starting_target: 41,
  finish_bonus: 10,
  miss_penalty: 1,
  duration_type: "ROUNDS",
  duration_value: 1,
  max_darts_per_turn: 3,
} satisfies TuodInput;

const tuodMinutesBase = {
  ...tuodBase,
  duration_type: "MINUTES",
  duration_value: 5,
} satisfies TuodInput;

/**
 * `TuodConfig.duration_value` is bounded conditionally by `duration_type` —
 * identical to `ScoreTrainingConfig`'s own bound (ROUNDS 1..100, MINUTES
 * 3..30) — which is why it lives in a whole-object `superRefine` instead of
 * `.min()`/`.max()` on the field alone.
 *
 * Same blind spot as `scoreTrainingContract`: ROUNDS floor (1) duplicates the
 * field-level `.min(1)`, so `duration_value: 0` for ROUNDS is rejected either
 * way and that reject probe is not load-bearing on its own. MINUTES floor (3)
 * is strictly above `.min(1)`, so `duration_value: 2` for MINUTES clears
 * `.min(1)` and is rejected only by this `superRefine` — that probe is the
 * first genuinely load-bearing floor probe in this contract. Ceiling probes
 * on both duration types are load-bearing: nothing else bounds the top.
 */
const tuodContract: SchemaRefinementContract<TuodInput> = {
  schemaName: "TuodConfig",
  schema: TuodConfig,
  fields: [
    {
      field: "duration_value",
      accept: [
        {
          label: "duration_value 1 for ROUNDS, the floor",
          config: { ...tuodBase, duration_value: 1 },
        },
        {
          label: "duration_value 100 for ROUNDS, the ceiling",
          config: { ...tuodBase, duration_value: 100 },
        },
      ],
      reject: [
        {
          label: "duration_value 0 for ROUNDS, one below the floor",
          config: { ...tuodBase, duration_value: 0 },
        },
        {
          label: "duration_value 101 for ROUNDS, one past the ceiling",
          config: { ...tuodBase, duration_value: 101 },
        },
      ],
    },
    {
      field: "duration_value",
      accept: [
        {
          label: "duration_value 3 for MINUTES, the floor",
          config: { ...tuodMinutesBase, duration_value: 3 },
        },
        {
          label: "duration_value 30 for MINUTES, the ceiling",
          config: { ...tuodMinutesBase, duration_value: 30 },
        },
      ],
      reject: [
        {
          label: "duration_value 2 for MINUTES, one below the floor",
          config: { ...tuodMinutesBase, duration_value: 2 },
        },
        {
          label: "duration_value 31 for MINUTES, one past the ceiling",
          config: { ...tuodMinutesBase, duration_value: 31 },
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
  singlesTrainingContract,
  singlesTrainingV2Contract,
  doublesTrainingContract,
  oneTwentyOneV2Contract,
  tuodContract,
];

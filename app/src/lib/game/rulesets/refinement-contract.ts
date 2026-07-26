import { z } from "zod";
import { ScoreTrainingConfig } from "@lib/game/rulesets/types";

/**
 * One boundary probe: a complete, parseable config plus the label the contract
 * test reports it under.
 */
export type BoundaryProbe<TConfig extends Record<string, unknown>> = {
  readonly label: string;
  readonly config: TConfig;
};

/**
 * Every boundary one refined field must accept and must reject. `accept` and
 * `reject` are both required: a contract that only rejects proves nothing
 * about the values the schema is supposed to let through, and vice versa.
 */
export type RefinedFieldContract<TConfig extends Record<string, unknown>> = {
  readonly field: string;
  readonly accept: readonly BoundaryProbe<TConfig>[];
  readonly reject: readonly BoundaryProbe<TConfig>[];
};

/**
 * A single Zod issue as the contract test reads it — only the path matters,
 * since the test uses it to confirm a rejection was blamed on the field the
 * contract claims to cover rather than on some unrelated part of the config.
 */
export type RefinementIssue = {
  readonly path: readonly PropertyKey[];
};

export type RefinementParseResult =
  | { readonly success: true }
  | {
      readonly success: false;
      readonly error: { readonly issues: readonly RefinementIssue[] };
    };

/**
 * The only capability the contract test needs from a schema. Structural rather
 * than `z.ZodTypeAny` so a contract entry cannot smuggle in a loosely typed
 * stand-in that silently accepts everything.
 */
export type ParsableSchema = {
  safeParse(data: unknown): RefinementParseResult;
};

/**
 * One schema's refinement contract. `schemaName` is the export name in
 * `types.ts`; `scripts/check-refinement-coverage.sh` compares the set of names
 * declared here against the set of schemas that actually carry a
 * `.superRefine(`/`.refine(` there, and the contract test asserts `schema` is
 * the very export that name refers to.
 */
export type SchemaRefinementContract<
  TConfig extends Record<string, unknown> = Record<string, unknown>,
> = {
  readonly schemaName: string;
  readonly schema: ParsableSchema;
  readonly fields: readonly RefinedFieldContract<TConfig>[];
};

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

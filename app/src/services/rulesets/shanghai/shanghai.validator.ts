import { ShanghaiConfig, ShanghaiV2Config, ShanghaiV3Config } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import type { BatchValidationResult } from "@services/types";
import type { EventsBatchRequestInput } from "@routes/types";
import { createThreeDartValidator } from "../three-dart.validator";
import { isVisualBoardCapture } from "../visual-board.validator";
import { runsIn, withBoardSumTotals } from "../target-visit.validator";

const DARTLESS_ISSUE = (clientKey: string) =>
  `turn ${clientKey} must carry dart rows — every Shanghai visit is exactly 3 darts, hit or miss, never a dartless total`;

type ShanghaiConfigSchema = Parameters<
  typeof createThreeDartValidator
>[0]["configSchema"];

const DEFAULT_RANGE_START = 1;

function rangeStartOf(config: Record<string, unknown>): number {
  return typeof config.range_start === "number"
    ? config.range_start
    : DEFAULT_RANGE_START;
}

/**
 * A closed Shanghai visit's `totalScore` is the change it made to the seat's
 * score: the board score of the darts on the round's number, or a halving
 * (never positive) on a Hard blank. Rejects a turn whose total is neither that
 * target's runs, nor 0, nor a non-positive total on a visit with no target
 * hit; the round is the participant's stored turn count plus the turns before
 * it in the batch.
 */
function rejectWrongVisitTotal(
  batch: EventsBatchRequestInput,
  existingTurnCounts: Record<string, number>,
  rangeStart: number,
): BatchValidationResult | null {
  const thrown = new Map<string, number>();
  const turns = batch.stages
    .flatMap((stage) => stage.turns)
    .sort((a, b) => a.sequence - b.sequence);
  for (const turn of turns) {
    const before =
      thrown.get(turn.participantRef) ??
      existingTurnCounts[turn.participantRef] ??
      0;
    thrown.set(turn.participantRef, before + 1);
    const target = rangeStart + before;
    const runs = runsIn(turn, target);
    const explained =
      turn.totalScore === runs || (runs === 0 && turn.totalScore <= 0);
    if (!explained && turn.totalScore !== 0) {
      return {
        valid: false,
        code: "VALIDATION_FAILED",
        issues: [
          `turn ${turn.clientKey} totalScore ${turn.totalScore} is neither the runs scored on ${target} (${runs}) nor 0 for a void visit`,
        ],
      };
    }
  }
  return null;
}

function shanghaiValidatorFor(
  configSchema: ShanghaiConfigSchema,
): RulesetValidator {
  const base = createThreeDartValidator({
    label: "Shanghai",
    configSchema,
    dartlessIssue: DARTLESS_ISSUE,
  });
  return {
    ...base,
    validateBatch(args) {
      if (
        !isVisualBoardCapture(
          args.captureModeKey ?? "",
          args.inputModeKey ?? "",
        )
      ) {
        return base.validateBatch(args);
      }
      const shared = base.validateBatch({
        ...args,
        batch: withBoardSumTotals(args.batch),
      });
      if (!shared.valid) return shared;
      return (
        rejectWrongVisitTotal(
          args.batch,
          args.existingTurnCounts,
          rangeStartOf(args.config),
        ) ?? { valid: true }
      );
    },
  };
}

/**
 * Shanghai supports two mode pairs. A visit holds 1–3 darts under either
 * capture mode, board scores are non-negative under RECREATIONAL +
 * DETAILED_DARTS, and under ANALYTICS + VISUAL_BOARD every dart is re-derived
 * from its coordinate and the visit total is checked against the round's
 * target (`rejectWrongVisitTotal`). Versions differ only by which config
 * schema `validateConfig` parses against, mirroring `one-twenty-one.validator.ts`'s
 * V1/V2 split.
 */
export const shanghaiValidator: RulesetValidator =
  shanghaiValidatorFor(ShanghaiConfig);

export const shanghaiV2Validator: RulesetValidator =
  shanghaiValidatorFor(ShanghaiV2Config);

export const shanghaiV3Validator: RulesetValidator =
  shanghaiValidatorFor(ShanghaiV3Config);

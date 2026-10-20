import { dartLabel } from "@modules/stats/sections/checkout-path.module";
import type { DartFact, TurnFact } from "@modules/types";
import type { PreviewSegment } from "@lib/types";
import {
  targetScoringPoints,
  targetScoringTargetLabel,
} from "@modules/training/exercises/target-scoring.engine.module";
import { boardTargetLabel } from "@modules/game/board-progression.module";
import { switchbladeRoundSlots } from "@modules/training/exercises/switchblade.engine.module";
import type { DoublePatternConfigData, SwitchingConfigData } from "@lib/types";
import type {
  DartJudgement,
  ExerciseEngineSlots,
  ExercisePreviewFamily,
  VisitLabelInput,
} from "./types";

type Captions = (string | undefined)[];

const ENGINE_FAMILIES: readonly [
  keyof ExerciseEngineSlots,
  ExercisePreviewFamily,
][] = [
  ["switchingEngine", "switching"],
  ["doublePatternEngine", "doublePattern"],
  ["targetScoringEngine", "targetScoring"],
  ["scoreThresholdEngine", "freeAim"],
  ["checkoutSequenceEngine", "freeAim"],
  ["randomCheckoutEngine", "freeAim"],
  ["bullseyeCheckoutEngine", "bullseye"],
  ["hitCountEngine", "hitCount"],
  ["switchbladeEngine", "switchblade"],
  ["doublesLockEngine", "doublesLock"],
];

/** The preview family of whichever exercise engine is open, or null. */
export function exerciseFamily(
  engines: ExerciseEngineSlots,
): ExercisePreviewFamily | null {
  return ENGINE_FAMILIES.find(([slot]) => engines[slot] !== null)?.[1] ?? null;
}

function judgeOnTarget(dart: DartFact): DartJudgement {
  return dart.hitTargetNumber === dart.intendedTargetNumber ? "hit" : "miss";
}

function judgeDouble(dart: DartFact): DartJudgement {
  return judgeOnTarget(dart) === "hit" && dart.hitZoneKey === "DOUBLE"
    ? "hit"
    : "miss";
}

function judgeTargetScoring(dart: DartFact): DartJudgement {
  const scored =
    dart.intendedTargetNumber !== null &&
    targetScoringPoints(dart.intendedTargetNumber, dart) !== null;
  return scored ? "hit" : "miss";
}

function judgeFreeAim(dart: DartFact): DartJudgement {
  return dart.hitTargetNumber !== null ? "value" : "miss";
}

function judgeBullseye(dart: DartFact): DartJudgement {
  if (dart.intendedZoneKey !== "INNER_BULL") return judgeFreeAim(dart);
  return dart.hitZoneKey === "INNER_BULL" ? "hit" : "miss";
}

function judgeIntendedBed(dart: DartFact): DartJudgement {
  return dart.hitTargetNumber === dart.intendedTargetNumber &&
    dart.hitZoneKey === dart.intendedZoneKey
    ? "hit"
    : "miss";
}

const JUDGES: Record<ExercisePreviewFamily, (dart: DartFact) => DartJudgement> =
  {
    switching: judgeOnTarget,
    doublePattern: judgeDouble,
    targetScoring: judgeTargetScoring,
    freeAim: judgeFreeAim,
    bullseye: judgeBullseye,
    hitCount: judgeIntendedBed,
    switchblade: judgeOnTarget,
    doublesLock: judgeDouble,
  };

/**
 * Hit, miss or free-aim value for one dart. Each dart carries the target it
 * was thrown at, so no config lookup is needed; Double Pattern additionally
 * requires the double, both Target Scoring exercises share their ring rule
 * (a double is a miss), free-aim exercises have no target (a dart on the
 * board is a value), and Bullseye Checkouts judges setup darts as free aim
 * and the dart aimed at the bull as a hit only on the bullseye. Hit Count
 * counts only the intended bed. SwitchBlade judges on the number, any ring.
 * Doubles Lock judges the intended double only.
 */
export function judgeDart(
  family: ExercisePreviewFamily,
  dart: DartFact,
): DartJudgement {
  return JUDGES[family](dart);
}

function noCaptions(): Captions {
  return [undefined, undefined, undefined];
}

function switchingCaptions(input: VisitLabelInput): Captions {
  const config = input.config as SwitchingConfigData | null;
  return config?.targets.map(String) ?? noCaptions();
}

function doublePatternCaptions(input: VisitLabelInput): Captions {
  const patterns = (input.config as DoublePatternConfigData | null)?.patterns;
  if (!patterns?.length) return noCaptions();
  return patterns[input.visitIndex % patterns.length].map((n) => `D${n}`);
}

function targetScoringCaptions(input: VisitLabelInput): Captions {
  if (input.currentTargetNumber === undefined) return noCaptions();
  const label = targetScoringTargetLabel(input.currentTargetNumber);
  return [label, label, label];
}

function hitCountCaptions(input: VisitLabelInput): Captions {
  const label = input.currentTargetLabel;
  return label === undefined ? noCaptions() : [label, label, label];
}

function switchbladeCaptions(input: VisitLabelInput): Captions {
  return switchbladeRoundSlots(input.visitIndex).map(boardTargetLabel);
}

const CAPTIONS: Partial<
  Record<ExercisePreviewFamily, (input: VisitLabelInput) => Captions>
> = {
  switching: switchingCaptions,
  doublePattern: doublePatternCaptions,
  targetScoring: targetScoringCaptions,
  hitCount: hitCountCaptions,
  switchblade: switchbladeCaptions,
  doublesLock: hitCountCaptions,
};

/**
 * One caption per dart slot of the latest visit: the target that slot is
 * thrown at, or `undefined` where the exercise has none (the slot then reads
 * as its dart number).
 */
export function visitLabelsFor(
  family: ExercisePreviewFamily | null,
  input: VisitLabelInput,
): Captions {
  const captions = family ? CAPTIONS[family] : undefined;
  return captions ? captions(input) : noCaptions();
}

/** Most slots or chips one row of the 390px play column fits (D457). */
const WINDOW_SIZE = 6;

/**
 * The `WINDOW_SIZE`-item page of `items` that holds index `focus` (clamped
 * into the list); a list that fits is returned whole. Pages, rather than a
 * sliding window, keep each slot in place until its page is done.
 */
export function windowPage<T>(items: readonly T[], focus: number): T[] {
  const last = Math.max(items.length - 1, 0);
  const index = Math.min(Math.max(focus, 0), last);
  const start = Math.floor(index / WINDOW_SIZE) * WINDOW_SIZE;
  return items.slice(start, start + WINDOW_SIZE);
}

/** Where index `focus` sits within its `windowPage()` page. */
export function windowIndex(focus: number): number {
  return Math.max(focus, 0) % WINDOW_SIZE;
}

/** `length` items of `items` from `start`, wrapping both ways. */
export function cycleFrom<T>(
  items: readonly T[],
  start: number,
  length: number,
): T[] {
  const size = items.length;
  return Array.from(
    { length },
    (_, i) => items[(((start + i) % size) + size) % size],
  );
}

/**
 * The exercise visit preview: the latest visit's darts, one slot per dart
 * that visit throws. A landed dart is captioned with its zone (`T20`, `25`)
 * unless it missed; an empty slot with the target it will be thrown at. A
 * finished visit stays on screen until the next dart opens a new one. A visit
 * longer than one row shows only the page holding the next (or last) dart.
 */
export function visitPreview(input: {
  turns: readonly TurnFact[];
  visitLabels: (visitIndex: number) => readonly (string | undefined)[];
  judge: (dart: DartFact, index: number) => DartJudgement;
}): PreviewSegment[] {
  const visitIndex = Math.max(input.turns.length - 1, 0);
  const darts = input.turns.at(-1)?.darts ?? [];
  const segments = input
    .visitLabels(visitIndex)
    .map((label, index): PreviewSegment => {
      const dart = darts[index];
      if (!dart) return { status: "empty", label };
      const status = input.judge(dart, index);
      return status === "miss"
        ? { status }
        : { status, label: dartLabel(dart) };
    });
  return windowPage(segments, darts.length);
}

/** Bull Up's one-slot preview: the throw about to be made. */
export function bullUpPreview(throws: number): PreviewSegment[] {
  return [{ status: "empty", label: `THROW ${throws + 1}` }];
}

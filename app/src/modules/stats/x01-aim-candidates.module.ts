import {
  boardNeighbours,
  DOUBLE_OUT_FINISHES,
  SECTOR_ORDER,
} from "@lib/game/board/board-geometry.module";
import { formatTargetKey, formatWireKey } from "@lib/stats/target-key";
import {
  checkoutPathFor,
  checkoutPathWithin,
} from "@modules/game/checkout-path.module";
import type { AimBasis, AimCandidate, AimContext, InferredAim } from "./types";
import { bestLeavingScore, isGoodLeave } from "./x01-leave-rank.module";

/** A candidate for `aim` under `basis`, at the default weight. */
function candidate(aim: InferredAim, basis: AimBasis): AimCandidate {
  return { aim, basis, weight: 1 };
}

/** A treble, single or double aim on `number`. */
function ringAim(
  kind: "TREBLE" | "SINGLE" | "DOUBLE",
  number: number,
): InferredAim {
  return { kind, number, key: formatTargetKey(number, kind) };
}

const BULL_AIM: InferredAim = {
  kind: "BULL",
  key: formatTargetKey(25, "INNER_BULL"),
};

const OUTER_BULL_AIM: InferredAim = {
  kind: "OUTER_BULL",
  key: formatTargetKey(25, "OUTER_BULL"),
};

/** The route labels that name a bull rather than a number. */
const BULL_LABEL_AIMS: ReadonlyMap<string, InferredAim> = new Map([
  ["BULL", BULL_AIM],
  ["25", OUTER_BULL_AIM],
]);

/** The ring a numbered route label's prefix names; a label without one is a single. */
const LABEL_PREFIX_KINDS: ReadonlyMap<string, "TREBLE" | "DOUBLE"> = new Map([
  ["T", "TREBLE"],
  ["D", "DOUBLE"],
]);

/** The aim a route label names: `T20` treble, `20` single, `D20` double, `BULL` bull, `25` outer bull. */
function aimOfLabel(label: string): InferredAim {
  const bull = BULL_LABEL_AIMS.get(label);
  if (bull !== undefined) return bull;
  const kind = LABEL_PREFIX_KINDS.get(label.charAt(0));
  if (kind === undefined) return ringAim("SINGLE", Number(label));
  return ringAim(kind, Number(label.slice(1)));
}

/**
 * The wire merge of single `single` at `remaining`: the wire to its
 * best-ranked board neighbour whose score leaves a good leave, else the
 * single itself.
 */
function wireMerge(single: number, remaining: number): InferredAim {
  const best = bestLeavingScore(boardNeighbours(single), remaining);
  if (best === undefined) return ringAim("SINGLE", single);
  const low = Math.min(single, best);
  const high = Math.max(single, best);
  return { kind: "WIRE", numbers: [low, high], key: formatWireKey(low, high) };
}

/** A route label's aim, wire-merged when it is a single. */
function mergedAimOfLabel(label: string, remaining: number): InferredAim {
  const aim = aimOfLabel(label);
  return aim.kind === "SINGLE" ? wireMerge(aim.number, remaining) : aim;
}

/** The single (1–20) whose leave ranks best, when `remaining` is not itself a good leave. */
function splitSingle(remaining: number): number | undefined {
  if (isGoodLeave(remaining)) return undefined;
  return bestLeavingScore(SECTOR_ORDER, remaining);
}

/** Case A: no checkout route exists, so the dart went at a large target, T20, T19 or T18. */
const LARGE_TARGET_CANDIDATES: readonly AimCandidate[] = [
  candidate(ringAim("TREBLE", 20), "LARGE_TARGET"),
  candidate(ringAim("TREBLE", 19), "LARGE_TARGET"),
  candidate(ringAim("TREBLE", 18), "LARGE_TARGET"),
];

/** Case B: a double finish is on; a single that splits to a better leave is the other candidate. */
function finishCase(remaining: number): readonly AimCandidate[] {
  const finish = candidate(ringAim("DOUBLE", remaining / 2), "FINISH");
  const split = splitSingle(remaining);
  if (split === undefined) return [finish];
  return [finish, candidate(wireMerge(split, remaining), "SPLIT")];
}

/** Case C: 50 left, so the bull finish against the route's first dart, a route when two darts remain, else a setup. */
function bullCase(
  route: readonly string[],
  dartsLeft: number,
): readonly AimCandidate[] {
  const basis: AimBasis = dartsLeft >= 2 ? "ROUTE" : "SETUP";
  return [
    candidate(BULL_AIM, "FINISH"),
    candidate(aimOfLabel(route[0] as string), basis),
  ];
}

/** Cases D and E: the first dart of a checkout `route`, wire-merged, as the sole candidate under `basis`. */
function routeLeadCase(
  route: readonly string[],
  remaining: number,
  basis: AimBasis,
): readonly AimCandidate[] {
  return [candidate(mergedAimOfLabel(route[0] as string, remaining), basis)];
}

/**
 * The aims a 501 dart may have been thrown at, from its remaining score and
 * darts left only; exactly one of cases A–E applies (x01 inferred-aim design
 * §4.4).
 */
export function candidatesFor(ctx: AimContext): readonly AimCandidate[] {
  const { remaining, dartsLeft } = ctx;
  const route = checkoutPathFor(remaining);
  if (route === null) return LARGE_TARGET_CANDIDATES;
  if (remaining === 50) return bullCase(route, dartsLeft);
  if (DOUBLE_OUT_FINISHES.has(remaining)) return finishCase(remaining);
  const fit = checkoutPathWithin(remaining, dartsLeft);
  if (fit !== null) return routeLeadCase(fit, remaining, "ROUTE");
  return routeLeadCase(route, remaining, "SETUP");
}

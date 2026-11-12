import {
  areBoardNeighbours,
  SECTOR_ORDER,
} from "@lib/game/board/board-geometry.module";
import { formatTargetKey, formatWireKey } from "@lib/stats/target-key";
import {
  checkoutPathFor,
  checkoutPathWithin,
} from "@modules/game/checkout-path.module";
import type { AimBasis, AimCandidate, AimContext, InferredAim } from "./types";

/** Good leaves, best first: by how many times each halves evenly, ties to the higher (x01 inferred-aim design §4.3). */
export const LEAVE_RANK: readonly number[] = [
  32, 16, 40, 24, 8, 36, 28, 20, 12, 4,
];

/** Whether `leave` is a good leave: a multiple of 4 from 4 to 40. */
export function isGoodLeave(leave: number): boolean {
  return LEAVE_RANK.includes(leave);
}

function rankOf(leave: number): number {
  return LEAVE_RANK.indexOf(leave);
}

function candidate(aim: InferredAim, basis: AimBasis): AimCandidate {
  return { aim, basis, weight: 1 };
}

function trebleAim(number: number): InferredAim {
  return { kind: "TREBLE", number, key: formatTargetKey(number, "TREBLE") };
}

function singleAim(number: number): InferredAim {
  return { kind: "SINGLE", number, key: formatTargetKey(number, "SINGLE") };
}

function doubleAim(number: number): InferredAim {
  return { kind: "DOUBLE", number, key: formatTargetKey(number, "DOUBLE") };
}

const BULL_AIM: InferredAim = {
  kind: "BULL",
  key: formatTargetKey(25, "INNER_BULL"),
};

const OUTER_BULL_AIM: InferredAim = {
  kind: "OUTER_BULL",
  key: formatTargetKey(25, "OUTER_BULL"),
};

/** The aim a route label names: `T20` treble, `20` single, `D20` double, `BULL` bull, `25` outer bull. */
function aimOfLabel(label: string): InferredAim {
  if (label === "BULL") return BULL_AIM;
  if (label === "25") return OUTER_BULL_AIM;
  if (label.startsWith("T")) return trebleAim(Number(label.slice(1)));
  if (label.startsWith("D")) return doubleAim(Number(label.slice(1)));
  return singleAim(Number(label));
}

function boardNeighboursOf(number: number): readonly number[] {
  return SECTOR_ORDER.filter((other) => areBoardNeighbours(number, other));
}

/**
 * The wire merge of single `single` at `remaining`: the wire to its
 * best-ranked board neighbour whose score leaves a good leave, else the
 * single itself.
 */
function wireMerge(single: number, remaining: number): InferredAim {
  const best = boardNeighboursOf(single)
    .filter((neighbour) => isGoodLeave(remaining - neighbour))
    .sort((a, b) => rankOf(remaining - a) - rankOf(remaining - b))[0];
  if (best === undefined) return singleAim(single);
  const low = Math.min(single, best);
  const high = Math.max(single, best);
  return { kind: "WIRE", numbers: [low, high], key: formatWireKey(low, high) };
}

/** A route label's aim, wire-merged when it is a single. */
function mergedAimOfLabel(label: string, remaining: number): InferredAim {
  const aim = aimOfLabel(label);
  return aim.kind === "SINGLE" ? wireMerge(aim.number, remaining) : aim;
}

function isFinishable(remaining: number): boolean {
  return (
    (remaining % 2 === 0 && remaining >= 2 && remaining <= 40) ||
    remaining === 50
  );
}

/** The single (1–20, below `remaining`) whose leave ranks best, when `remaining` is not itself a good leave. */
function splitSingle(remaining: number): number | null {
  if (isGoodLeave(remaining)) return null;
  let best: number | null = null;
  for (let single = 1; single <= 20 && single < remaining; single++) {
    const leave = remaining - single;
    if (!isGoodLeave(leave)) continue;
    if (best === null || rankOf(leave) < rankOf(remaining - best)) {
      best = single;
    }
  }
  return best;
}

function largeTargetCase(): readonly AimCandidate[] {
  return [20, 19, 18].map((number) =>
    candidate(trebleAim(number), "LARGE_TARGET"),
  );
}

function finishCase(remaining: number): readonly AimCandidate[] {
  const finish = candidate(doubleAim(remaining / 2), "FINISH");
  const split = splitSingle(remaining);
  if (split === null) return [finish];
  return [finish, candidate(wireMerge(split, remaining), "SPLIT")];
}

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

function routeCase(
  fit: readonly string[],
  remaining: number,
): readonly AimCandidate[] {
  return [candidate(mergedAimOfLabel(fit[0] as string, remaining), "ROUTE")];
}

function setupCase(
  route: readonly string[],
  remaining: number,
): readonly AimCandidate[] {
  return [candidate(mergedAimOfLabel(route[0] as string, remaining), "SETUP")];
}

/**
 * The aims a 501 dart may have been thrown at, from its remaining score and
 * darts left only; exactly one of cases A–E applies (x01 inferred-aim design
 * §4.4).
 */
export function candidatesFor(ctx: AimContext): readonly AimCandidate[] {
  const { remaining, dartsLeft } = ctx;
  const route = checkoutPathFor(remaining);
  if (route === null) return largeTargetCase();
  if (remaining === 50) return bullCase(route, dartsLeft);
  if (isFinishable(remaining)) return finishCase(remaining);
  const fit = checkoutPathWithin(remaining, dartsLeft);
  if (fit !== null) return routeCase(fit, remaining);
  return setupCase(route, remaining);
}

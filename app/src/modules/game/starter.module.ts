import type { BoardPointMm, CoinFace, StarterResult } from "./types";

/** The bull-off crop's radius: the board out to the trebles, in millimetres. */
export const BULL_OFF_CROP_MM = 115;

const CROP_INSET_MM = 4;
const TIE_MM = 1;

/** Distance from the bull centre in millimetres. */
export function bullDistanceMm(point: BoardPointMm): number {
  return Math.hypot(point.x, point.y);
}

/**
 * Pulls a point back inside the crop (radius `BULL_OFF_CROP_MM` less a 4mm
 * inset), so a dart beyond the trebles counts as the crop's edge.
 */
export function clampToCrop(point: BoardPointMm): BoardPointMm {
  const limit = BULL_OFF_CROP_MM - CROP_INSET_MM;
  const distance = bullDistanceMm(point);
  if (distance <= limit) return point;
  const scale = limit / distance;
  return { x: point.x * scale, y: point.y * scale };
}

/** The closer dart's side, or `"tie"` when the two are within 1mm. */
export function bullOffResult(
  first: BoardPointMm,
  second: BoardPointMm,
): StarterResult {
  const a = bullDistanceMm(first);
  const b = bullDistanceMm(second);
  if (Math.abs(a - b) < TIE_MM) return "tie";
  return a < b ? 0 : 1;
}

/** Dartbot's throw at the bull: 3–37mm out, biased toward the bull. */
export function botBullThrow(random: () => number): BoardPointMm {
  const radius = 3 + Math.pow(random(), 1.4) * 34;
  const angle = random() * Math.PI * 2;
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

/** A fair coin: heads below 0.5. */
export function tossCoin(random: () => number): CoinFace {
  return random() < 0.5 ? "heads" : "tails";
}

/** Side 0 calls the coin; it wins on a correct call. */
export function coinWinner(call: CoinFace, outcome: CoinFace): 0 | 1 {
  return call === outcome ? 0 : 1;
}

/**
 * The coin's next `rotateX` in degrees: five full turns on from the last
 * resting face, plus a half turn to land on tails.
 */
export function coinRotation(previousDeg: number, outcome: CoinFace): number {
  return (
    previousDeg - (previousDeg % 360) + 1800 + (outcome === "tails" ? 180 : 0)
  );
}

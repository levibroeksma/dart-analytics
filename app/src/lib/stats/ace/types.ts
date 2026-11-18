/** A count out of a whole: a share before it is turned into a rate. */
export type Ratio = { part: number; whole: number };

/** The side most of the period's directional misses went. */
export type DriftDirection = "Left" | "Right" | "High" | "Low";

/** One Ace comparison measure: this period's share and the preceding period's, `null` with no preceding period. */
export type AceMeasure = { current: Ratio; previous: Ratio | null };

/** The three Ace comparison measures over the page period against the preceding period of equal length. */
export type AceComparison = {
  hit: AceMeasure;
  drift: AceMeasure & { direction: DriftDirection | null };
  near: AceMeasure;
};

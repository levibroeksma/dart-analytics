import type { BustRateMetrics, LadderProgressMetrics } from "@modules/types";
import type { SeriesBucket } from "@lib/types";
import type { AceMeasure } from "../ace/types";

/** Goes and finishes at one ladder target, or summed over a band. */
export type LadderTotal = { attempts: number; successes: number };

/** One band of ladder targets with its gated finish rate. */
export type LadderBand = {
  start: number;
  end: number;
  attempts: number;
  successes: number;
  rate: number | null;
};

/** How targets are grouped: bands of `size` from `origin`, the top one ending at `cap`; targets below `origin` form one band; a rate shows from `minSample` goes. */
export type LadderBandOptions = {
  origin: number;
  size: number;
  cap: number;
  minSample: number;
};

/** The ladder and bust reads one period's comparison is computed from. */
export type CheckoutInput = {
  ladder: SeriesBucket<LadderProgressMetrics>[];
  busts: SeriesBucket<BustRateMetrics>[];
};

/** The highest target reached in the page period and the preceding one, with the goes each rests on; the preceding fields are `null` with no preceding period. */
export type PeakMeasure = {
  current: number | null;
  previous: number | null;
  currentGoes: number;
  previousGoes: number | null;
};

/** The four Checkout comparison measures over the page period against the preceding period of equal length. */
export type CheckoutComparison = {
  finish: AceMeasure;
  peak: PeakMeasure;
  recovery: AceMeasure;
  bust: AceMeasure;
};

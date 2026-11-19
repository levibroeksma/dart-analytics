import { aceComparison } from "@lib/stats/ace/ace-comparison";
import { aceComparisonTiles } from "@lib/stats/ace/ace-comparison-lines";
import { loadTargetInputsOver } from "@lib/stats/doubles/doubles-training-fetch";
import { trackRowKeys } from "@lib/stats/heatmap-targets";
import {
  comparisonSection,
  periodComparison,
} from "@lib/stats/sections/comparison-section";
import type { AceComparison } from "@lib/types";

const NONE = { part: 0, whole: 0 };

const EMPTY_COMPARISON: AceComparison = {
  hit: { current: NONE, previous: null },
  drift: { direction: null, current: NONE, previous: null },
  near: { current: NONE, previous: null },
};

const fetchAceComparison = periodComparison(
  loadTargetInputsOver,
  (current, previous, gameTypeKey) =>
    aceComparison(current, previous, trackRowKeys(gameTypeKey)),
  EMPTY_COMPARISON,
);

/** Alpine scope of the Ace comparison tiles: target hit rate, drift and near miss share over the page period against the preceding period (D563). */
export function aceComparisonSection() {
  return comparisonSection(
    fetchAceComparison,
    EMPTY_COMPARISON,
    aceComparisonTiles,
  );
}

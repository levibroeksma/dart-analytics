import { aimSection } from "@lib/stats/sections/aim-section";
import { aimLabel } from "@lib/stats/x01/aim-label";
import { formatRate } from "@lib/stats/x01/format";
import { trebleCard } from "@lib/stats/x01/treble-card";
import type { AimRows, AimTableRow, TrebleCard } from "@lib/types";

/** Alpine scope of the treble accuracy card: `large-target-accuracy` reduced to its card. */
export function trebleCardSection() {
  const section = aimSection("large-target-accuracy");
  const getters = {
    get card(): TrebleCard {
      return trebleCard((this as unknown as { rows: AimRows }).rows);
    },
    get headline(): string {
      return formatRate(this.card.headline);
    },
    get caption(): string {
      return `T20 treble rate, ${this.card.darts} darts`;
    },
    get table(): AimTableRow[] {
      return this.card.rows.map((row) => ({
        label: aimLabel(row.aim),
        count: row.darts,
        cells: [row.treble, row.single, row.left, row.right, row.other].map(
          formatRate,
        ),
      }));
    },
  };
  return Object.defineProperties(
    section,
    Object.getOwnPropertyDescriptors(getters),
  ) as typeof section & typeof getters;
}

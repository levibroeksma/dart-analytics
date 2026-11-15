import { aimSection } from "@lib/stats/sections/aim-section";
import { formatRate } from "@lib/stats/x01/format";
import { doublesCard } from "@lib/stats/x01/doubles-card";
import type { AimRows, AimTableRow, DoublesCard } from "@lib/types";

/** Alpine scope of the doubles card: `double-accuracy` reduced to its card. */
export function doublesCardSection() {
  const section = aimSection("double-accuracy");
  const getters = {
    get card(): DoublesCard {
      return doublesCard((this as unknown as { rows: AimRows }).rows);
    },
    get headline(): string {
      return formatRate(this.card.headline);
    },
    get caption(): string {
      return this.card.caption ?? `Doubles, ${this.card.darts} darts`;
    },
    get table(): AimTableRow[] {
      return this.card.rows.map((row) => ({
        label: row.label,
        count: row.darts,
        cells: [
          formatRate(row.rate),
          `${row.inside}/${row.within}/${row.outside}`,
          row.sectors.join(" "),
        ],
      }));
    },
  };
  return Object.defineProperties(
    section,
    Object.getOwnPropertyDescriptors(getters),
  ) as typeof section & typeof getters;
}

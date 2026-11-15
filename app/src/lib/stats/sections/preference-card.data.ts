import { aimSection } from "@lib/stats/sections/aim-section";
import { formatRate } from "@lib/stats/x01/format";
import { preferenceCard } from "@lib/stats/x01/preference-card";
import type { AimRows, AimTableRow, PreferenceCard } from "@lib/types";

/** Alpine scope of the double preference card: `double-preference` reduced to its card. */
export function preferenceCardSection() {
  const section = aimSection("double-preference");
  const getters = {
    get card(): PreferenceCard {
      return preferenceCard((this as unknown as { rows: AimRows }).rows);
    },
    get headline(): string {
      return this.card.headline ?? "—";
    },
    get caption(): string {
      return `Doubles left, ${this.card.left} visits`;
    },
    get table(): AimTableRow[] {
      return this.card.rows.map((row) => ({
        label: row.label,
        count: row.left,
        cells: [
          String(row.splitAway),
          formatRate(row.splitRate),
          `${row.hits}/${row.attempts}`,
        ],
      }));
    },
  };
  return Object.defineProperties(
    section,
    Object.getOwnPropertyDescriptors(getters),
  ) as typeof section & typeof getters;
}

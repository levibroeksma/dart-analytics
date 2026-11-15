import { aimSection } from "@lib/stats/sections/aim-section";
import { formatRate } from "@lib/stats/x01/format";
import { setupCard } from "@lib/stats/x01/setup-card";
import type { AimRows, AimTableRow, SetupCard } from "@lib/types";

/** Alpine scope of the setup card: `setup-success` reduced to its card. */
export function setupCardSection() {
  const section = aimSection("setup-success");
  const getters = {
    get card(): SetupCard {
      return setupCard((this as unknown as { rows: AimRows }).rows);
    },
    get headline(): string {
      return formatRate(this.card.headline);
    },
    get caption(): string {
      return `Good leave ${formatRate(this.card.goodLeave)}, ${this.card.visits} visits`;
    },
    get table(): AimTableRow[] {
      return this.card.groups.map((group) => ({
        label: `${group.basis} · ${group.kind}`,
        count: group.attempts,
        cells: [formatRate(group.rate), `${group.hits}/${group.attempts}`],
      }));
    },
  };
  return Object.defineProperties(
    section,
    Object.getOwnPropertyDescriptors(getters),
  ) as typeof section & typeof getters;
}

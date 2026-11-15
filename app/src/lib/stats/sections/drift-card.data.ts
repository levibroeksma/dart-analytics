import { aimSection } from "@lib/stats/sections/aim-section";
import { driftLine } from "@lib/stats/x01/drift-line";
import { driftCard } from "@lib/stats/x01/drift-card";
import type { AimRows, DriftCard } from "@lib/types";

/** Alpine scope of the aim drift card: `aim-drift` reduced to its card. */
export function driftCardSection() {
  const section = aimSection("aim-drift");
  const getters = {
    get card(): DriftCard {
      return driftCard((this as unknown as { rows: AimRows }).rows);
    },
    get headline(): string {
      return this.card.headline ?? "—";
    },
    get caption(): string {
      return `1st dart drift, ${this.card.n} darts`;
    },
    get table() {
      const { byDart, byBasis } = this.card;
      return [
        ...byDart.map((row) => driftLine(row, `Dart ${row.dart}`)),
        ...byBasis.map((row) =>
          driftLine(row, `${row.basis} · dart ${row.dart}`),
        ),
      ];
    },
  };
  return Object.defineProperties(
    section,
    Object.getOwnPropertyDescriptors(getters),
  ) as typeof section & typeof getters;
}

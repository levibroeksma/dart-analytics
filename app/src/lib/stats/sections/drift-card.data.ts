import { aimSection } from "@lib/stats/sections/aim-section";
import { driftCard } from "@lib/stats/x01/drift-card";
import type { AimRows, DriftCard, DriftRow } from "@lib/types";

const DASH = "—";

function mm(value: number | null): string {
  return value === null ? DASH : `${value.toFixed(1)} mm`;
}

function line(row: DriftRow, label: string) {
  return {
    label,
    n: row.n,
    cells: [mm(row.meanDx), mm(row.meanDy), mm(row.spread)],
  };
}

/** Alpine scope of the aim drift card: `aim-drift` reduced to its card. */
export function driftCardSection() {
  const section = aimSection("aim-drift");
  const getters = {
    get card(): DriftCard {
      return driftCard((this as unknown as { rows: AimRows }).rows);
    },
    get headline(): string {
      return this.card.headline ?? DASH;
    },
    get caption(): string {
      return `1st dart drift, ${this.card.n} darts`;
    },
    get table() {
      const { byDart, byBasis } = this.card;
      return [
        ...byDart.map((row) => line(row, `Dart ${row.dart}`)),
        ...byBasis.map((row) => line(row, `${row.basis} · dart ${row.dart}`)),
      ];
    },
  };
  return Object.defineProperties(
    section,
    Object.getOwnPropertyDescriptors(getters),
  ) as typeof section & typeof getters;
}

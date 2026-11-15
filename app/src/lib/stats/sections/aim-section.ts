import { periodSection } from "@lib/stats/sections/period-section";
import { sumAimRows } from "@lib/stats/x01/aim-rows";
import type { AimRows, SectionId } from "@lib/types";
import type { AimCountMetrics } from "@modules/types";

type QualityHost = {
  error: string | null;
  skippedSessions: number;
  $store: {
    x01Quality: { report(id: string, skipped: number): void };
  };
};

/**
 * A 501 aim section over the page period: `periodSection` plus the summed
 * `rows` and a report of its `skippedSessions` to the `x01Quality` store once
 * a load settles. A superseded load never reports; a failed one reports 0.
 */
export function aimSection(sectionId: SectionId) {
  const base = periodSection<AimCountMetrics>(sectionId);
  let ticket = 0;
  const state = {
    ...base,
    async load(this: QualityHost, now?: Date): Promise<void> {
      const mine = ++ticket;
      await base.load.call(this as never, now);
      if (mine !== ticket) return;
      this.$store.x01Quality.report(
        sectionId,
        this.error === null ? this.skippedSessions : 0,
      );
    },
  };
  const getters = {
    get rows(): AimRows {
      return sumAimRows((this as unknown as typeof base).buckets);
    },
  };
  return Object.defineProperties(
    state,
    Object.getOwnPropertyDescriptors(getters),
  ) as typeof state & typeof getters;
}

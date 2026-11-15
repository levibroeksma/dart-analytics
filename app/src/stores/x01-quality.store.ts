/**
 * The 501 statistics page's data-quality figure: the largest `skippedSessions`
 * any loaded aim section reported. The sections' skip sets overlap, so the
 * maximum, not the sum, is the honest count.
 */
export function x01QualityStore() {
  return {
    reports: {} as Record<string, number>,

    get skipped(): number {
      return Math.max(0, ...Object.values(this.reports));
    },

    report(id: string, skipped: number): void {
      this.reports = { ...this.reports, [id]: skipped };
    },

    clear(): void {
      this.reports = {};
    },
  };
}

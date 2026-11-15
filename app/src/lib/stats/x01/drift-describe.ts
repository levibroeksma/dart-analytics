function words(mm: number, negative: string, positive: string): string | null {
  const rounded = Math.round(Math.abs(mm));
  return rounded === 0 ? null : `${rounded} mm ${mm < 0 ? negative : positive}`;
}

/** "4 mm left, 2 mm low"; an axis that rounds to zero is omitted, both zero reads "on target". Board y grows downward, so positive dy is low. */
export function describeDrift(meanDx: number, meanDy: number): string {
  const parts = [words(meanDx, "left", "right"), words(meanDy, "high", "low")];
  return parts.filter(Boolean).join(", ") || "on target";
}

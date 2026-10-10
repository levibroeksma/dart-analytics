const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Formats how long ago a session started as an uppercase mono label.
 * Future or same-minute start times read as "JUST NOW".
 *
 * @param startedAt - ISO 8601 timestamp of the session start.
 * @param now - Reference instant the elapsed time is measured against.
 * @returns A label such as "JUST NOW", "18 MIN AGO", "1 H AGO", "YESTERDAY" or "2 D AGO".
 */
export function startedAgo(startedAt: string, now: Date): string {
  const startedMs = new Date(startedAt).getTime();
  if (Number.isNaN(startedMs)) return "JUST NOW";
  const elapsed = Math.max(0, now.getTime() - startedMs);
  if (elapsed < MINUTE_MS) return "JUST NOW";
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)} MIN AGO`;
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)} H AGO`;
  const days = Math.floor(elapsed / DAY_MS);
  if (days === 1) return "YESTERDAY";
  return `${days} D AGO`;
}

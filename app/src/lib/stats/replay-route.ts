const SESSION_PARAM = "session";

/** The session id the replay page was opened for (`?session=<id>`), or null. */
export function replaySessionIdFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const value = new URL(window.location.href).searchParams.get(SESSION_PARAM);
  return value && value.trim().length > 0 ? value : null;
}

/** A session's replay page (D371 decision 9): a prerendered shell that reads the id client-side. */
export function replayPath(sessionId: string): string {
  return `/statistics/replay?${SESSION_PARAM}=${encodeURIComponent(sessionId)}`;
}

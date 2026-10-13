import { fetchActiveSessions } from "@client/api/sessions";
import type { ActiveSessionsStore } from "@lib/types";

/**
 * The player's active sessions, shared by every scope on the page that lists
 * them (`/games`' card visibility and the resume deck). Nothing loads until a
 * scope calls `load()`; every later or concurrent call awaits the same fetch,
 * so a page fetches at most once. A failed fetch leaves `sessions` empty and
 * sets `failed`; each consumer picks its own fallback.
 */
export function activeSessionsStore() {
  let pending: Promise<void> | null = null;
  return {
    sessions: [] as ActiveSessionsStore["sessions"],
    loaded: false,
    failed: false,

    load(this: ActiveSessionsStore): Promise<void> {
      pending ??= fetchActiveSessions()
        .then(
          (sessions) => {
            this.sessions = sessions;
          },
          () => {
            this.sessions = [];
            this.failed = true;
          },
        )
        .finally(() => {
          this.loaded = true;
        });
      return pending;
    },
  };
}

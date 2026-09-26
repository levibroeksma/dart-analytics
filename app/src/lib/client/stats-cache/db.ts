export const STATS_DB_NAME = "dart-stats";
export const STATS_SCHEMA_VERSION = 1;

const STORES = ["sectionResults", "coverage", "sessionLists", "meta"] as const;

/**
 * Opens the statistics cache database, wiping and recreating every store on
 * a version bump (`10-Statistics/00-Overview.md` §7: "schema bump wipes all
 * stores"). `replayPages` and `facts` join `STORES` in their own phases,
 * each bumping `STATS_SCHEMA_VERSION`.
 *
 * Returns `null` when IndexedDB is missing or the open fails for any reason
 * (private browsing, quota, a blocked upgrade) — every caller degrades to
 * network-only rather than throwing.
 */
export async function openStatsDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    return await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(STATS_DB_NAME, STATS_SCHEMA_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of Array.from(db.objectStoreNames)) {
          db.deleteObjectStore(name);
        }
        for (const store of STORES) db.createObjectStore(store);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("stats db upgrade blocked"));
    });
  } catch {
    return null;
  }
}

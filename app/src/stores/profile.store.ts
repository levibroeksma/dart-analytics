import { fetchProfile, saveProfile } from "@client/api/profile";

/**
 * The player's display name and darts equipment. Empty/null until a load
 * succeeds, so a failed or slow call leaves the form blank rather than
 * showing a stale or wrong value.
 *
 * Registered through `Alpine.store("profile", profileStore())`, so Alpine
 * calls `init()` once its interceptors resolve — that is the sanctioned
 * hydration hook, `x-init` being forbidden repo-wide.
 */
export function profileStore() {
  return {
    displayName: "",
    dartsDescription: null as string | null,
    dartsWeightGrams: null as number | null,
    loading: false,
    error: null as string | null,

    async init() {
      await this.load();
    },

    async load() {
      this.loading = true;
      this.error = null;
      try {
        const profile = await fetchProfile();
        this.displayName = profile.displayName;
        this.dartsDescription = profile.dartsDescription;
        this.dartsWeightGrams = profile.dartsWeightGrams;
      } catch (cause) {
        this.error = cause instanceof Error ? cause.message : "load failed";
      } finally {
        this.loading = false;
      }
    },

    async save() {
      this.loading = true;
      this.error = null;
      try {
        const profile = await saveProfile({
          displayName: this.displayName,
          dartsDescription: this.dartsDescription,
          dartsWeightGrams: this.dartsWeightGrams,
        });
        this.displayName = profile.displayName;
        this.dartsDescription = profile.dartsDescription;
        this.dartsWeightGrams = profile.dartsWeightGrams;
      } catch (cause) {
        this.error = cause instanceof Error ? cause.message : "save failed";
      } finally {
        this.loading = false;
      }
    },
  };
}

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

    /**
     * Weight as shown in view mode (`23 g`), or `""` when unset. A cleared
     * or non-numeric field leaves `x-model.number` holding a string, which
     * must read as unset rather than `" g"`.
     */
    get weightLabel(): string {
      const grams: unknown = this.dartsWeightGrams;
      return typeof grams === "number" ? `${grams} g` : "";
    },

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

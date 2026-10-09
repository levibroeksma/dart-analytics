import { fetchProfile, saveProfile } from "@client/api/profile";

/**
 * A free-text optional field as the API expects it: blank or whitespace
 * reads as unset (`null`), since the contract rejects `""`.
 */
function optionalText(value: string | null): string | null {
  return value === null || value.trim() === "" ? null : value;
}

/**
 * Weight as the API expects it. `x-model.number` leaves a cleared field as
 * `""` (unset, `null`) and non-numeric input as a string; anything that is
 * not a whole number 1–100 returns `undefined` so the save is refused
 * before the request.
 */
function optionalWeight(value: unknown): number | null | undefined {
  if (value === null || (typeof value === "string" && value.trim() === "")) {
    return null;
  }
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 100
    ? value
    : undefined;
}

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
    /**
     * `true` once the first load settles, success or failure. Drives the
     * skeleton: `loading` also flips during saves, which must not blank the UI.
     */
    loaded: false,
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
        this.loaded = true;
      }
    },

    async save() {
      const dartsWeightGrams = optionalWeight(this.dartsWeightGrams);
      if (dartsWeightGrams === undefined) {
        this.error = "Weight must be a whole number from 1 to 100";
        return;
      }
      this.loading = true;
      this.error = null;
      try {
        const profile = await saveProfile({
          displayName: this.displayName,
          dartsDescription: optionalText(this.dartsDescription),
          dartsWeightGrams,
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

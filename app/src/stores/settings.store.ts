import { fetchSettings, saveSettings } from "@client/api/settings";

/**
 * The player's app mode. Defaults to quick score until a load succeeds, so a
 * failed or slow settings call leaves every game visible rather than hiding
 * the whole games page behind a network error.
 */
export function settingsStore() {
  return {
    captureModeKey: "RECREATIONAL",
    inputModeKey: "QUICK_SCORE",
    loading: false,
    error: null as string | null,

    async load() {
      this.loading = true;
      this.error = null;
      try {
        const settings = await fetchSettings();
        this.captureModeKey = settings.defaultCaptureModeKey;
        this.inputModeKey = settings.defaultInputModeKey;
      } catch (cause) {
        this.error = cause instanceof Error ? cause.message : "load failed";
      } finally {
        this.loading = false;
      }
    },

    async save(captureModeKey: string, inputModeKey: string) {
      this.loading = true;
      this.error = null;
      try {
        const settings = await saveSettings({
          defaultCaptureModeKey: captureModeKey,
          defaultInputModeKey: inputModeKey,
        });
        this.captureModeKey = settings.defaultCaptureModeKey;
        this.inputModeKey = settings.defaultInputModeKey;
      } catch (cause) {
        this.error = cause instanceof Error ? cause.message : "save failed";
      } finally {
        this.loading = false;
      }
    },
  };
}

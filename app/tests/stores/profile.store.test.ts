import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchProfile = vi.fn();
const saveProfile = vi.fn();

vi.mock("@client/api/profile", () => ({
  fetchProfile: () => fetchProfile(),
  saveProfile: (next: unknown) => saveProfile(next),
}));

const { profileStore } = await import("@stores/profile.store");

beforeEach(() => {
  fetchProfile.mockReset();
  saveProfile.mockReset();
});

describe("profileStore", () => {
  it("loads the stored profile", async () => {
    fetchProfile.mockResolvedValue({
      displayName: "The Power",
      dartsDescription: "Winmau Pro-Series 23g",
      dartsWeightGrams: 23,
    });

    const store = profileStore();
    await store.load();

    expect(store.displayName).toBe("The Power");
    expect(store.dartsDescription).toBe("Winmau Pro-Series 23g");
    expect(store.dartsWeightGrams).toBe(23);
    expect(store.loading).toBe(false);
  });

  it("loads on init so a registered store hydrates without x-init", async () => {
    fetchProfile.mockResolvedValue({
      displayName: "The Power",
      dartsDescription: null,
      dartsWeightGrams: null,
    });

    const store = profileStore();
    await store.init();

    expect(fetchProfile).toHaveBeenCalledTimes(1);
    expect(store.displayName).toBe("The Power");
  });

  it("keeps the previous values when the load fails", async () => {
    fetchProfile.mockRejectedValue(new Error("offline"));

    const store = profileStore();
    await store.load();

    expect(store.displayName).toBe("");
    expect(store.error).not.toBeNull();
  });

  it("is loaded once the first load settles, success or failure", async () => {
    fetchProfile.mockResolvedValue({
      displayName: "The Power",
      dartsDescription: null,
      dartsWeightGrams: null,
    });
    const ok = profileStore();
    expect(ok.loaded).toBe(false);
    await ok.load();
    expect(ok.loaded).toBe(true);

    fetchProfile.mockRejectedValue(new Error("offline"));
    const failed = profileStore();
    await failed.load();
    expect(failed.loaded).toBe(true);
  });

  it("does not mark itself loaded from a save alone", async () => {
    saveProfile.mockResolvedValue({
      displayName: "Levi",
      dartsDescription: null,
      dartsWeightGrams: null,
    });
    const store = profileStore();
    store.displayName = "Levi";
    await store.save();

    expect(store.loaded).toBe(false);
  });

  it("saves the current fields and adopts the stored result", async () => {
    saveProfile.mockResolvedValue({
      displayName: "Levi",
      dartsDescription: "Target Agora 23g",
      dartsWeightGrams: 23,
    });

    const store = profileStore();
    store.displayName = "Levi";
    store.dartsDescription = "Target Agora 23g";
    store.dartsWeightGrams = 23;
    await store.save();

    expect(saveProfile).toHaveBeenCalledWith({
      displayName: "Levi",
      dartsDescription: "Target Agora 23g",
      dartsWeightGrams: 23,
    });
    expect(store.displayName).toBe("Levi");
  });

  it("leaves the previous values in place when the save fails", async () => {
    saveProfile.mockRejectedValue(new Error("rejected"));

    const store = profileStore();
    store.displayName = "Levi";
    await store.save();

    expect(store.displayName).toBe("Levi");
    expect(store.error).not.toBeNull();
  });

  describe("save normalisation", () => {
    const stored = {
      displayName: "Levi",
      dartsDescription: null,
      dartsWeightGrams: null,
    };

    it("sends a cleared or blank darts description as null", async () => {
      for (const value of ["", "   "]) {
        saveProfile.mockReset();
        saveProfile.mockResolvedValue(stored);
        const store = profileStore();
        store.displayName = "Levi";
        store.dartsDescription = value;
        await store.save();

        expect(saveProfile).toHaveBeenCalledWith(stored);
        expect(store.dartsDescription).toBeNull();
        expect(store.error).toBeNull();
      }
    });

    it("sends a cleared weight as null", async () => {
      saveProfile.mockResolvedValue(stored);
      const store = profileStore();
      store.displayName = "Levi";
      (store as { dartsWeightGrams: unknown }).dartsWeightGrams = "";
      await store.save();

      expect(saveProfile).toHaveBeenCalledWith(stored);
      expect(store.dartsWeightGrams).toBeNull();
    });

    it("rejects non-numeric or out-of-range weight without calling the API", async () => {
      for (const value of ["abc", "23.5", 0, 101, 23.5]) {
        saveProfile.mockReset();
        const store = profileStore();
        store.displayName = "Levi";
        (store as { dartsWeightGrams: unknown }).dartsWeightGrams = value;
        await store.save();

        expect(saveProfile).not.toHaveBeenCalled();
        expect(store.error).not.toBeNull();
        expect(store.loading).toBe(false);
      }
    });
  });

  describe("weightLabel", () => {
    it("shows grams for a number", () => {
      const store = profileStore();
      store.dartsWeightGrams = 23;
      expect(store.weightLabel).toBe("23 g");
    });

    it("is empty for null, a cleared field or non-numeric input", () => {
      const store = profileStore();
      expect(store.weightLabel).toBe("");
      for (const value of ["", "abc"]) {
        (store as { dartsWeightGrams: unknown }).dartsWeightGrams = value;
        expect(store.weightLabel).toBe("");
      }
    });
  });
});

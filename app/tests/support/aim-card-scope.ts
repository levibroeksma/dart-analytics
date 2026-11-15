import { x01QualityStore } from "@stores/x01-quality.store";

/** An aim-card factory wired to a fake Alpine scope on the 501 page, with its section loaded. */
export async function loadedAimCard<T extends { load(): Promise<void> }>(
  factory: () => T,
) {
  const scope = Object.assign(factory(), {
    $data: { rangeKey: "30d", game: "501_V1", variation: 501 },
    $watch: () => {},
    $store: { x01Quality: x01QualityStore() },
  });
  await scope.load();
  return scope;
}

/** A `load-game-section` mock result holding one bucket of `metrics`. */
export function oneBucket(metrics: Record<string, Record<string, number>>) {
  return {
    buckets: [{ start: "a", end: "b", closed: true, sampleSize: 1, metrics }],
  };
}

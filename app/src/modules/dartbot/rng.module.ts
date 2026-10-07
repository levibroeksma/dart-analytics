import { seededUniform } from "@modules/game/seeded-rng.module";
import type { DartRng } from "./interfaces";

export function createDartRng(seed: number, dartIndex: number): DartRng {
  const next = seededUniform(seed, dartIndex);
  return {
    uniform: () => next(),
    gaussianPair: () => {
      const u1 = Math.max(next(), Number.EPSILON);
      const u2 = next();
      const radius = Math.sqrt(-2 * Math.log(u1));
      const angle = 2 * Math.PI * u2;
      return [radius * Math.cos(angle), radius * Math.sin(angle)];
    },
  };
}

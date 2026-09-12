export function routineStart(playPath: string) {
  return {
    starting: false,
    start(this: { starting: boolean }) {
      this.starting = true;
      globalThis.location.href = playPath;
    },
  };
}

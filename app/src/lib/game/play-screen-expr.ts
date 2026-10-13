/**
 * Alpine expression builders for `SeatedPlayScreen` (#915). A game writes
 * each play-screen value once as an `Expr`; the shell calls it with the solo
 * call (`fn()`) and with each seat's call
 * (`fnFor(state()?.seats[i]?.participantRef)`), matching the play factories'
 * `x()` / `xFor(ref)` accessor pairs.
 */
import type { Call } from "./interfaces";

export function seatRef(index: 0 | 1): string {
  return `state()?.seats[${index}]?.participantRef`;
}

export function soloCall(): Call {
  return Object.assign((fn: string) => `${fn}()`, { solo: true });
}

export function seatCall(index: 0 | 1): Call {
  return Object.assign((fn: string) => `${fn}For(${seatRef(index)})`, {
    solo: false,
  });
}

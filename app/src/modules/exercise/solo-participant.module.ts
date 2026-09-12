/**
 * The one participant every solo exercise session's `turns` log under.
 * Training routines have no seat or opponent concept, unlike a `GameEngine`
 * session (09-training-routines.md §3-4), so there is nothing to derive this
 * from — it is a fixed constant, not a configured seat.
 */
export const SOLO_PARTICIPANT_REF = "solo";

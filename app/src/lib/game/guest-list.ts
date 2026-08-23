import type { GuestListContext } from "./types";

/**
 * Adds the guest currently typed into the add-guest modal, then closes it.
 *
 * Refuses silently when a guest is already seated (V1 caps a session at one
 * guest, so the second seat is the only one to fill) or when the typed name
 * is blank once trimmed — a blank name would seat an unnamed opponent no
 * scoreboard could label. Neither case is an error the player needs telling
 * about: the modal's own button is what they pressed, and the list in front
 * of them already shows why nothing happened.
 * @returns whether a guest was actually added, so a caller with a follow-up
 *   of its own (Score Training and TUOD force ROUNDS once a session is
 *   guested) runs it only when the list really changed.
 */
export function addTypedGuest(context: GuestListContext): boolean {
  if (context.guests.length >= 1) return false;
  const name = context.newGuestName.trim();
  if (!name) return false;

  context.guests.push({ displayName: name });
  context.newGuestName = "";
  context.showAddGuestModal = false;
  return true;
}

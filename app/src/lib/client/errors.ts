import type { ErrorCode } from '@client/api/types';
import { ProvisionError } from './api/players';

/** Maps ProvisionError's registry-backed codes to account-setup copy. */
const PROVISION_MESSAGES: Partial<Record<ErrorCode, string>> = {
  UNAUTHORIZED: 'Account setup failed. Contact support.',
  PLAYER_NOT_PROVISIONED: 'Account setup failed. Contact support.',
};
const SIGN_IN_INVALID_CREDENTIALS = 'Email or password is incorrect.';
const FALLBACK = 'Could not reach the server. Try again.';

/**
 * Maps an error caught during login/provisioning to user-facing copy.
 * Two distinct surfaces are handled: our own API's registry-backed
 * ProvisionError codes (code-keyed lookup), and the third-party Neon Auth
 * SDK's message-only errors (heuristic pattern match) — never conflated,
 * since the same code/pattern means different things on each surface.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof ProvisionError) {
    return PROVISION_MESSAGES[err.code as ErrorCode] ?? err.message;
  }
  if (err instanceof Error && /invalid|credential/i.test(err.message)) {
    return SIGN_IN_INVALID_CREDENTIALS;
  }
  return FALLBACK;
}

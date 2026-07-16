import type { ErrorCode } from '@client/api/types';
import { ProvisionError } from './api/players';

const MESSAGES: Partial<Record<ErrorCode, string>> = {
  UNAUTHORIZED: 'Email or password is incorrect.',
  PLAYER_NOT_PROVISIONED: 'Account setup failed. Contact support.',
};
const FALLBACK = 'Could not reach the server. Try again.';

export function getErrorMessage(err: unknown): string {
  if (err instanceof ProvisionError) {
    return (MESSAGES as Record<string, string>)[err.code] ?? err.message;
  }
  if (err instanceof Error && /invalid|credential/i.test(err.message)) {
    return MESSAGES.UNAUTHORIZED!;
  }
  return FALLBACK;
}

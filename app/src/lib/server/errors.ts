/** Domain error registry — frozen v1 (docs/architecture/06-API/03-Shared-Conventions.md). */
export const ERROR_HTTP = {
  UNAUTHORIZED: {
    status: 401,
    message: "Authentication required",
    retryable: false,
  },
  PLAYER_NOT_PROVISIONED: {
    status: 403,
    message: "Player profile not provisioned",
    retryable: false,
  },
  SESSION_OWNERSHIP_MISMATCH: {
    status: 403,
    message: "Session does not belong to the authenticated player",
    retryable: false,
  },
  SESSION_ALREADY_COMPLETED: {
    status: 409,
    message: "Session is already completed",
    retryable: false,
  },
  SESSION_ALREADY_ACTIVE: {
    status: 409,
    message: "An active session already exists for this game type",
    retryable: false,
  },
  IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD: {
    status: 409,
    message: "Idempotency key reused with a different payload",
    retryable: false,
  },
  BATCH_INCONSISTENT_ORDERING: {
    status: 422,
    message: "Batch event ordering is inconsistent",
    retryable: false,
  },
  BATCH_REFERENCE_MISSING: {
    status: 422,
    message: "Batch payload references a missing element",
    retryable: false,
  },
  NOT_FOUND: { status: 404, message: "Resource not found", retryable: false },
  VALIDATION_FAILED: {
    status: 422,
    message: "Request validation failed",
    retryable: false,
  },
  INVALID_STATUS_TRANSITION: {
    status: 409,
    message: "Invalid session status transition",
    retryable: false,
  },
  SERVICE_UNAVAILABLE: {
    status: 503,
    message: "Service temporarily unavailable",
    retryable: true,
  },
  INTERNAL_ERROR: { status: 500, message: "Internal error", retryable: false },
} as const;

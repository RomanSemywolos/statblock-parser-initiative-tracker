/**
 * Compute a task-derived completion ceiling for BODY starts-only normalization.
 *
 * A BODY model can return at most one {s:address} object per legal BODY start.
 * Build the largest compact legal JSON payload and budget two ASCII-token slots per
 * character plus a small envelope margin. The address type is intentionally generic:
 * the recovered mixed path uses exact Cxxx strings, while the still-supported legacy
 * singleline path uses numeric candidate indexes.
 *
 * This is a transport budget only. It does not rank, prune, add, or remove candidate
 * starts and therefore must not change BODY semantics.
 */
export function bodyStartsCompletionBudget(allowedStarts: readonly (string | number)[]): number {
  const maximalCompactPayload = JSON.stringify({
    starts: allowedStarts.map((s) => ({ s })),
  });
  return Math.max(128, maximalCompactPayload.length * 2 + 64);
}

export function applyCallerCompletionLimit(taskBudget: number, requestedLimit?: number): number {
  if (requestedLimit === undefined) return taskBudget;
  return Math.min(taskBudget, Math.max(1, Math.floor(requestedLimit)));
}

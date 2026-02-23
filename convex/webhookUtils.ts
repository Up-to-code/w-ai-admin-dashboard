export type WebhookChange = { field?: string; value?: any; entryId?: string };

export function extractWebhookChanges(body: any): WebhookChange[] {
  const entries = Array.isArray(body?.entry) ? body.entry : [];
  const changes: WebhookChange[] = [];
  for (const entry of entries) {
    const entryId = typeof entry?.id === "string" ? entry.id : undefined;
    const entryChanges = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of entryChanges) {
      changes.push({ field: change?.field, value: change?.value, entryId });
    }
  }
  return changes;
}

export function resolvePhoneNumberCandidate(
  incomingPhoneNumberId?: string | null,
  defaultPhoneNumberId?: string | null,
  firstAvailablePhoneNumberId?: string | null
): { phoneNumberId?: string; usedFallback: boolean } {
  const incoming = incomingPhoneNumberId?.trim();
  if (incoming) {
    return { phoneNumberId: incoming, usedFallback: false };
  }
  const fallback = defaultPhoneNumberId?.trim();
  if (fallback) {
    return { phoneNumberId: fallback, usedFallback: true };
  }
  const first = firstAvailablePhoneNumberId?.trim();
  if (first) {
    return { phoneNumberId: first, usedFallback: true };
  }
  return { phoneNumberId: undefined, usedFallback: true };
}

const TEMPLATE_SYNC_TTL_MS = 5 * 60 * 1000;

const scopedTemplateSyncCache = new Map<string, number>();

export function shouldSyncScopedTemplates(
  phoneNumberId: string,
  now: number = Date.now(),
  ttlMs: number = TEMPLATE_SYNC_TTL_MS
): boolean {
  const lastSync = scopedTemplateSyncCache.get(phoneNumberId);
  if (!lastSync) return true;
  return now - lastSync >= ttlMs;
}

export function markScopedTemplatesSynced(phoneNumberId: string, at: number = Date.now()): void {
  scopedTemplateSyncCache.set(phoneNumberId, at);
}

export function getScopedTemplateSyncTtlMs(): number {
  return TEMPLATE_SYNC_TTL_MS;
}

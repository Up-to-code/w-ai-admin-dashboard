import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

function normalizeAppId(appId: string | undefined): string | undefined {
  const trimmed = appId?.trim();
  if (!trimmed) return undefined;
  // Some users paste App ID with a leading "+" from phone-like formatting.
  const normalized = trimmed.replace(/^\+/, "");
  if (!/^\d+$/.test(normalized)) {
    console.warn(`[webhookSettings.set] App ID has unexpected format: "${trimmed}"`);
  }
  return normalized;
}

/** Internal: get only accessToken for getWhatsAppConfig fallback. */
export const getForConfig = internalQuery({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db.query("webhook_settings").first();
    if (!row) return null;
    return {
      accessToken: row.accessToken?.trim() ? row.accessToken : null,
      defaultPhoneNumberId: row.defaultPhoneNumberId ?? null,
    };
  },
});

/** Get webhook settings (singleton: first row). Verify token, access token, app ID from DB instead of env. */
export const get = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db.query("webhook_settings").first();
    return row
      ? {
          verifyToken: row.verifyToken ?? null,
          accessToken: row.accessToken ?? null,
          appId: row.appId ?? null,
          defaultPhoneNumberId: row.defaultPhoneNumberId ?? null,
          updatedAt: row.updatedAt,
        }
      : { verifyToken: null, accessToken: null, appId: null, defaultPhoneNumberId: null, updatedAt: 0 };
  },
});

/** Set webhook settings (verify token, access token, optional Meta App ID). Creates or updates singleton row. */
export const set = mutation({
  args: {
    verifyToken: v.optional(v.string()),
    accessToken: v.optional(v.string()),
    appId: v.optional(v.string()),
    defaultPhoneNumberId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db.query("webhook_settings").first();
    const patch: Record<string, unknown> = { updatedAt: now };
    if (args.verifyToken !== undefined) patch.verifyToken = args.verifyToken?.trim() || undefined;
    if (args.accessToken !== undefined) patch.accessToken = args.accessToken?.trim() || undefined;
    if (args.appId !== undefined) patch.appId = normalizeAppId(args.appId);
    if (args.defaultPhoneNumberId !== undefined) patch.defaultPhoneNumberId = args.defaultPhoneNumberId?.trim() || undefined;
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert("webhook_settings", {
      verifyToken: args.verifyToken?.trim() || undefined,
      accessToken: args.accessToken?.trim() || undefined,
      appId: normalizeAppId(args.appId),
      defaultPhoneNumberId: args.defaultPhoneNumberId?.trim() || undefined,
      updatedAt: now,
    });
  },
});

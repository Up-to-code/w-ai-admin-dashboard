import { query, mutation, internalQuery, internalMutation, action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { buildMetaSyncPlan, normalizeNumericId } from "./metaNumbersSync";

const SEED_PLACEHOLDER = "from_env";
const UNKNOWN_WABA_PLACEHOLDER = "unknown_waba";

function normalizeOptionalText(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("whatsapp_numbers").collect();
  },
});

export const add = mutation({
  args: {
    businessAccountId: v.string(),
    businessNumberId: v.string(),
    phone: v.string(),
    name: v.string(),
    accessToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedBusinessNumberId = normalizeNumericId(args.businessNumberId);
    if (!normalizedBusinessNumberId) {
      throw new Error("Business Number ID is required.");
    }
    const existing = await ctx.db
      .query("whatsapp_numbers")
      .withIndex("by_business_number_id", (q) =>
        q.eq("businessNumberId", normalizedBusinessNumberId)
      )
      .first();
    if (existing) {
      throw new Error("A number with this Business Number ID already exists.");
    }
    const id = await ctx.db.insert("whatsapp_numbers", {
      businessAccountId: args.businessAccountId,
      businessNumberId: normalizedBusinessNumberId,
      phone: args.phone,
      name: args.name,
      accessToken: args.accessToken,
      tokenStatus: args.accessToken?.trim() ? "connected" : undefined,
      lastAuthErrorCode: undefined,
      lastAuthErrorMessage: undefined,
      lastAuthErrorAt: undefined,
      createdAt: Date.now(),
    });
    await ctx.runMutation(api.agents.ensureForPhoneNumber, {
      phoneNumberId: normalizedBusinessNumberId,
    });
    return id;
  },
});

export const markAuthFailure = internalMutation({
  args: {
    businessNumberId: v.string(),
    code: v.number(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("whatsapp_numbers")
      .withIndex("by_business_number_id", (q) => q.eq("businessNumberId", args.businessNumberId))
      .first();
    if (!row) return { updated: false as const };
    await ctx.db.patch(row._id, {
      tokenStatus: "auth_failed",
      lastAuthErrorCode: args.code,
      lastAuthErrorMessage: args.message,
      lastAuthErrorAt: Date.now(),
    });
    return { updated: true as const };
  },
});

export const markAuthHealthy = internalMutation({
  args: {
    businessNumberId: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("whatsapp_numbers")
      .withIndex("by_business_number_id", (q) => q.eq("businessNumberId", args.businessNumberId))
      .first();
    if (!row) return { updated: false as const };
    await ctx.db.patch(row._id, {
      tokenStatus: row.accessToken?.trim() ? "connected" : undefined,
      lastAuthErrorCode: undefined,
      lastAuthErrorMessage: undefined,
      lastAuthErrorAt: undefined,
    });
    return { updated: true as const };
  },
});

export const getByBusinessNumberId = internalQuery({
  args: { businessNumberId: v.string() },
  handler: async (ctx, args) => {
    const normalizedInput = normalizeNumericId(args.businessNumberId);
    if (!normalizedInput) return null;

    const exact = await ctx.db
      .query("whatsapp_numbers")
      .withIndex("by_business_number_id", (q) =>
        q.eq("businessNumberId", normalizedInput)
      )
      .first();
    if (exact) return exact;

    // Backward compatibility for older rows that may contain unnormalized values.
    const all = await ctx.db.query("whatsapp_numbers").collect();
    return all.find((row) => normalizeNumericId(row.businessNumberId) === normalizedInput) ?? null;
  },
});

/**
 * Ensures webhook-discovered numbers are visible in the dashboard even before manual setup.
 * This lets teams switch workspaces immediately, then add per-number access tokens afterward.
 */
export const upsertFromWebhookMetadata = internalMutation({
  args: {
    businessNumberId: v.string(),
    displayPhoneNumber: v.optional(v.string()),
    verifiedName: v.optional(v.string()),
    businessAccountId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedBusinessNumberId = normalizeNumericId(args.businessNumberId);
    if (!normalizedBusinessNumberId) return null;

    const existing = await ctx.db
      .query("whatsapp_numbers")
      .withIndex("by_business_number_id", (q) =>
        q.eq("businessNumberId", normalizedBusinessNumberId)
      )
      .first();

    const displayPhone = normalizeOptionalText(args.displayPhoneNumber) ?? `+${normalizedBusinessNumberId}`;
    const verifiedName = normalizeOptionalText(args.verifiedName) ?? `WhatsApp ${normalizedBusinessNumberId.slice(-4)}`;
    const businessAccountId =
      normalizeNumericId(args.businessAccountId) || existing?.businessAccountId || UNKNOWN_WABA_PLACEHOLDER;

    if (existing) {
      const patch: {
        phone?: string;
        name?: string;
        businessAccountId?: string;
      } = {};
      if (displayPhone && displayPhone !== existing.phone) patch.phone = displayPhone;
      if (verifiedName && verifiedName !== existing.name) patch.name = verifiedName;
      if (businessAccountId && businessAccountId !== existing.businessAccountId) {
        patch.businessAccountId = businessAccountId;
      }
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existing._id, patch);
      }
      return existing._id;
    }

    const id = await ctx.db.insert("whatsapp_numbers", {
      businessAccountId,
      businessNumberId: normalizedBusinessNumberId,
      phone: displayPhone,
      name: verifiedName,
      createdAt: Date.now(),
    });
    await ctx.runMutation(api.agents.ensureForPhoneNumber, {
      phoneNumberId: normalizedBusinessNumberId,
    });
    return id;
  },
});

/** First number that has an access token (for default config when no phoneNumberId is provided). Deterministic: sorted by createdAt. */
export const getFirstWithToken = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("whatsapp_numbers").collect();
    const sorted = [...all].sort(
      (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)
    );
    return sorted.find((n) => n.accessToken?.trim()) ?? null;
  },
});

export const update = mutation({
  args: {
    id: v.id("whatsapp_numbers"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    businessAccountId: v.optional(v.string()),
    accessToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const filtered: Record<string, unknown> = {};
    if (updates.name !== undefined) filtered.name = updates.name;
    if (updates.phone !== undefined) filtered.phone = updates.phone;
    if (updates.businessAccountId !== undefined) {
      const waba = updates.businessAccountId?.trim();
      filtered.businessAccountId = waba && waba.length > 0 ? waba : undefined;
    }
    if (updates.accessToken !== undefined) {
      const t = updates.accessToken?.trim();
      filtered.accessToken = t && t.length > 0 ? t : undefined;
      filtered.tokenStatus = t && t.length > 0 ? "connected" : undefined;
      filtered.lastAuthErrorCode = undefined;
      filtered.lastAuthErrorMessage = undefined;
      filtered.lastAuthErrorAt = undefined;
    }
    if (Object.keys(filtered).length === 0) return id;
    await ctx.db.patch(id, filtered);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("whatsapp_numbers") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    await ctx.db.delete(args.id);
    if (row?.businessNumberId) {
      const config = await ctx.db
        .query("ai_configs")
        .withIndex("by_phone_number_id", (q) => q.eq("phoneNumberId", row.businessNumberId))
        .first();
      if (config) await ctx.db.delete(config._id);
    }
    return args.id;
  },
});

/** One-time seed: if no numbers exist, insert one from env (WHATSAPP_PHONE_ID, WHATSAPP_WABA_ID). Run from Convex dashboard if needed. */
export const seedFromEnv = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("whatsapp_numbers").first();
    if (existing) return { seeded: false, message: "Numbers already exist." };
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    const wabaId = process.env.WHATSAPP_WABA_ID ?? SEED_PLACEHOLDER;
    if (!phoneId) {
      throw new Error("WHATSAPP_PHONE_ID not set. Add at least one number via the Integrations page.");
    }
    await ctx.db.insert("whatsapp_numbers", {
      businessAccountId: wabaId,
      businessNumberId: phoneId,
      phone: phoneId,
      name: "رقم واتساب الرئيسي",
      createdAt: Date.now(),
    });
    await ctx.runMutation(api.agents.ensureForPhoneNumber, {
      phoneNumberId: phoneId,
    });
    return { seeded: true, message: "Seeded one number from env." };
  },
});

type MetaPhoneNumber = {
  id: string;
  display_phone_number?: string | null;
  verified_name?: string | null;
};

type WhatsAppNumberRow = {
  _id: Id<"whatsapp_numbers">;
  businessAccountId: string;
  businessNumberId: string;
  phone: string;
  name: string;
  accessToken?: string;
};

function normalizeToken(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

async function withAppSecretProof(
  ctx: { runAction: (...args: any[]) => Promise<any> },
  url: URL,
  accessToken: string
): Promise<URL> {
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
  if (!appSecret) return url;
  const proof = (await ctx.runAction(internal.nodeUtils.createAppSecretProof, {
    accessToken,
    appSecret,
  })) as string;
  const next = new URL(url.toString());
  next.searchParams.set("appsecret_proof", proof);
  return next;
}

async function fetchWabaPhoneNumbers(
  ctx: { runAction: (...args: any[]) => Promise<any> },
  wabaId: string,
  accessToken: string
): Promise<MetaPhoneNumber[]> {
  const base = new URL(`https://graph.facebook.com/v21.0/${wabaId}/phone_numbers`);
  base.searchParams.set("fields", "id,display_phone_number,verified_name");
  base.searchParams.set("limit", "100");

  let url: URL | null = await withAppSecretProof(ctx, base, accessToken);
  const all: MetaPhoneNumber[] = [];

  while (url) {
    const response: globalThis.Response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errorMessage =
        typeof body === "object" &&
        body &&
        "error" in body &&
        typeof body.error === "object" &&
        body.error &&
        "message" in body.error
          ? String(body.error.message)
          : `HTTP ${response.status}`;
      throw new Error(`Meta phone_numbers fetch failed for WABA ${wabaId}: ${errorMessage}`);
    }

    const rows =
      typeof body === "object" &&
      body &&
      "data" in body &&
      Array.isArray(body.data)
        ? body.data
        : [];

    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const rec = row as {
        id?: string | number;
        display_phone_number?: string | null;
        verified_name?: string | null;
      };
      const id = normalizeNumericId(rec.id != null ? String(rec.id) : "");
      if (!id) continue;
      all.push({
        id,
        display_phone_number: rec.display_phone_number ?? null,
        verified_name: rec.verified_name ?? null,
      });
    }

    const nextUrl =
      typeof body === "object" &&
      body &&
      "paging" in body &&
      body.paging &&
      typeof body.paging === "object" &&
      "next" in body.paging &&
      typeof body.paging.next === "string"
        ? body.paging.next
        : null;
    url = nextUrl ? new URL(nextUrl) : null;
  }

  return all;
}

/** Discover numbers from Meta Graph (WABA phone_numbers) and upsert into DB. */
export const syncFromMeta = action({
  args: {
    accessToken: v.optional(v.string()),
    wabaId: v.optional(v.string()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const runQueryByName = ctx.runQuery as unknown as (
      name: string,
      args: Record<string, never>
    ) => Promise<unknown>;
    const runMutationByName = ctx.runMutation as unknown as (
      name: string,
      args: Record<string, unknown>
    ) => Promise<unknown>;

    const dbNumbers = (await runQueryByName("whatsappNumbers:list", {})) as WhatsAppNumberRow[];
    const webhookSettings = (await runQueryByName("webhookSettings:get", {})) as {
      accessToken?: string | null;
    } | null;

    const accessToken =
      normalizeToken(args.accessToken) ??
      normalizeToken(webhookSettings?.accessToken ?? undefined) ??
      normalizeToken(dbNumbers.find((n) => n.accessToken?.trim())?.accessToken ?? undefined) ??
      normalizeToken(process.env.WHATSAPP_ACCESS_TOKEN);
    if (!accessToken) {
      throw new Error(
        "Missing access token. Set it in Integrations webhook settings, pass it to sync, or configure WHATSAPP_ACCESS_TOKEN."
      );
    }

    const wabaCandidates = [
      args.wabaId,
      process.env.WHATSAPP_WABA_ID,
      ...dbNumbers.map((n) => n.businessAccountId),
    ]
      .map((id) => normalizeNumericId(id))
      .filter((id) => id.length > 0);
    const wabaIds = Array.from(new Set(wabaCandidates));
    if (wabaIds.length === 0) {
      throw new Error("Missing WABA ID. Set businessAccountId for a number, pass wabaId, or set WHATSAPP_WABA_ID.");
    }

    const discovered: Array<{
      id: string;
      display_phone_number?: string | null;
      verified_name?: string | null;
      businessAccountId: string;
    }> = [];

    for (const wabaId of wabaIds) {
      const phones = await fetchWabaPhoneNumbers(ctx, wabaId, accessToken);
      for (const phone of phones) {
        discovered.push({
          ...phone,
          businessAccountId: wabaId,
        });
      }
    }

    const plan = buildMetaSyncPlan(
      dbNumbers.map((n) => ({
        businessNumberId: n.businessNumberId,
        businessAccountId: n.businessAccountId,
        phone: n.phone,
        name: n.name,
      })),
      discovered
    );

    if (!args.dryRun) {
      for (const row of plan.inserts) {
        await runMutationByName("whatsappNumbers:add", {
          businessAccountId: row.businessAccountId,
          businessNumberId: row.businessNumberId,
          phone: row.phone,
          name: row.name,
        });
      }

      for (const patchRow of plan.patches) {
        const existing = dbNumbers.find(
          (n) => normalizeNumericId(n.businessNumberId) === patchRow.businessNumberId
        );
        if (!existing) continue;
        await runMutationByName("whatsappNumbers:update", {
          id: existing._id,
          ...(patchRow.patch.name !== undefined ? { name: patchRow.patch.name } : {}),
          ...(patchRow.patch.phone !== undefined ? { phone: patchRow.patch.phone } : {}),
          ...(patchRow.patch.businessAccountId !== undefined
            ? { businessAccountId: patchRow.patch.businessAccountId }
            : {}),
        });
      }
    }

    return {
      discovered: discovered.length,
      wabaIds,
      inserted: plan.inserts.length,
      updated: plan.patches.length,
      dryRun: Boolean(args.dryRun),
      preview: discovered.map((d) => ({
        businessNumberId: d.id,
        phone: d.display_phone_number ?? null,
        name: d.verified_name ?? null,
        businessAccountId: d.businessAccountId,
      })),
    };
  },
});

export const checkHealth = action({
  args: {},
  handler: async (ctx) => {
    const runQueryByName = ctx.runQuery as unknown as (
      name: string,
      args: Record<string, never>
    ) => Promise<unknown>;
    const numbers = (await runQueryByName("whatsappNumbers:list", {})) as WhatsAppNumberRow[];
    const webhookSettings = (await runQueryByName("webhookSettings:get", {})) as {
      appId?: string | null;
    } | null;
    const expectedAppIdRaw = webhookSettings?.appId ?? process.env.WHATSAPP_APP_ID ?? "";
    const expectedAppId = normalizeNumericId(expectedAppIdRaw);
    const graphUrl = "https://graph.facebook.com/v21.0";
    const appSecret = process.env.WHATSAPP_APP_SECRET;

    const results: Array<{
      businessNumberId: string;
      name: string;
      tokenPresent: boolean;
      appSubscribed: boolean;
      profileReadable: boolean;
      mediaEndpointReadable: boolean;
      issues: string[];
    }> = [];

    for (const number of numbers) {
      const token = number.accessToken?.trim();
      const tokenPresent = Boolean(token);
      let appSubscribed = false;
      let profileReadable = false;
      let mediaEndpointReadable = false;
      const issues: string[] = [];
      const appSecretProof =
        appSecret && token
          ? await ctx.runAction(internal.nodeUtils.createAppSecretProof, { accessToken: token, appSecret })
          : undefined;

      if (!tokenPresent) {
        issues.push("Missing access token");
        results.push({
          businessNumberId: number.businessNumberId,
          name: number.name,
          tokenPresent,
          appSubscribed,
          profileReadable,
          mediaEndpointReadable,
          issues,
        });
        continue;
      }

      try {
        const profileUrl = new URL(`${graphUrl}/${number.businessNumberId}`);
        profileUrl.searchParams.set("fields", "id,display_phone_number");
        if (appSecretProof) profileUrl.searchParams.set("appsecret_proof", appSecretProof);
        const profileRes = await fetch(profileUrl.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });
        profileReadable = profileRes.ok;
        if (!profileReadable) {
          const body = await profileRes.text();
          issues.push(`Phone profile read failed (${profileRes.status}): ${body}`);
        }
      } catch (error) {
        issues.push(`Phone profile read error: ${error instanceof Error ? error.message : String(error)}`);
      }

      try {
        // WhatsApp Cloud API does not provide a generic GET /{phone_number_id}/media listing endpoint.
        // A read check requires a concrete media ID, so we keep this probe informational.
        mediaEndpointReadable = true;
      } catch (error) {
        issues.push(`Media endpoint read error: ${error instanceof Error ? error.message : String(error)}`);
      }

      try {
        const subUrl = new URL(`${graphUrl}/${number.businessAccountId}/subscribed_apps`);
        if (appSecretProof) subUrl.searchParams.set("appsecret_proof", appSecretProof);
        const subRes = await fetch(subUrl.toString(), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (subRes.ok) {
          const subData = await subRes.json();
          const rows: unknown[] = Array.isArray(subData?.data) ? subData.data : [];
          const appIds = rows
            .map((item) => {
              if (!item || typeof item !== "object") return "";
              const record = item as {
                id?: string | number;
                whatsapp_business_api_data?: { id?: string | number };
              };
              const directId = record.id != null ? String(record.id) : "";
              const nestedId =
                record.whatsapp_business_api_data?.id != null
                  ? String(record.whatsapp_business_api_data.id)
                  : "";
              return normalizeNumericId(directId || nestedId);
            })
            .filter(Boolean);
          if (expectedAppIdRaw && !expectedAppId) {
            issues.push(`Invalid App ID format in settings: "${expectedAppIdRaw}"`);
          }
          appSubscribed = expectedAppId ? appIds.includes(expectedAppId) : appIds.length > 0;
          if (!appSubscribed) {
            issues.push(
              expectedAppId
                ? `App ${expectedAppId} is not subscribed to this WABA. Subscribed IDs: ${appIds.join(", ") || "none"}`
                : "No subscribed apps found for this WABA"
            );
          }
        } else {
          const body = await subRes.text();
          issues.push(`WABA subscribed_apps check failed (${subRes.status}): ${body}`);
        }
      } catch (error) {
        issues.push(`WABA subscription check error: ${error instanceof Error ? error.message : String(error)}`);
      }

      results.push({
        businessNumberId: number.businessNumberId,
        name: number.name,
        tokenPresent,
        appSubscribed,
        profileReadable,
        mediaEndpointReadable,
        issues,
      });
    }

    return results;
  },
});

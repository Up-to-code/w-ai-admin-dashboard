import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { DEFAULT_TOOLS_ENABLED, normalizeToolsEnabled } from "./agentsUtils";

const DEFAULT_PROMPT =
  "You are a helpful sales assistant for this WhatsApp number. Keep replies concise and practical, and recommend relevant store products when useful.";
const DEFAULT_FREE_MODEL = "stepfun/step-3.5-flash:free";

function toView(config: {
  phoneNumberId?: string;
  systemPrompt: string;
  model: string;
  isActive: boolean;
  temperature?: number;
  agentName?: string;
  toolsEnabled?: string[];
  recommendProducts?: boolean;
  manualCatalogEnabled?: boolean;
  fallbackMode?: "no_reply" | "text_only" | "human_handoff";
  openRouterApiKey?: string;
}) {
  return {
    phoneNumberId: config.phoneNumberId,
    systemPrompt: config.systemPrompt,
    model: config.model,
    isActive: config.isActive,
    temperature: config.temperature,
    agentName: config.agentName ?? "Assistant",
    toolsEnabled: normalizeToolsEnabled(config.toolsEnabled),
    recommendProducts: config.recommendProducts ?? true,
    manualCatalogEnabled: config.manualCatalogEnabled ?? true,
    fallbackMode: config.fallbackMode ?? "text_only",
    openRouterApiKeyConfigured: !!config.openRouterApiKey?.trim(),
  };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("ai_configs").collect();
    return rows.map((row) => toView(row));
  },
});

export const getByPhoneNumberId = query({
  args: { phoneNumberId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("ai_configs")
      .withIndex("by_phone_number_id", (q) => q.eq("phoneNumberId", args.phoneNumberId))
      .first();
    if (!row) {
      return {
        phoneNumberId: args.phoneNumberId,
        systemPrompt: DEFAULT_PROMPT,
        model: DEFAULT_FREE_MODEL,
        isActive: false,
        temperature: undefined,
        agentName: "Assistant",
        toolsEnabled: DEFAULT_TOOLS_ENABLED,
        recommendProducts: true,
        manualCatalogEnabled: true,
        fallbackMode: "text_only" as const,
      };
    }
    return toView(row);
  },
});

export const upsertByPhoneNumberId = mutation({
  args: {
    phoneNumberId: v.string(),
    isActive: v.boolean(),
    systemPrompt: v.string(),
    model: v.string(),
    temperature: v.optional(v.number()),
    agentName: v.optional(v.string()),
    toolsEnabled: v.optional(v.array(v.string())),
    recommendProducts: v.optional(v.boolean()),
    manualCatalogEnabled: v.optional(v.boolean()),
    fallbackMode: v.optional(v.union(v.literal("no_reply"), v.literal("text_only"), v.literal("human_handoff"))),
    openRouterApiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ai_configs")
      .withIndex("by_phone_number_id", (q) => q.eq("phoneNumberId", args.phoneNumberId))
      .first();
    const doc = {
      phoneNumberId: args.phoneNumberId,
      isActive: args.isActive,
      systemPrompt: args.systemPrompt,
      model: args.model,
      temperature: args.temperature,
      agentName: args.agentName?.trim() || undefined,
      toolsEnabled: normalizeToolsEnabled(args.toolsEnabled),
      recommendProducts: args.recommendProducts ?? true,
      manualCatalogEnabled: args.manualCatalogEnabled ?? existing?.manualCatalogEnabled ?? true,
      fallbackMode: args.fallbackMode ?? "text_only",
      updatedAt: Date.now(),
      ...(args.openRouterApiKey !== undefined && { openRouterApiKey: args.openRouterApiKey?.trim() || undefined }),
    };
    if (existing) {
      await ctx.db.patch(existing._id, doc);
      return existing._id;
    }
    return await ctx.db.insert("ai_configs", doc);
  },
});

export const toggleByPhoneNumberId = mutation({
  args: {
    phoneNumberId: v.string(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ai_configs")
      .withIndex("by_phone_number_id", (q) => q.eq("phoneNumberId", args.phoneNumberId))
      .first();
    if (!existing) {
      return await ctx.db.insert("ai_configs", {
        phoneNumberId: args.phoneNumberId,
        systemPrompt: DEFAULT_PROMPT,
        model: DEFAULT_FREE_MODEL,
        isActive: args.isActive,
        toolsEnabled: DEFAULT_TOOLS_ENABLED,
        recommendProducts: true,
        manualCatalogEnabled: true,
        fallbackMode: "text_only",
        updatedAt: Date.now(),
      });
    }
    await ctx.db.patch(existing._id, {
      isActive: args.isActive,
      updatedAt: Date.now(),
    });
    return existing._id;
  },
});

export const ensureForPhoneNumber = mutation({
  args: {
    phoneNumberId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ai_configs")
      .withIndex("by_phone_number_id", (q) => q.eq("phoneNumberId", args.phoneNumberId))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("ai_configs", {
      phoneNumberId: args.phoneNumberId,
      systemPrompt: DEFAULT_PROMPT,
      model: DEFAULT_FREE_MODEL,
      isActive: false,
      toolsEnabled: DEFAULT_TOOLS_ENABLED,
      recommendProducts: true,
      manualCatalogEnabled: true,
      fallbackMode: "text_only",
      updatedAt: Date.now(),
    });
  },
});

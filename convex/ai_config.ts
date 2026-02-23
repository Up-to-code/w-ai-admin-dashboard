import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { DEFAULT_TOOLS_ENABLED, normalizeToolsEnabled } from "./agentsUtils";

const DEFAULT_SYSTEM_PROMPT = `You are a sales assistant for a store. Recommend products from the store (Salla/catalog), suggest related or complementary items when relevant, and help the customer choose. Answer concisely and in a helpful, professional tone.
When the customer asks to speak to a human, has a complaint, or has a complex request (e.g. refund, custom order), output exactly: <TOOL:transfer_to_human> and reply briefly that you are transferring the conversation to a team member. Examples: they say "أريد التحدث مع شخص" or "speak to agent" or "talk to human" or express a complaint or refund request — use the transfer tool.
Keep replies concise and suitable for WhatsApp: short paragraphs, avoid long markdown or code blocks.`;
const DEFAULT_FREE_MODEL = "stepfun/step-3.5-flash:free";

const DEFAULT_CONFIG = {
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  model: DEFAULT_FREE_MODEL,
  temperature: undefined as number | undefined,
  isActive: false,
  agentName: "Default Assistant",
  toolsEnabled: DEFAULT_TOOLS_ENABLED,
  recommendProducts: true,
  manualCatalogEnabled: true,
  fallbackMode: "text_only" as const,
};

/**
 * Get AI config for a specific phone number.
 * Falls back to global config (phoneNumberId = undefined) if no per-number config exists.
 */
export const getConfig = query({
  args: {
    phoneNumberId: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const phoneNumberId = args.phoneNumberId ?? undefined;
    // If phoneNumberId provided, use strict per-number isolation with default OFF fallback.
    if (phoneNumberId) {
      const perNumberConfig = await ctx.db
        .query("ai_configs")
        .withIndex("by_phone_number_id", (q) => q.eq("phoneNumberId", phoneNumberId))
        .first();
      if (perNumberConfig) {
        return {
          ...perNumberConfig,
          toolsEnabled: normalizeToolsEnabled(perNumberConfig.toolsEnabled),
          recommendProducts: perNumberConfig.recommendProducts ?? true,
          manualCatalogEnabled: perNumberConfig.manualCatalogEnabled ?? true,
          fallbackMode: perNumberConfig.fallbackMode ?? "text_only",
          agentName: perNumberConfig.agentName ?? "Assistant",
        };
      }
      return {
        ...DEFAULT_CONFIG,
        phoneNumberId,
        isActive: false,
      };
    }
    
    // Global config (phoneNumberId = undefined)
    const globalConfig = await ctx.db
      .query("ai_configs")
      .withIndex("by_phone_number_id", (q) => q.eq("phoneNumberId", undefined))
      .first();
    
    if (!globalConfig) return DEFAULT_CONFIG;
    return {
      ...globalConfig,
      toolsEnabled: normalizeToolsEnabled(globalConfig.toolsEnabled),
      recommendProducts: globalConfig.recommendProducts ?? true,
      manualCatalogEnabled: globalConfig.manualCatalogEnabled ?? true,
      fallbackMode: globalConfig.fallbackMode ?? "text_only",
      agentName: globalConfig.agentName ?? "Default Assistant",
    };
  },
});

/**
 * Update or create AI config for a specific phone number.
 * If phoneNumberId is undefined, updates/creates the global config.
 */
export const updateConfig = mutation({
  args: {
    phoneNumberId: v.optional(v.union(v.string(), v.null())),
    systemPrompt: v.string(),
    model: v.string(),
    temperature: v.optional(v.number()),
    isActive: v.boolean(),
    agentName: v.optional(v.string()),
    toolsEnabled: v.optional(v.array(v.string())),
    recommendProducts: v.optional(v.boolean()),
    manualCatalogEnabled: v.optional(v.boolean()),
    fallbackMode: v.optional(v.union(v.literal("no_reply"), v.literal("text_only"), v.literal("human_handoff"))),
  },
  handler: async (ctx, args) => {
    const phoneNumberId = args.phoneNumberId ?? undefined;
    // Find existing config for this phoneNumberId (or global if undefined)
    const existing = await ctx.db
      .query("ai_configs")
      .withIndex("by_phone_number_id", (q) => q.eq("phoneNumberId", phoneNumberId))
      .first();
    
    const updates = {
      phoneNumberId,
      systemPrompt: args.systemPrompt,
      model: args.model,
      isActive: args.isActive,
      updatedAt: Date.now(),
      ...(args.temperature !== undefined && { temperature: args.temperature }),
      agentName: args.agentName?.trim() || undefined,
      toolsEnabled: normalizeToolsEnabled(args.toolsEnabled),
      recommendProducts: args.recommendProducts ?? true,
      manualCatalogEnabled: args.manualCatalogEnabled ?? existing?.manualCatalogEnabled ?? true,
      fallbackMode: args.fallbackMode ?? "text_only",
    };
    
    if (existing) {
      await ctx.db.patch(existing._id, updates);
    } else {
      await ctx.db.insert("ai_configs", {
        phoneNumberId,
        systemPrompt: args.systemPrompt,
        model: args.model,
        isActive: args.isActive,
        updatedAt: Date.now(),
        ...(args.temperature !== undefined && { temperature: args.temperature }),
        agentName: args.agentName?.trim() || undefined,
        toolsEnabled: normalizeToolsEnabled(args.toolsEnabled),
        recommendProducts: args.recommendProducts ?? true,
        manualCatalogEnabled: args.manualCatalogEnabled ?? true,
        fallbackMode: args.fallbackMode ?? "text_only",
      });
    }
  },
});

/**
 * Internal query for agent: get config by phoneNumberId.
 * Strict isolation: if a number has no dedicated config, return a disabled default for that number.
 */
export const getInternalConfig = internalQuery({
  args: {
    phoneNumberId: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const phoneNumberId = args.phoneNumberId ?? undefined;
    if (phoneNumberId) {
      const perNumberConfig = await ctx.db
        .query("ai_configs")
        .withIndex("by_phone_number_id", (q) => q.eq("phoneNumberId", phoneNumberId))
        .first();
      if (perNumberConfig) {
        return {
          ...perNumberConfig,
          toolsEnabled: normalizeToolsEnabled(perNumberConfig.toolsEnabled),
          recommendProducts: perNumberConfig.recommendProducts ?? true,
          manualCatalogEnabled: perNumberConfig.manualCatalogEnabled ?? true,
          fallbackMode: perNumberConfig.fallbackMode ?? "text_only",
          agentName: perNumberConfig.agentName ?? "Assistant",
        };
      }
      return {
        ...DEFAULT_CONFIG,
        phoneNumberId,
        isActive: false,
      };
    }

    // Global config (used only when no phoneNumberId is supplied)
    const globalConfig = await ctx.db
      .query("ai_configs")
      .withIndex("by_phone_number_id", (q) => q.eq("phoneNumberId", undefined))
      .first();

    if (!globalConfig) return DEFAULT_CONFIG;
    return {
      ...globalConfig,
      toolsEnabled: normalizeToolsEnabled(globalConfig.toolsEnabled),
      recommendProducts: globalConfig.recommendProducts ?? true,
      manualCatalogEnabled: globalConfig.manualCatalogEnabled ?? true,
      fallbackMode: globalConfig.fallbackMode ?? "text_only",
      agentName: globalConfig.agentName ?? "Default Assistant",
      ...(phoneNumberId && { phoneNumberId }),
    };
  },
});

export const setManualCatalogEnabled = mutation({
  args: {
    phoneNumberId: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ai_configs")
      .withIndex("by_phone_number_id", (q) => q.eq("phoneNumberId", args.phoneNumberId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        manualCatalogEnabled: args.enabled,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("ai_configs", {
      phoneNumberId: args.phoneNumberId,
      systemPrompt: DEFAULT_CONFIG.systemPrompt,
      model: DEFAULT_CONFIG.model,
      isActive: false,
      toolsEnabled: DEFAULT_TOOLS_ENABLED,
      recommendProducts: true,
      manualCatalogEnabled: args.enabled,
      fallbackMode: "text_only",
      updatedAt: Date.now(),
    });
  },
});

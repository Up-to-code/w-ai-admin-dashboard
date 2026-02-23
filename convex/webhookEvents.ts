import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

export const logWhatsappWebhook = internalMutation({
  args: { body: v.any() },
  handler: async (ctx, args) => {
    await ctx.db.insert("webhook_events", {
      source: "whatsapp",
      body: args.body,
      processingStatus: "received",
      createdAt: Date.now(),
    });
  },
});

export const logSallaWebhook = internalMutation({
  args: {
    body: v.any(),
    processingStatus: v.optional(
      v.union(
        v.literal("received"),
        v.literal("ignored_no_messages"),
        v.literal("saved"),
        v.literal("failed")
      )
    ),
    eventType: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("webhook_events", {
      source: "salla",
      body: args.body,
      processingStatus: args.processingStatus,
      eventType: args.eventType,
      note: args.note,
      createdAt: Date.now(),
    });
  },
});

export const logWhatsappProcessing = internalMutation({
  args: {
    body: v.any(),
    processingStatus: v.union(
      v.literal("received"),
      v.literal("ignored_no_messages"),
      v.literal("saved"),
      v.literal("failed")
    ),
    eventType: v.optional(v.string()),
    resolvedPhoneNumberId: v.optional(v.string()),
    fallbackUsed: v.optional(v.boolean()),
    hasMessages: v.optional(v.boolean()),
    messagesCount: v.optional(v.number()),
    hasStatuses: v.optional(v.boolean()),
    statusesCount: v.optional(v.number()),
    metadataPhoneNumberId: v.optional(v.string()),
    metadataDisplayPhoneNumber: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("webhook_events", {
      source: "whatsapp",
      body: args.body,
      processingStatus: args.processingStatus,
      eventType: args.eventType,
      resolvedPhoneNumberId: args.resolvedPhoneNumberId,
      fallbackUsed: args.fallbackUsed,
      hasMessages: args.hasMessages,
      messagesCount: args.messagesCount,
      hasStatuses: args.hasStatuses,
      statusesCount: args.statusesCount,
      metadataPhoneNumberId: args.metadataPhoneNumberId,
      metadataDisplayPhoneNumber: args.metadataDisplayPhoneNumber,
      note: args.note,
      createdAt: Date.now(),
    });
  },
});

export const latestWhatsappWebhook = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("webhook_events")
      .withIndex("by_source_createdAt", (q) => q.eq("source", "whatsapp"))
      .order("desc")
      .first();
  },
});

export const latestWhatsappProcessing = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("webhook_events")
      .withIndex("by_source_createdAt", (q) => q.eq("source", "whatsapp"))
      .order("desc")
      .take(args.limit ?? 20);
    return rows.filter((row) => row.processingStatus !== undefined);
  },
});

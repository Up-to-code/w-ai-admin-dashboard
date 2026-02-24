import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { normalizeRuntimeEventInput } from "./mobileRuntimeEventsUtils";

export { normalizeRuntimeEventInput } from "./mobileRuntimeEventsUtils";

export const ingestFromHttp = internalMutation({
  args: {
    source: v.optional(v.union(v.literal("mobile"), v.literal("synthetic"))),
    platform: v.optional(v.string()),
    appVersion: v.optional(v.string()),
    buildId: v.optional(v.string()),
    jsEngine: v.optional(v.string()),
    eventName: v.optional(v.string()),
    severity: v.optional(
      v.union(v.literal("info"), v.literal("warning"), v.literal("error"), v.literal("fatal"))
    ),
    message: v.optional(v.string()),
    stack: v.optional(v.string()),
    phase: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const normalized = normalizeRuntimeEventInput(args);
    await ctx.db.insert("mobile_runtime_events", {
      ...normalized,
      createdAt: Date.now(),
    });
  },
});

export const triggerSyntheticError = mutation({
  args: {
    message: v.optional(v.string()),
    eventName: v.optional(v.string()),
    severity: v.optional(
      v.union(v.literal("info"), v.literal("warning"), v.literal("error"), v.literal("fatal"))
    ),
    phase: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const normalized = normalizeRuntimeEventInput({
      source: "synthetic",
      eventName: args.eventName ?? "synthetic_runtime_trigger",
      severity: args.severity ?? "error",
      message: args.message ?? "Manual synthetic runtime event",
      phase: args.phase,
      metadata: args.metadata,
    });

    await ctx.db.insert("mobile_runtime_events", {
      ...normalized,
      createdAt: Date.now(),
    });

    return { ok: true };
  },
});

export const listRecent = query({
  args: {
    limit: v.optional(v.number()),
    severity: v.optional(
      v.union(v.literal("info"), v.literal("warning"), v.literal("error"), v.literal("fatal"))
    ),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    if (args.severity) {
      return await ctx.db
        .query("mobile_runtime_events")
        .withIndex("by_severity_createdAt", (q) => q.eq("severity", args.severity!))
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("mobile_runtime_events")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit);
  },
});

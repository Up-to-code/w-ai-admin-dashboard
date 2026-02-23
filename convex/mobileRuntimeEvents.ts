import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

const MAX_MESSAGE_LEN = 5000;
const MAX_STACK_LEN = 12000;
const MAX_EVENT_NAME_LEN = 120;
const MAX_PHASE_LEN = 120;

type RuntimeSeverity = "info" | "warning" | "error" | "fatal";

export function normalizeRuntimeEventInput(input: {
  source?: "mobile" | "synthetic";
  platform?: string;
  appVersion?: string;
  buildId?: string;
  jsEngine?: string;
  eventName?: string;
  severity?: RuntimeSeverity;
  message?: string;
  stack?: string;
  phase?: string;
  metadata?: unknown;
}) {
  const asTrimmed = (value?: string, max = 200): string | undefined => {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return trimmed.slice(0, max);
  };

  return {
    source: input.source ?? "mobile",
    platform: asTrimmed(input.platform, 64),
    appVersion: asTrimmed(input.appVersion, 64),
    buildId: asTrimmed(input.buildId, 128),
    jsEngine: asTrimmed(input.jsEngine, 32),
    eventName: asTrimmed(input.eventName, MAX_EVENT_NAME_LEN) ?? "unknown_event",
    severity: (input.severity ?? "error") as RuntimeSeverity,
    message: asTrimmed(input.message, MAX_MESSAGE_LEN),
    stack: asTrimmed(input.stack, MAX_STACK_LEN),
    phase: asTrimmed(input.phase, MAX_PHASE_LEN),
    metadata: input.metadata ?? undefined,
  };
}

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

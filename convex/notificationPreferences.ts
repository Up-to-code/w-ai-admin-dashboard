import { internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  humanHandoffPushEnabled: true,
  suppressPushWhenChatActive: true,
} as const;

type NotificationPreferences = {
  humanHandoffPushEnabled: boolean;
  suppressPushWhenChatActive: boolean;
  updatedAt?: number;
};

function mapRowToPreferences(
  row: {
    humanHandoffPushEnabled?: boolean;
    suppressPushWhenChatActive?: boolean;
    updatedAt?: number;
  } | null
): NotificationPreferences {
  if (!row) {
    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
    };
  }
  return {
    humanHandoffPushEnabled:
      row.humanHandoffPushEnabled ?? DEFAULT_NOTIFICATION_PREFERENCES.humanHandoffPushEnabled,
    suppressPushWhenChatActive:
      row.suppressPushWhenChatActive ?? DEFAULT_NOTIFICATION_PREFERENCES.suppressPushWhenChatActive,
    updatedAt: row.updatedAt,
  };
}

export const get = query({
  handler: async (ctx) => {
    const row = await ctx.db.query("notification_preferences").first();
    return mapRowToPreferences(row);
  },
});

export const getInternal = internalQuery({
  handler: async (ctx) => {
    const row = await ctx.db.query("notification_preferences").first();
    return mapRowToPreferences(row);
  },
});

export const set = mutation({
  args: {
    humanHandoffPushEnabled: v.optional(v.boolean()),
    suppressPushWhenChatActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.query("notification_preferences").first();
    const current = mapRowToPreferences(row);
    const next = {
      humanHandoffPushEnabled:
        args.humanHandoffPushEnabled ?? current.humanHandoffPushEnabled,
      suppressPushWhenChatActive:
        args.suppressPushWhenChatActive ?? current.suppressPushWhenChatActive,
      updatedAt: Date.now(),
    };

    if (row) {
      await ctx.db.patch(row._id, next);
    } else {
      await ctx.db.insert("notification_preferences", next);
    }

    return next;
  },
});

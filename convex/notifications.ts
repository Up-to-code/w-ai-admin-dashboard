import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { PushNotifications } from "@convex-dev/expo-push-notifications";
import { components, internal } from "./_generated/api";
import { shouldSendHumanEscalationPush as shouldSendPushForHumanEscalation } from "./pushPolicy";

const pushNotifications = new PushNotifications<any>(components.pushNotifications);

export const list = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const limit = args.limit || 20;
        return await ctx.db
            .query("notifications")
            .withIndex("by_created_at")
            .order("desc")
            .take(limit);
    },
});

export const unreadCount = query({
    handler: async (ctx) => {
        const notifications = await ctx.db
            .query("notifications")
            .withIndex("by_read", (q) => q.eq("read", false))
            .collect();
        return notifications.length;
    },
});

export const markAsRead = mutation({
    args: { id: v.id("notifications") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { read: true });
    },
});

export const markAllAsRead = mutation({
    handler: async (ctx) => {
        const unread = await ctx.db
            .query("notifications")
            .withIndex("by_read", (q) => q.eq("read", false))
            .collect();

        for (const n of unread) {
            await ctx.db.patch(n._id, { read: true });
        }
    },
});

export const create = internalMutation({
    args: {
        type: v.union(v.literal("info"), v.literal("warning"), v.literal("error"), v.literal("success")),
        title: v.string(),
        message: v.string(),
        link: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("notifications", {
            type: args.type,
            title: args.title,
            message: args.message,
            link: args.link,
            read: false,
            createdAt: Date.now(),
        });
    },
});

export const recordPushNotificationToken = mutation({
    args: { token: v.string(), userId: v.optional(v.id("users")) },
    handler: async (ctx, args) => {
        let userId = args.userId;

        if (!userId) {
            const identity = await ctx.auth.getUserIdentity();
            if (identity) {
                // Try to find user by tokenIdentifier if strictly using standard auth, 
                // or just assume the identity.subject IS the identifier if mapped.
                // For compatibility with the custom auth flow which returns a userId,
                // we expect the client to pass userId.
                // If we have an identity but no userId arg, we can try to look it up 
                // if we had a mapping. 
                // For now, allow relying on args.userId.
                // userId = identity.subject; // Type mismatch risk
            }
        }

        if (!userId) {
            console.warn("recordPushNotificationToken called without userId or authenticated identity. Skipping association.");
            // We could throw, but maybe we want to allow anonymous push? 
            // The lib requires userId.
            throw new Error("User ID required for push notifications");
        }

        await pushNotifications.recordToken(ctx, {
            userId: userId,
            pushToken: args.token,
        });
    },
});

export const sendHumanEscalationPush = internalMutation({
    args: {
        chatId: v.id("chats"),
        title: v.string(),
        body: v.string(),
        phoneNumberId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const settings = await ctx.runQuery((internal as any).notificationPreferences.getInternal, {});
        const hasActiveHumanViewer = settings.suppressPushWhenChatActive
            ? await ctx.runQuery((internal as any).chat.hasActiveHumanViewer, { chatId: args.chatId })
            : false;

        const shouldSend = shouldSendPushForHumanEscalation({
            needsHumanAttention: true,
            hasActiveHumanViewer,
            settings,
        });
        if (!shouldSend) return { sent: 0, skipped: true };

        const admins = await ctx.db
            .query("users")
            .filter((q: any) => q.eq(q.field("role"), "admin"))
            .collect();

        for (const admin of admins) {
            await pushNotifications.sendPushNotification(ctx, {
                userId: admin._id,
                notification: {
                    title: args.title,
                    body: args.body,
                    data: {
                        chatId: args.chatId,
                        reason: "human_handoff",
                        ...(args.phoneNumberId ? { phoneNumberId: args.phoneNumberId } : {}),
                    },
                },
            });
        }

        return { sent: admins.length, skipped: false };
    },
});

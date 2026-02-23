import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";

export const saveMessage = internalMutation({
    args: {
        contactId: v.string(),
        contactName: v.string(),
        contactPhone: v.string(),
        phoneNumberId: v.optional(v.string()), // Meta phone_number_id; scopes chat to a business number
        direction: v.union(v.literal("inbound"), v.literal("outbound")),
        type: v.string(),
        content: v.string(),
        metaMessageId: v.string(),
        timestamp: v.number(),
        status: v.string(),
        mediaId: v.optional(v.string()),
        storageId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // 0. Idempotency: avoid double-inserting the same Meta message
        try {
            const existing = await ctx.db
                .query("messages")
                .withIndex("by_meta_message_id", (q) => q.eq("metaMessageId", args.metaMessageId))
                .first();
            if (existing) {
                return existing._id;
            }
        } catch (e) {
            // If index isn't available yet (during dev), continue and insert
        }

        // 0. Auto-Capture Logic (Middleware) (Robust Version)
        let contactId = args.contactId;

        try {
            const existingContact = await ctx.db
                .query("contacts")
                .withIndex("by_phone", (q) => q.eq("phone", args.contactPhone))
                .first();

            if (!existingContact && args.direction === "inbound") {
                console.log(`[Messages] Creating new contact for ${args.contactPhone}`);
                const newContactId = await ctx.db.insert("contacts", {
                    name: args.contactName || "Unknown",
                    phone: args.contactPhone,
                    isSubscribed: true,
                    tags: ["inbound"],
                    createdAt: Date.now(),
                });
                // In a real app we might update contactId to match the DB ID, but here contactId is External
            } else if (existingContact) {
                console.log(`[Messages] Existing contact found: ${existingContact._id}`);
                // Match name if it was unknown?
                if (existingContact.name === "Unknown" && args.contactName && args.contactName !== args.contactPhone) {
                    await ctx.db.patch(existingContact._id, { name: args.contactName });
                }
            }
        } catch (e) {
            console.error("[Messages] Contact Sync Error:", e);
            // Continue saving message even if contact sync fails
        }

        // 1. Find or Create Chat (scoped by phoneNumberId when provided)
        let finalChatId;
        try {
            let chat;
            if (args.phoneNumberId !== undefined && args.phoneNumberId !== null && args.phoneNumberId !== "") {
                chat = await ctx.db
                    .query("chats")
                    .withIndex("by_phoneNumberId_contactPhone", (q) =>
                        q.eq("phoneNumberId", args.phoneNumberId).eq("contactPhone", args.contactPhone)
                    )
                    .first();
                if (chat) {
                    console.log(`[Messages] Found existing scoped chat: chatId=${chat._id}, businessId=${args.phoneNumberId}`);
                }
            } else {
                chat = await ctx.db
                    .query("chats")
                    .filter((q: any) => q.eq(q.field("contactPhone"), args.contactPhone))
                    .first();
                if (chat) {
                    console.log(`[Messages] Found existing global chat: chatId=${chat._id}`);
                }
            }

            if (chat) {
                finalChatId = chat._id;
                await ctx.db.patch(chat._id, {
                    lastMessageTime: args.timestamp,
                    unreadCount: args.direction === "inbound" ? (chat.unreadCount || 0) + 1 : chat.unreadCount
                });
            } else {
                const businessId = (args.phoneNumberId !== undefined && args.phoneNumberId !== null && args.phoneNumberId !== "") ? args.phoneNumberId : 'global';
                console.log(`[Messages] Creating new chat profile for ${args.contactPhone} (Scoped to: ${businessId})`);
                const insertPayload: any = {
                    contactId: args.contactId,
                    contactName: args.contactName,
                    contactPhone: args.contactPhone,
                    lastMessageTime: args.timestamp,
                    unreadCount: 1,
                    status: "active",
                    aiMode: true,
                };
                if (args.phoneNumberId !== undefined && args.phoneNumberId !== null && args.phoneNumberId !== "") {
                    insertPayload.phoneNumberId = args.phoneNumberId;
                }
                finalChatId = await ctx.db.insert("chats", insertPayload);
                console.log(`[Messages] Successfully created chat: chatId=${finalChatId} for businessId=${businessId}`);
            }
        } catch (e) {
            console.error("[Messages] Chat Creation Error:", e);
            throw e; // Fail message save if chat fails
        }

        // 2. Insert Message
        const msgId = await ctx.db.insert("messages", {
            chatId: finalChatId,
            direction: args.direction as "inbound" | "outbound",
            type: args.type as any,
            content: args.content,
            status: args.status as any,
            mediaHydrationStatus: args.mediaId ? "pending" : undefined,
            timestamp: args.timestamp,
            metaMessageId: args.metaMessageId,
            mediaId: args.mediaId,
            storageId: args.storageId,
        });
        console.log(`[Messages] Message saved: ${msgId} (${args.direction})`);

        // 3. Trigger Workflows (Async)
        if (args.direction === "inbound") {
            await ctx.scheduler.runAfter(0, internal.workflows.checkAndExecuteWorkflows, {
                messageId: msgId,
                content: args.content,
                contactPhone: args.contactPhone,
                phoneNumberId: args.phoneNumberId,
            });
        }

        // 4. Send push only when this chat needs human handling.
        if (args.direction === "inbound") {
            try {
                const chat = await ctx.db.get(finalChatId);
                const needsHumanAttention = chat?.aiMode === false;
                if (!needsHumanAttention) {
                    return msgId;
                }

                // Get business name for context
                let businessName = "";
                if (chat?.phoneNumberId) {
                    const whatsappNumber = await ctx.db
                        .query("whatsapp_numbers")
                        .withIndex("by_business_number_id", (q) => q.eq("businessNumberId", chat.phoneNumberId!))
                        .first();
                    if (whatsappNumber) {
                        businessName = ` [${whatsappNumber.name}]`;
                    }
                }
                // In-app toast is handled by getLatestGlobalMessage + GlobalNotification (with number switch).
                // This push is for human escalation only.
                const notifTitle = `${chat?.contactName || args.contactPhone}${businessName}`;
                const notifBody =
                    args.type === "text"
                        ? args.content
                        : `New ${args.type} message while awaiting human reply`;
                await ctx.scheduler.runAfter(0, (internal as any).notifications.sendHumanEscalationPush, {
                    chatId: finalChatId,
                    title: notifTitle,
                    body: notifBody,
                    phoneNumberId: chat?.phoneNumberId,
                });
            } catch (e) {
                console.error("[Messages] Failed to send push notifications:", e);
            }
        }

        return msgId;
    }
});

export const updateMessageStatus = internalMutation({
    args: {
        metaMessageId: v.string(),
        status: v.string(),
    },
    handler: async (ctx, args) => {
        const message = await ctx.db
            .query("messages")
            .filter((q: any) => q.eq(q.field("metaMessageId"), args.metaMessageId))
            .first();

        if (message) {
            await ctx.db.patch(message._id, {
                status: args.status as any
            });
            return true; // Found and updated
        }
        return false; // Not found
    }
});

export const updateMessageMetaId = internalMutation({
    args: {
        messageId: v.id("messages"),
        metaMessageId: v.string(),
    },
    handler: async (ctx, args) => {
        const message = await ctx.db.get(args.messageId);
        if (message) {
            await ctx.db.patch(args.messageId, {
                metaMessageId: args.metaMessageId,
                status: "sent" // Confirm it's sent
            });
            console.log(`[Messages] Updated message ${args.messageId} with Meta ID: ${args.metaMessageId}`);
        } else {
            console.error(`[Messages] Failed to update Meta ID. Message ${args.messageId} not found.`);
        }
    }
});

export const updateMessageStorageId = internalMutation({
    args: {
        messageId: v.id("messages"),
        storageId: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.messageId, {
            storageId: args.storageId,
            mediaHydrationStatus: "success",
            mediaHydrationError: undefined,
        });
    }
});

export const updateMediaHydrationFailure = internalMutation({
    args: {
        messageId: v.id("messages"),
        error: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.messageId, {
            mediaHydrationStatus: "failed",
            mediaHydrationError: args.error,
        });
    },
});

export const sendAndSave = internalMutation({
    args: {
        chatId: v.id("chats"),
        contactPhone: v.string(),
        content: v.string(),
        type: v.string(),
        mediaId: v.optional(v.string()), // Add support for passing mediaId
        storageId: v.optional(v.string()), // Add support for passing storageId
        mediaUrl: v.optional(v.string()), // Add support for passing mediaUrl directly
    },
    handler: async (ctx, args) => {
        const chat = await ctx.db.get(args.chatId);
        // 1. Save to DB
        const messageId = await ctx.db.insert("messages", {
            chatId: args.chatId,
            direction: "outbound",
            type: args.type as any,
            content: args.content,
            status: "sent",
            timestamp: Date.now(),
            mediaId: args.mediaId,
            storageId: args.storageId,
        });

        // 2. Send via WhatsApp
        // Format content based on type (WhatsApp API expects objects for text/image etc)
        let payloadContent: any;

        if (args.type === "text") {
            payloadContent = { body: args.content };
        } else if (args.type === "image") {
            if (args.mediaId) {
                payloadContent = { id: args.mediaId, caption: args.content };
            } else if (args.mediaUrl) {
                payloadContent = { link: args.mediaUrl, caption: args.content };
            } else {
                payloadContent = args.content;
            }
        } else if (args.type === "audio") {
            if (args.mediaId) {
                payloadContent = { id: args.mediaId };
            } else if (args.mediaUrl) {
                payloadContent = { link: args.mediaUrl };
            } else {
                payloadContent = args.content;
            }
        } else if (args.type === "video") {
            if (args.mediaId) {
                payloadContent = { id: args.mediaId, caption: args.content };
            } else if (args.mediaUrl) {
                payloadContent = { link: args.mediaUrl, caption: args.content };
            } else {
                payloadContent = args.content;
            }
        } else {
            payloadContent = args.content;
        }

        await ctx.scheduler.runAfter(0, api.whatsapp.sendMessage, {
            to: args.contactPhone,
            type: args.type,
            content: payloadContent,
            messageId: messageId,
            phoneNumberId: chat?.phoneNumberId ?? undefined,
        });

        // 3. Update Chat
        await ctx.db.patch(args.chatId, {
            lastMessageTime: Date.now(),
        });
    }
});

export const list = query({
    args: { chatId: v.id("chats") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("messages")
            .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
            .order("desc")
            .take(50);
    },
});

export const getRecentForContext = internalQuery({
    args: {
        chatId: v.id("chats"),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const limit = Math.min(Math.max(args.limit ?? 5, 1), 20);
        const rows = await ctx.db
            .query("messages")
            .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
            .order("desc")
            .take(limit);
        return rows.map((msg) => ({
            direction: msg.direction,
            type: msg.type,
            content: msg.content,
            timestamp: msg.timestamp,
        }));
    },
});

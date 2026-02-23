import { query, mutation, internalMutation, internalAction, internalQuery } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

const ACTIVE_CHAT_WINDOW_MS = 90 * 1000;

export const getChatByPhone = internalQuery({
  args: { phone: v.string(), phoneNumberId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.phoneNumberId) {
      return await ctx.db
        .query("chats")
        .withIndex("by_phoneNumberId_contactPhone", (q) =>
          q.eq("phoneNumberId", args.phoneNumberId).eq("contactPhone", args.phone)
        )
        .first();
    }
    return await ctx.db
      .query("chats")
      .filter((q: any) => q.eq(q.field("contactPhone"), args.phone))
      .first();
  },
});

export const getOrCreateChat = mutation({
  args: {
    contactPhone: v.string(),
    contactName: v.string(),
    phoneNumberId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let existing;
    if (args.phoneNumberId) {
      existing = await ctx.db
        .query("chats")
        .withIndex("by_phoneNumberId_contactPhone", (q) =>
          q.eq("phoneNumberId", args.phoneNumberId).eq("contactPhone", args.contactPhone)
        )
        .first();
    } else {
      existing = await ctx.db
        .query("chats")
        .filter((q: any) => q.eq(q.field("contactPhone"), args.contactPhone))
        .first();
    }

    if (existing) return existing;

    const insertPayload: any = {
      contactId: args.contactPhone,
      contactName: args.contactName,
      contactPhone: args.contactPhone,
      lastMessageTime: Date.now(),
      unreadCount: 0,
      status: "active",
      aiMode: true,
    };
    if (args.phoneNumberId) insertPayload.phoneNumberId = args.phoneNumberId;
    const chatId = await ctx.db.insert("chats", insertPayload);

    return await ctx.db.get(chatId);
  },
});

export const toggleAiMode = mutation({
  args: { chatId: v.id("chats"), enabled: v.boolean() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.chatId, { aiMode: args.enabled });
  },
});

/** Called by agent when handing off to human: turn off AI for this chat so humans reply from dashboard. */
export const transferToHuman = internalMutation({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.chatId, { aiMode: false });
  },
});

// Set the active chat for a user
export const setActiveChat = mutation({
  args: {
    chatId: v.id("chats"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Check if record exists
    const existing = await ctx.db
      .query("userActiveChats")
      .withIndex("by_user_chat", (q) =>
        q.eq("userId", args.userId).eq("chatId", args.chatId)
      )
      .first();

    if (existing) {
      // Update timestamp
      await ctx.db.patch(existing._id, {
        lastActiveAt: Date.now(),
      });
    } else {
      // Create new record
      await ctx.db.insert("userActiveChats", {
        userId: args.userId,
        chatId: args.chatId,
        lastActiveAt: Date.now(),
      });
    }
  },
});

// Clear active chat (when user navigates away)
export const clearActiveChat = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Delete all active chats for this user (only one should be active at a time)
    const activeChats = await ctx.db
      .query("userActiveChats")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const activeChat of activeChats) {
      await ctx.db.delete(activeChat._id);
    }
  },
});

// Query to check if user is viewing a specific chat
export const isUserViewingChat = internalQuery({
  args: {
    userId: v.id("users"),
    chatId: v.id("chats"),
  },
  handler: async (ctx, args) => {
    const activeChat = await ctx.db
      .query("userActiveChats")
      .withIndex("by_user_chat", (q) =>
        q.eq("userId", args.userId).eq("chatId", args.chatId)
      )
      .first();

    if (!activeChat) return false;

    // Consider chat active while regular heartbeat updates are received from web/mobile chat screens.
    const cutoff = Date.now() - ACTIVE_CHAT_WINDOW_MS;
    return activeChat.lastActiveAt > cutoff;
  },
});

// Check whether any active admin/agent is currently handling this chat.
export const hasActiveHumanViewer = internalQuery({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - ACTIVE_CHAT_WINDOW_MS;
    let activeSessions;
    try {
      activeSessions = await ctx.db
        .query("userActiveChats")
        .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
        .collect();
    } catch {
      // Safe rollout fallback when the new index is not deployed yet.
      activeSessions = await ctx.db
        .query("userActiveChats")
        .filter((q) => q.eq(q.field("chatId"), args.chatId))
        .collect();
    }

    const recentUserIds = activeSessions
      .filter((row) => row.lastActiveAt > cutoff)
      .map((row) => row.userId);
    if (recentUserIds.length === 0) return false;

    const users = await Promise.all(recentUserIds.map((userId) => ctx.db.get(userId)));
    return users.some((user) => user?.role === "admin" || user?.role === "agent");
  },
});

async function listRecentInboundMessages(ctx: any, limit: number) {
  try {
    return await ctx.db
      .query("messages")
      .withIndex("by_direction", (q: any) => q.eq("direction", "inbound"))
      .order("desc")
      .take(limit);
  } catch {
    // Backward-compatible fallback for deployments that haven't built the index yet.
    const recent = await ctx.db.query("messages").order("desc").take(limit * 3);
    return recent.filter((m: any) => m.direction === "inbound").slice(0, limit);
  }
}

export const getLatestGlobalMessage = query({
  handler: async (ctx) => {
    // Look up latest *inbound* message so outbound bot/human messages do not hide notifications.
    const inboundMessages = await listRecentInboundMessages(ctx, 20);
    for (const message of inboundMessages) {
      const chat = await ctx.db.get(message.chatId);
      if (!chat) continue;
      const isChat =
        "lastMessageTime" in chat &&
        "contactPhone" in chat &&
        "unreadCount" in chat;
      if (!isChat) continue;

      // Fetch business name for context
      let businessName = undefined;
      let businessPhone = undefined;
      if (chat.phoneNumberId) {
        const whatsappNumber = await ctx.db
          .query("whatsapp_numbers")
          .withIndex("by_business_number_id", (q) => q.eq("businessNumberId", chat.phoneNumberId!))
          .first();
        if (whatsappNumber) {
          businessName = whatsappNumber.name;
          businessPhone = whatsappNumber.phone;
        }
      }

      return {
        messageId: message._id,
        chatId: chat._id,
        contactName: chat.contactName,
        contactPhone: chat.contactPhone,
        phoneNumberId: chat.phoneNumberId ?? undefined,
        businessName,
        businessPhone,
        content: message.content, // Text or Caption
        type: message.type,
        timestamp: message._creationTime, // Use insertion time for notification sync
      };
    }
    return null;
  }
});

// Public Query for UI (optional phoneNumberId: when set, only chats for that business number)
export const listChats = query({
  args: { phoneNumberId: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const phoneNumberId = args.phoneNumberId ?? undefined;
    if (phoneNumberId) {
      return await ctx.db
        .query("chats")
        .withIndex("by_phoneNumberId_last_message", (q: any) =>
          q.eq("phoneNumberId", phoneNumberId)
        )
        .order("desc")
        .collect();
    }
    return await ctx.db.query("chats").withIndex("by_last_message").order("desc").collect();
  },
});

export const getUnreadCounts = query({
  handler: async (ctx) => {
    const chats = await ctx.db.query("chats").collect();
    const byNumber: Record<string, number> = {};
    let total = 0;

    for (const chat of chats) {
      const unread = chat.unreadCount || 0;
      total += unread;
      const key = chat.phoneNumberId || "unassigned";
      byNumber[key] = (byNumber[key] || 0) + unread;
    }

    return { total, byNumber };
  },
});

export const getChat = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.chatId);
  },
});

export const getMessages = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .order("asc")
      .collect();

    return Promise.all(
      messages.map(async (msg) => {
        let mediaUrl = undefined;
        if (msg.storageId) {
          mediaUrl = await ctx.storage.getUrl(msg.storageId);
        }
        return { ...msg, mediaUrl };
      })
    );
  },
});

export const getMessagesPage = query({
  args: { chatId: v.id("chats"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const paginationResult = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .order("desc")
      .paginate(args.paginationOpts);

    const page = await Promise.all(
      paginationResult.page.map(async (msg) => {
        let mediaUrl = undefined;
        if (msg.storageId) {
          mediaUrl = await ctx.storage.getUrl(msg.storageId);
        }

        let replyTo = undefined;
        if (msg.replyTo) {
          const repliedMessage = await ctx.db.get(msg.replyTo);
          if (repliedMessage) {
            replyTo = {
              _id: repliedMessage._id,
              type: repliedMessage.type,
              content: repliedMessage.content,
              direction: repliedMessage.direction,
            };
          }
        }

        return { ...msg, mediaUrl, replyTo };
      })
    );

    return { ...paginationResult, page };
  },
});

/**
 * Builds WhatsApp template components array from template definition.
 * Handles HEADER, BODY, and FOOTER components based on template structure.
 * Similar to processHeaderComponent in campaigns.ts but simplified for chat use.
 * 
 * Returns null if template is a carousel (requires special handling via action).
 */
function buildTemplateComponents(template: any): any[] | null {
  const components: any[] = [];

  if (!template || !template.components) {
    return components;
  }

  // Check for CAROUSEL, PRODUCT_CAROUSEL, or CATALOG templates
  // These require special handling with media uploads
  const hasCarousel = template.components.some((c: any) =>
    c.type === "CAROUSEL" || c.type === "carousel" ||
    c.type === "PRODUCT_CAROUSEL" || c.type === "product_carousel" ||
    c.type === "CATALOG" || c.type === "catalog"
  );

  if (hasCarousel) {
    // Carousel templates require special handling with media uploads
    // Return null to signal that this needs to be handled by buildAndSendCarouselTemplate
    return null;
  }

  // Process standard template components
  for (const comp of template.components) {
    // Process HEADER component
    if (comp.type === "HEADER" || comp.type === "header") {
      if (comp.format === "IMAGE") {
        const link = comp.example?.header_handle?.[0] || comp.example?.header_url?.[0] || "https://placehold.co/600x400.png";
        components.push({
          type: "header",
          parameters: [{ type: "image", image: { link } }]
        });
      } else if (comp.format === "VIDEO") {
        const link = comp.example?.header_handle?.[0] || comp.example?.header_url?.[0] || "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4";
        components.push({
          type: "header",
          parameters: [{ type: "video", video: { link } }]
        });
      } else if (comp.format === "DOCUMENT") {
        const link = comp.example?.header_handle?.[0] || comp.example?.header_url?.[0] || "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
        components.push({
          type: "header",
          parameters: [{ type: "document", document: { link, filename: "document.pdf" } }]
        });
      } else if (comp.format === "TEXT") {
        // Check if header has variables
        const hasVariables = comp.text?.includes("{{") ||
          (comp.example?.header_text && comp.example.header_text.length > 0);

        if (hasVariables && comp.example?.header_text && comp.example.header_text.length > 0) {
          // Header has variables - include parameters
          components.push({
            type: "header",
            parameters: comp.example.header_text.map((text: string) => ({ type: "text", text }))
          });
        } else {
          // Static text header - include header WITHOUT parameters field
          // WhatsApp API: if header has no variables, don't include parameters at all
          components.push({
            type: "header"
            // No parameters field for static headers
          });
        }
      }
    } else if (comp.type === "BODY" || comp.type === "body") {
      const hasVariables = comp.text?.includes("{{") || (comp.example?.body_text && comp.example.body_text.length > 0);
      if (hasVariables && comp.example?.body_text) {
        const texts = (comp.example.body_text as (string | string[])[]).flat().map((t: string | string[]) => (Array.isArray(t) ? t[0] : t));
        const parameters = texts.map((text: string) => ({ type: "text" as const, text: text || "1" }));
        components.push({ type: "body", parameters });
      }
    } else if (comp.type === "BUTTONS" || comp.type === "buttons") {
      const buttons = comp.buttons as { type?: string; url?: string; example?: string[] }[] | undefined;
      if (Array.isArray(buttons)) {
        buttons.forEach((btn: any, idx: number) => {
          const hasVariable = btn.url?.includes("{{") || (btn.example && btn.example.length > 0);
          if (!hasVariable) return;
          const subType = (btn.type === "URL" || btn.type === "url") ? "url" : (btn.type === "COPY_CODE" || btn.type === "copy_code") ? "copy_code" : "url";
          let paramText = "1";
          if (btn.example && btn.example[0]) {
            const ex = String(btn.example[0]);
            const codeMatch = ex.match(/code=([^&\s]+)/i);
            paramText = codeMatch ? codeMatch[1] : ex;
          }
          components.push({
            type: "button",
            sub_type: subType,
            index: idx,
            parameters: [{ type: "text" as const, text: paramText }]
          });
        });
      }
    }
  }

  // After constructing components array, check if we missed any HEADER components
  if (components.length === 0) {
    // Only check for headers in non-carousel templates (carousels are handled separately)
    const hasHeader = template.components?.some((c: any) =>
      (c.type === "HEADER" || c.type === "header")
    );

    if (hasHeader) {
      console.warn(`[Chat] Template has HEADER but no header component was added. Template components:`,
        JSON.stringify(template.components, null, 2));
      // Try to add a default header without parameters for static headers
      components.push({
        type: "header"
        // No parameters field for static headers
      });
    }
  }

  return components;
}

// Send Message Flow
export const sendMessage = mutation({
  args: {
    chatId: v.id("chats"),
    content: v.string(),
    type: v.string(),
    mediaId: v.optional(v.string()),
    storageId: v.optional(v.string()),
    replyTo: v.optional(v.id("messages")),
    template: v.optional(v.object({
      name: v.string(),
      language: v.string(),
      components: v.optional(v.any()),
    })),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get(args.chatId);
    if (!chat) throw new Error("Chat not found");

    const now = Date.now();
    const storedContent = args.type === "template" ? (args.template?.name ?? args.content) : args.content;

    const messageId = await ctx.db.insert("messages", {
      chatId: args.chatId,
      direction: "outbound",
      type: args.type as any,
      content: storedContent,
      mediaId: args.mediaId,
      storageId: args.storageId,
      status: "sent",
      timestamp: now,
      replyTo: args.replyTo,
    });

    let payloadContent: any;

    if (args.type === "text") {
      payloadContent = { body: args.content };
    } else if (args.type === "template") {
      if (chat.phoneNumberId) {
        const number = await ctx.runQuery(internal.whatsappNumbers.getByBusinessNumberId, {
          businessNumberId: chat.phoneNumberId,
        });
        if (number?.tokenStatus === "auth_failed") {
          await ctx.db.patch(messageId, { status: "failed" });
          throw new Error(
            "[INVALID_TEMPLATE_PRECHECK] Cannot send template for this number until WhatsApp token is reconnected in Integrations."
          );
        }
      }
      const requestedLanguage = args.template?.language;
      const resolved: any = await ctx.runQuery(internal.templates.resolveTemplateForSend, {
        templateName: args.template!.name,
        phoneNumberId: chat.phoneNumberId ?? undefined,
        requestedLanguage,
        allowFallback: false,
        requireScoped: true,
      });

      if (!resolved.ok) {
        const diagnostic = {
          templateName: args.template!.name,
          requestedLanguage: requestedLanguage ?? null,
          approvedLanguage: null,
          resolvedPhoneNumberId: chat.phoneNumberId ?? null,
          reasonCode: resolved.reasonCode,
          resolutionMode: resolved.resolutionMode ?? null,
        };
        console.error("[INVALID_TEMPLATE_PRECHECK][Chat] Blocking template send", diagnostic);
        await ctx.db.patch(messageId, { status: "failed" });
        throw new Error(`[INVALID_TEMPLATE_PRECHECK] ${resolved.message}`);
      }
      if (resolved.resolutionMode !== "scoped_exact") {
        console.warn("[Chat] Template resolved using fallback", {
          templateName: args.template!.name,
          requestedLanguage: requestedLanguage ?? null,
          approvedLanguage: resolved.selected?.language ?? null,
          resolvedPhoneNumberId: chat.phoneNumberId ?? null,
          reasonCode: "FALLBACK_USED",
          resolutionMode: resolved.resolutionMode,
        });
      }

      // Fetch template from database to get its structure
      const template = await ctx.runQuery(api.templates.getById, {
        id: resolved.selected.templateId,
      });

      if (!template) {
        throw new Error(`Template not found after resolution: ${args.template!.name}`);
      }

      if (template.status !== "APPROVED") {
        console.warn(`[Chat] Template ${template.name} status is ${template.status}, may fail to send`);
      }

      // Check if this is a carousel template that needs special handling
      const carouselComp = template.components?.find((c: any) =>
        c.type === "CAROUSEL" || c.type === "carousel"
      );

      if (carouselComp && carouselComp.cards) {
        // Check if carousel has header handles that need media upload
        let cardsHaveHeaderHandles = false;
        for (const card of carouselComp.cards) {
          if (card.components) {
            for (const cardComp of card.components) {
              if (cardComp.type === "HEADER" && cardComp.example?.header_handle) {
                cardsHaveHeaderHandles = true;
                break;
              }
            }
          }
          if (cardsHaveHeaderHandles) break;
        }

        // If carousel has header handles, use special action to upload media and send
        if (cardsHaveHeaderHandles) {
          console.log(`[Chat] Carousel template with header handles detected, using buildAndSendCarouselTemplate action`);
          await ctx.scheduler.runAfter(0, internal.chat.buildAndSendCarouselTemplate, {
            messageId: messageId,
            to: chat.contactPhone,
            templateName: resolved.selected.name,
            language: resolved.selected.language,
            template: template,
            phoneNumberId: chat.phoneNumberId ?? undefined,
          });

          // Update chat and return early (message will be sent by the action)
          await ctx.db.patch(args.chatId, {
            lastMessageTime: now,
            status: "active",
          });
          return;
        }
      }

      // Build components based on template definition
      const components = buildTemplateComponents(template);

      // If buildTemplateComponents returned null, it means carousel without headers
      // For static carousels, we can send empty components
      if (components === null) {
        payloadContent = {
          name: resolved.selected.name,
          language: { code: resolved.selected.language },
          components: [],
        };
      } else {
        payloadContent = {
          name: resolved.selected.name,
          language: { code: resolved.selected.language },
          components: components,
        };
      }
    } else if (args.type === "audio") {
      // Audio messages don't support captions in WhatsApp API
      payloadContent = { id: args.mediaId };
    } else if (args.type === "image" || args.type === "video") {
      // Image and video support captions
      payloadContent = { id: args.mediaId, caption: args.content || "" };
    } else {
      // Document and other media types
      payloadContent = { id: args.mediaId };
    }

    // Send via WhatsApp API Action
    if (process.env.CHAT_DEBUG_LOGS === "1") {
      console.log(`[Chat] Scheduling WhatsApp send for msg ${messageId} to ${chat.contactPhone}`);
    }
    const patchChatPromise = ctx.db.patch(args.chatId, {
      lastMessageTime: now,
      status: "active",
    });

    const schedulePromise = ctx.scheduler.runAfter(0, api.whatsapp.sendMessage, {
      to: chat.contactPhone,
      type: args.type,
      content: payloadContent,
      messageId: messageId,
      phoneNumberId: chat.phoneNumberId ?? undefined,
    }).catch(async (e) => {
      console.error(`[Chat] Failed to schedule WhatsApp send: ${e}`);
      await ctx.db.patch(messageId, { status: "failed" });
    });

    await Promise.all([patchChatPromise, schedulePromise]);
  },
});

/**
 * Internal action to build and send carousel templates with proper media handling.
 * This handles carousel templates that have header handles requiring media uploads.
 * Similar to carousel handling in campaigns.ts.
 */
export const buildAndSendCarouselTemplate = internalAction({
  args: {
    messageId: v.id("messages"),
    to: v.string(),
    templateName: v.string(),
    language: v.string(),
    template: v.any(),
    phoneNumberId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<any> => {
    try {
      if (args.phoneNumberId) {
        const number = await ctx.runQuery(internal.whatsappNumbers.getByBusinessNumberId, {
          businessNumberId: args.phoneNumberId,
        });
        if (number?.tokenStatus === "auth_failed") {
          await ctx.runMutation(internal.chat.updateMessageStatusDirect, {
            messageId: args.messageId,
            status: "failed",
          });
          throw new Error(
            "[INVALID_TEMPLATE_PRECHECK] Cannot send carousel template for this number until WhatsApp token is reconnected in Integrations."
          );
        }
      }
      const resolved: any = await ctx.runQuery(internal.templates.resolveTemplateForSend, {
        templateName: args.templateName,
        phoneNumberId: args.phoneNumberId,
        requestedLanguage: args.language,
        allowFallback: false,
        requireScoped: true,
      });
      if (!resolved.ok) {
        const diagnostic = {
          templateName: args.templateName,
          requestedLanguage: args.language ?? null,
          approvedLanguage: null,
          resolvedPhoneNumberId: args.phoneNumberId ?? null,
          reasonCode: resolved.reasonCode,
          resolutionMode: resolved.resolutionMode ?? null,
        };
        console.error("[INVALID_TEMPLATE_PRECHECK][Chat][Carousel] Blocking template send", diagnostic);
        await ctx.runMutation(internal.chat.updateMessageStatusDirect, {
          messageId: args.messageId,
          status: "failed",
        });
        throw new Error(`[INVALID_TEMPLATE_PRECHECK] ${resolved.message}`);
      }
      if (resolved.resolutionMode !== "scoped_exact") {
        console.warn("[Chat] Carousel template resolved using fallback", {
          templateName: args.templateName,
          requestedLanguage: args.language ?? null,
          approvedLanguage: resolved.selected?.language ?? null,
          resolvedPhoneNumberId: args.phoneNumberId ?? null,
          reasonCode: "FALLBACK_USED",
          resolutionMode: resolved.resolutionMode,
        });
      }

      const template = await ctx.runQuery(api.templates.getById, {
        id: resolved.selected.templateId,
      });
      if (!template) {
        throw new Error(`Template not found after resolution: ${args.templateName}`);
      }
      const carouselComp = template.components?.find((c: any) =>
        c.type === "CAROUSEL" || c.type === "carousel"
      );

      if (!carouselComp || !carouselComp.cards) {
        throw new Error("Carousel component not found in template");
      }

      console.log(`[Chat] Processing CAROUSEL template with ${carouselComp.cards.length} cards`);

      // Check if template body has variables
      const bodyComp = template.components.find((c: any) =>
        c.type === "BODY" || c.type === "body"
      );
      const bodyHasVariables = bodyComp?.text?.includes("{{");

      // Check if any card components have variables or require parameters
      let cardsHaveHeaderHandles = false;
      let cardsHaveVariables = false;

      for (const card of carouselComp.cards) {
        if (card.components) {
          for (const cardComp of card.components) {
            // Check for headers with example.header_handle
            if (cardComp.type === "HEADER" && cardComp.example?.header_handle) {
              cardsHaveHeaderHandles = true;
            }
            // Check body text for variables
            if (cardComp.type === "BODY" && cardComp.text?.includes("{{")) {
              cardsHaveVariables = true;
            }
            // Check button URLs for variables
            if (cardComp.type === "BUTTONS" && cardComp.buttons) {
              for (const btn of cardComp.buttons) {
                if (btn.url?.includes("{{") || btn.example) {
                  cardsHaveVariables = true;
                  break;
                }
              }
            }
          }
        }
        // Early exit if we found both
        if (cardsHaveHeaderHandles && cardsHaveVariables) break;
      }

      console.log(`[Chat] CAROUSEL analysis:`, {
        bodyHasVariables,
        cardsHaveHeaderHandles,
        cardsHaveVariables
      });

      const components: any[] = [];

      // IMPORTANT: WhatsApp carousel templates REQUIRE header parameters for each card.
      // We cannot send empty components or skip headers.
      // 
      // The header_handle URLs stored in templates are temporary and expire (403 Forbidden).
      // We need to upload the media to WhatsApp and get fresh media IDs before sending.

      if (cardsHaveHeaderHandles) {
        console.log(`[Chat] CAROUSEL has ${carouselComp.cards.length} cards with media headers - uploading to get media IDs`);

        // Upload media for each card header and collect media IDs
        const mediaIds: (string | null)[] = [];

        for (let i = 0; i < carouselComp.cards.length; i++) {
          const card = carouselComp.cards[i];
          const headerComp = card.components?.find((c: any) =>
            c.type === "HEADER" || c.type === "header"
          );

          if (headerComp?.example?.header_handle?.[0]) {
            const headerUrl = headerComp.example.header_handle[0];
            const headerFormat = (headerComp.format || "IMAGE").toLowerCase();

            console.log(`[Chat] Card ${i}: Uploading ${headerFormat} from header_handle...`);

            try {
              // Upload media to WhatsApp and get a media ID
              const mediaId = await ctx.runAction(api.whatsapp.uploadMediaFromUrl, {
                url: headerUrl,
                type: headerFormat,
                phoneNumberId: args.phoneNumberId,
              });
              mediaIds.push(mediaId);
              console.log(`[Chat] Card ${i}: Got media ID: ${mediaId}`);
            } catch (uploadError) {
              console.error(`[Chat] Card ${i}: Failed to upload media:`, uploadError);
              // Store null - we'll handle this error below
              mediaIds.push(null);
            }
          } else {
            mediaIds.push(null);
          }
        }

        // Check if any uploads failed
        const failedUploads = mediaIds.filter(id => id === null).length;
        if (failedUploads > 0) {
          const errorMsg = `Failed to upload ${failedUploads} media items for carousel. The template media URLs may have expired. Please edit the template and re-upload the images.`;
          console.error(`[Chat] ${failedUploads}/${mediaIds.length} media uploads failed - header_handle URLs may be expired`);

          // Update message status to failed
          await ctx.runMutation(internal.chat.updateMessageStatusDirect, {
            messageId: args.messageId,
            status: "failed",
          });

          throw new Error(errorMsg);
        }

        // Build carousel cards with media IDs
        const carouselCards = carouselComp.cards.map((card: any, index: number) => {
          const cardComponents: any[] = [];
          const headerComp = card.components?.find((c: any) =>
            c.type === "HEADER" || c.type === "header"
          );

          // Add header with media ID
          if (mediaIds[index]) {
            const headerFormat = (headerComp?.format || "IMAGE").toLowerCase();
            const headerParam: any = { type: headerFormat };

            if (headerFormat === "image") {
              headerParam.image = { id: mediaIds[index] };
            } else if (headerFormat === "video") {
              headerParam.video = { id: mediaIds[index] };
            } else {
              // Fallback to image
              headerParam.image = { id: mediaIds[index] };
            }

            cardComponents.push({
              type: "header",
              parameters: [headerParam]
            });
          }

          // Process body if it has variables (TODO: implement variable substitution)
          const cardBodyComp = card.components?.find((c: any) =>
            c.type === "BODY" || c.type === "body"
          );
          if (cardBodyComp && cardBodyComp.text?.includes("{{")) {
            console.log(`[Chat] Card ${index} body has variables - needs implementation`);
          }

          // Process buttons if they have variables (TODO: implement)
          const buttonsComp = card.components?.find((c: any) =>
            c.type === "BUTTONS" || c.type === "buttons"
          );
          if (buttonsComp?.buttons) {
            const hasButtonVariables = buttonsComp.buttons.some((btn: any) =>
              btn.url?.includes("{{") || btn.example
            );
            if (hasButtonVariables) {
              console.log(`[Chat] Card ${index} buttons have variables - needs implementation`);
            }
          }

          return {
            card_index: index,
            components: cardComponents
          };
        });

        // Add body component if main body has variables
        if (bodyHasVariables) {
          console.log(`[Chat] CAROUSEL template body has variables - needs implementation`);
        }

        // Add carousel component
        components.push({
          type: "carousel",
          cards: carouselCards
        });

        console.log(`[Chat] Constructed carousel with ${carouselCards.length} cards using media IDs`);
      } else {
        // Carousel without media headers - just handle variables if any
        console.log(`[Chat] CAROUSEL without media headers - processing variables only`);

        if (bodyHasVariables || cardsHaveVariables) {
          const carouselCards = carouselComp.cards.map((card: any, index: number) => {
            const cardComponents: any[] = [];

            // Process body if it has variables
            const cardBodyComp = card.components?.find((c: any) =>
              c.type === "BODY" || c.type === "body"
            );
            if (cardBodyComp && cardBodyComp.text?.includes("{{")) {
              console.log(`[Chat] Card ${index} body has variables - needs implementation`);
            }

            return {
              card_index: index,
              components: cardComponents
            };
          });

          components.push({
            type: "carousel",
            cards: carouselCards
          });
        }
        // If no headers and no variables, empty components array is OK
      }

      // Send the message with built components
      const payloadContent = {
        name: resolved.selected.name,
        language: { code: resolved.selected.language },
        components: components,
      };

      console.log(`[Chat] Sending carousel template with ${components.length} component(s)`);
      const result: any = await ctx.runAction(api.whatsapp.sendMessage, {
        to: args.to,
        type: "template",
        content: payloadContent,
        messageId: args.messageId,
        phoneNumberId: args.phoneNumberId,
      });

      console.log(`[Chat] Carousel template sent successfully`);
      return result;
    } catch (error) {
      console.error(`[Chat] Failed to build and send carousel template:`, error);

      // Update message status to failed
      try {
        await ctx.runMutation(internal.chat.updateMessageStatusDirect, {
          messageId: args.messageId,
          status: "failed",
        });
      } catch (updateError) {
        console.error(`[Chat] Failed to update message status:`, updateError);
      }

      throw error;
    }
  },
});

/**
 * @deprecated Webhook now uses messages.saveMessage instead. This uses contactId-based chat lookup
 * and does not support phoneNumberId. Kept for reference; safe to remove if no external callers exist.
 */
export const saveIncomingMessage = internalMutation({
  args: {
    contactId: v.string(),
    contactName: v.string(),
    messageType: v.string(),
    content: v.string(),
    mediaId: v.optional(v.string()),
    storageId: v.optional(v.string()),
    timestamp: v.number(),
    metaMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Sync Contact
    let contact = await ctx.db
      .query("contacts")
      .withIndex("by_phone", (q) => q.eq("phone", args.contactId))
      .first();

    if (!contact) {
      // Create new contact if doesn't exist
      await ctx.db.insert("contacts", {
        name: args.contactName,
        phone: args.contactId,
        isSubscribed: true,
        createdAt: Date.now(),
      });
    }

    // 2. Find or Create Chat
    const chat = await ctx.db
      .query("chats")
      .filter((q: any) => q.eq(q.field("contactId"), args.contactId))
      .first();

    let chatId;
    if (!chat) {
      chatId = await ctx.db.insert("chats", {
        contactId: args.contactId,
        contactName: args.contactName,
        contactPhone: args.contactId,
        lastMessageTime: args.timestamp,
        unreadCount: 1,
        status: "active",
        aiMode: true, // Default to enabled
      });
    } else {
      chatId = chat._id;
      await ctx.db.patch(chatId, {
        lastMessageTime: args.timestamp,
        unreadCount: chat.unreadCount + 1,
      });
    }

    if (args.mediaId && !args.storageId) {
      // Schedule media hydration
      // We can't use runAfter inside a mutation if we don't have the ID yet, 
      // but we do insert it below. 
      // We'll handle scheduling AFTER insertion.
    }

    // 4. Insert Message
    const messageId = await ctx.db.insert("messages", {
      chatId,
      direction: "inbound",
      type: args.messageType as any,
      content: args.content,
      mediaId: args.mediaId,
      storageId: args.storageId,
      status: "delivered",
      timestamp: args.timestamp,
      metaMessageId: args.metaMessageId,
    });

    // If we scheduled hydration, we need to pass the real message ID if possible, 
    // but runAfter arguments are serialized. 
    // Let's create a separate action for hydration that takes the messageId.
    if (args.mediaId && !args.storageId) {
      await ctx.scheduler.runAfter(0, internal.chat.hydrateMedia, {
        messageId,
        mediaId: args.mediaId
      });
    }

    // 5. Legacy path: notify humans only when chat is already in human mode.
    try {
      const chatDoc = await ctx.db.get(chatId);
      const needsHumanAttention = chatDoc?.aiMode === false;
      if (needsHumanAttention) {
        const notifTitle = args.contactName || args.contactId;
        const notifBody =
          args.messageType === "text"
            ? args.content
            : `New ${args.messageType} message while awaiting human reply`;
        await ctx.scheduler.runAfter(0, (internal as any).notifications.sendHumanEscalationPush, {
          chatId,
          title: notifTitle,
          body: notifBody,
          phoneNumberId: chatDoc?.phoneNumberId,
        });
      }
    } catch (e) {
      console.error("Failed to send push notifications:", e);
    }
  },
});

/**
 * @deprecated Only used by saveIncomingMessage (deprecated). Webhook uses whatsapp.hydrateIncomingMedia
 * which passes phoneNumberId. This calls getMediaUrl without phoneNumberId.
 */
export const hydrateMedia = internalAction({
  args: { messageId: v.id("messages"), mediaId: v.string() },
  handler: async (ctx, args) => {
    try {
      // 1. Get Download URL from Meta (legacy: no phoneNumberId)
      const url = await ctx.runAction(api.whatsapp.getMediaUrl, { mediaId: args.mediaId });

      // 2. Download File
      const response = await fetch(url);
      const blob = await response.blob();

      // 3. Upload to Convex Storage
      const storageId = await ctx.storage.store(blob);

      // 4. Update Message with Storage ID
      await ctx.runMutation(internal.chat.updateMessageStorageId, {
        messageId: args.messageId,
        storageId: storageId
      });
    } catch (e) {
      console.error("Failed to hydrate media:", e);
    }
  }
});

export const updateMessageStorageId = internalMutation({
  args: { messageId: v.id("messages"), storageId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, { storageId: args.storageId });
  }
});

export const markAsRead = mutation({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get(args.chatId);
    if (!chat) return;

    // Reset unread count
    await ctx.db.patch(args.chatId, { unreadCount: 0 });

    // Mark messages as read
    const unreadMessages = await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .filter(q => q.and(
        q.eq(q.field("direction"), "inbound"),
        q.neq(q.field("status"), "read")
      ))
      .collect();

    for (const msg of unreadMessages) {
      await ctx.db.patch(msg._id, { status: "read" });
    }

    // Sync to WhatsApp (Mark as read in Meta)
    if (unreadMessages.length > 0) {
      const topMsg = unreadMessages[unreadMessages.length - 1];
      if (topMsg.metaMessageId) {
        await ctx.scheduler.runAfter(0, api.whatsapp.markAsRead, {
          messageId: topMsg.metaMessageId,
          phoneNumberId: chat.phoneNumberId ?? undefined,
        });
      }
    }
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

    if (!message) {
      return false; // Message not found
    }

    await ctx.db.patch(message._id, {
      status: args.status as any,
    });

    return true; // Success
  },
});

export const updateMessageMetaId = internalMutation({
  args: {
    messageId: v.id("messages"),
    metaMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      metaMessageId: args.metaMessageId,
    });
  },
});

export const updateMessageStatusDirect = internalMutation({
  args: {
    messageId: v.id("messages"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      status: args.status as any,
    });
  },
});

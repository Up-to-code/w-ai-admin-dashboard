import { v } from "convex/values";
import { action, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

type CountRow = {
  scanned: number;
  imported: number;
  updated: number;
  skipped: number;
};

type ImportSummary = Record<string, CountRow>;

const ADMIN_TABLES = [
  "admin_users",
  "admin_whatsapp_numbers",
  "admin_contacts",
  "admin_chats",
  "admin_messages",
  "admin_templates",
  "admin_template_store",
  "admin_campaigns",
  "admin_campaign_logs",
  "admin_workflows",
  "admin_notifications",
  "admin_ai_configs",
  "admin_product_categories",
  "admin_manual_products",
  "admin_webhook_settings",
  "admin_files",
] as const;
const internalApi = internal as any;

function countRow(scanned = 0): CountRow {
  return { scanned, imported: 0, updated: 0, skipped: 0 };
}

async function clearTable(ctx: any, tableName: (typeof ADMIN_TABLES)[number]) {
  const docs = await ctx.db.query(tableName).collect();
  for (const doc of docs) {
    await ctx.db.delete(doc._id);
  }
}

export const importFromExisting = action({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    const dryRun = args.dryRun ?? false;

    try {
      const summary = await ctx.runMutation(internalApi.admin_seed.importFromExistingInternal, { dryRun });
      const finishedAt = Date.now();

      const runId = await ctx.runMutation(internalApi.admin_seed.recordImportRunInternal, {
        status: dryRun ? "dry_run" : "success",
        summary,
        startedAt,
        finishedAt,
        durationMs: finishedAt - startedAt,
      });

      return {
        ok: true,
        runId,
        dryRun,
        summary,
        startedAt,
        finishedAt,
      };
    } catch (error) {
      const finishedAt = Date.now();
      const message = error instanceof Error ? error.message : String(error);

      await ctx.runMutation(internalApi.admin_seed.recordImportRunInternal, {
        status: "failed",
        summary: {},
        startedAt,
        finishedAt,
        durationMs: finishedAt - startedAt,
        error: message,
      });

      throw error;
    }
  },
});

export const importFromExistingInternal = internalMutation({
  args: {
    dryRun: v.boolean(),
  },
  handler: async (ctx, args): Promise<ImportSummary> => {
    const now = Date.now();

    const [
      users,
      whatsappNumbers,
      contacts,
      chats,
      messages,
      templates,
      templateStore,
      campaigns,
      campaignLogs,
      workflows,
      notifications,
      aiConfigs,
      categories,
      manualProducts,
      webhookSettings,
      files,
    ] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("whatsapp_numbers").collect(),
      ctx.db.query("contacts").collect(),
      ctx.db.query("chats").collect(),
      ctx.db.query("messages").collect(),
      ctx.db.query("templates").collect(),
      ctx.db.query("template_store").collect(),
      ctx.db.query("campaigns").collect(),
      ctx.db.query("campaign_logs").collect(),
      ctx.db.query("workflows").collect(),
      ctx.db.query("notifications").collect(),
      ctx.db.query("ai_configs").collect(),
      ctx.db.query("product_categories").collect(),
      ctx.db.query("manual_products").collect(),
      ctx.db.query("webhook_settings").collect(),
      ctx.db.query("files").collect(),
    ]);

    const summary: ImportSummary = {
      users: countRow(users.length),
      whatsapp_numbers: countRow(whatsappNumbers.length),
      contacts: countRow(contacts.length),
      chats: countRow(chats.length),
      messages: countRow(messages.length),
      templates: countRow(templates.length),
      template_store: countRow(templateStore.length),
      campaigns: countRow(campaigns.length),
      campaign_logs: countRow(campaignLogs.length),
      workflows: countRow(workflows.length),
      notifications: countRow(notifications.length),
      ai_configs: countRow(aiConfigs.length),
      product_categories: countRow(categories.length),
      manual_products: countRow(manualProducts.length),
      webhook_settings: countRow(webhookSettings.length),
      files: countRow(files.length),
    };

    if (args.dryRun) {
      return summary;
    }

    for (const tableName of ADMIN_TABLES) {
      await clearTable(ctx, tableName);
    }

    const userMap: Record<string, string> = {};
    const chatMap: Record<string, string> = {};
    const templateMap: Record<string, string> = {};
    const campaignMap: Record<string, string> = {};
    const contactMap: Record<string, string> = {};
    const categoryMap: Record<string, string> = {};

    for (const doc of users) {
      const insertedId = await ctx.db.insert("admin_users", {
        name: doc.name,
        email: doc.email,
        phone: doc.phone,
        role: doc.role,
        tokenIdentifier: doc.tokenIdentifier,
        password: doc.password,
        createdAt: now,
        updatedAt: now,
      });
      userMap[String(doc._id)] = String(insertedId);
      summary.users.imported += 1;
    }

    for (const doc of whatsappNumbers) {
      await ctx.db.insert("admin_whatsapp_numbers", {
        businessAccountId: doc.businessAccountId,
        businessNumberId: doc.businessNumberId,
        phone: doc.phone,
        name: doc.name,
        accessToken: doc.accessToken,
        tokenStatus: doc.tokenStatus,
        lastAuthErrorCode: doc.lastAuthErrorCode,
        lastAuthErrorMessage: doc.lastAuthErrorMessage,
        lastAuthErrorAt: doc.lastAuthErrorAt,
        isActive: true,
        createdAt: doc.createdAt,
        updatedAt: doc.createdAt,
      });
      summary.whatsapp_numbers.imported += 1;
    }

    for (const doc of contacts) {
      const insertedId = await ctx.db.insert("admin_contacts", {
        name: doc.name,
        phone: doc.phone,
        email: doc.email,
        tags: doc.tags,
        isSubscribed: doc.isSubscribed,
        lastMessagedAt: doc.lastMessagedAt,
        lastMessagedTemplate: doc.lastMessagedTemplate,
        createdAt: doc.createdAt,
        updatedAt: doc.createdAt,
      });
      contactMap[String(doc._id)] = String(insertedId);
      summary.contacts.imported += 1;
    }

    for (const doc of chats) {
      const chat = doc as any;
      const insertedId = await ctx.db.insert("admin_chats", {
        contactId: chat.contactId,
        contactName: chat.contactName,
        contactPhone: chat.contactPhone,
        phoneNumberId: chat.phoneNumberId,
        lastMessage: chat.lastMessage,
        lastMessageTime: chat.lastMessageTime,
        unreadCount: chat.unreadCount,
        status: chat.status,
        aiMode: chat.aiMode,
        assignedTo: chat.assignedTo ? (userMap[String(chat.assignedTo)] as any) : undefined,
        createdAt: chat.lastMessageTime,
        updatedAt: chat.lastMessageTime,
      });
      chatMap[String(doc._id)] = String(insertedId);
      summary.chats.imported += 1;
    }

    for (const doc of messages) {
      const chatId = chatMap[String(doc.chatId)];
      if (!chatId) {
        summary.messages.skipped += 1;
        continue;
      }

      await ctx.db.insert("admin_messages", {
        chatId: chatId as any,
        direction: doc.direction,
        type: doc.type,
        content: doc.content,
        mediaId: doc.mediaId,
        storageId: doc.storageId,
        status: doc.status,
        timestamp: doc.timestamp,
        metaMessageId: doc.metaMessageId,
        createdAt: doc.timestamp,
      });
      summary.messages.imported += 1;
    }

    for (const doc of templates) {
      const insertedId = await ctx.db.insert("admin_templates", {
        phoneNumberId: doc.phoneNumberId,
        name: doc.name,
        language: doc.language,
        category: doc.category,
        content: doc.content,
        components: doc.components,
        status: doc.status,
        metaTemplateId: doc.metaTemplateId,
        lastSyncedAt: doc.lastSyncedAt,
        createdAt: doc.lastSyncedAt,
        updatedAt: doc.lastSyncedAt,
      });
      templateMap[String(doc._id)] = String(insertedId);
      summary.templates.imported += 1;
    }

    for (const doc of templateStore) {
      await ctx.db.insert("admin_template_store", {
        name: doc.name,
        language: doc.language,
        category: doc.category,
        components: doc.components,
        description: doc.description,
        tags: doc.tags,
        isDefault: doc.isDefault,
        formSnapshot: doc.formSnapshot,
        createdAt: doc.createdAt ?? now,
        updatedAt: now,
      });
      summary.template_store.imported += 1;
    }

    for (const doc of campaigns) {
      const templateId = templateMap[String(doc.templateId)];
      if (!templateId) {
        summary.campaigns.skipped += 1;
        continue;
      }

      const targetContactIds = (doc.targetContactIds ?? [])
        .map((contactId) => contactMap[String(contactId)])
        .filter(Boolean) as any[];

      const insertedId = await ctx.db.insert("admin_campaigns", {
        name: doc.name,
        templateId: templateId as any,
        templateName: doc.templateName,
        templateLanguage: doc.templateLanguage,
        phoneNumberId: doc.phoneNumberId,
        status: doc.status,
        scheduledAt: doc.scheduledAt,
        recurrenceCronSpec: doc.recurrenceCronSpec,
        segmentId: doc.segmentId ? String(doc.segmentId) : undefined,
        targetTags: doc.targetTags,
        targetContactIds,
        isTestCampaign: doc.isTestCampaign,
        testBypassRecentContact: doc.testBypassRecentContact,
        testContactPhones: doc.testContactPhones,
        stats: {
          total: doc.stats.total,
          sent: doc.stats.sent,
          delivered: doc.stats.delivered,
          read: doc.stats.read,
          failed: doc.stats.failed,
          skipped: doc.stats.skipped,
        },
        sendingConfig: doc.sendingConfig,
        createdAt: doc.createdAt,
        updatedAt: doc.createdAt,
      });

      campaignMap[String(doc._id)] = String(insertedId);
      summary.campaigns.imported += 1;
    }

    for (const doc of campaignLogs) {
      const campaignId = campaignMap[String(doc.campaignId)];
      const contactId = contactMap[String(doc.contactId)];

      if (!campaignId || !contactId) {
        summary.campaign_logs.skipped += 1;
        continue;
      }

      await ctx.db.insert("admin_campaign_logs", {
        campaignId: campaignId as any,
        contactId: contactId as any,
        status: doc.status,
        metaMessageId: doc.metaMessageId,
        error: doc.error,
        skipReason: doc.skipReason,
        createdAt: now,
      });
      summary.campaign_logs.imported += 1;
    }

    for (const doc of workflows) {
      await ctx.db.insert("admin_workflows", {
        phoneNumberId: doc.phoneNumberId,
        name: doc.name,
        trigger: doc.trigger,
        triggerConfig: doc.triggerConfig,
        action: doc.action,
        actionConfig: doc.actionConfig,
        enabled: doc.enabled,
        stats: doc.stats,
        createdAt: doc.createdAt,
        updatedAt: doc.createdAt,
      });
      summary.workflows.imported += 1;
    }

    for (const doc of notifications) {
      await ctx.db.insert("admin_notifications", {
        type: doc.type,
        title: doc.title,
        message: doc.message,
        read: doc.read,
        link: doc.link,
        createdAt: doc.createdAt,
      });
      summary.notifications.imported += 1;
    }

    for (const doc of aiConfigs) {
      await ctx.db.insert("admin_ai_configs", {
        phoneNumberId: doc.phoneNumberId,
        systemPrompt: doc.systemPrompt,
        model: doc.model,
        temperature: doc.temperature,
        isActive: doc.isActive,
        agentName: doc.agentName,
        toolsEnabled: doc.toolsEnabled,
        recommendProducts: doc.recommendProducts,
        manualCatalogEnabled: doc.manualCatalogEnabled,
        fallbackMode: doc.fallbackMode,
        updatedAt: doc.updatedAt,
      });
      summary.ai_configs.imported += 1;
    }

    for (const doc of categories) {
      const insertedId = await ctx.db.insert("admin_product_categories", {
        phoneNumberId: doc.phoneNumberId,
        name: doc.name,
        slug: doc.slug,
        description: doc.description,
        source: doc.source,
        isActive: doc.isActive,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      });
      categoryMap[String(doc._id)] = String(insertedId);
      summary.product_categories.imported += 1;
    }

    for (const doc of manualProducts) {
      await ctx.db.insert("admin_manual_products", {
        phoneNumberId: doc.phoneNumberId,
        title: doc.title,
        description: doc.description,
        images: doc.images,
        primaryImageUrl: doc.primaryImageUrl,
        categoryId: doc.categoryId ? (categoryMap[String(doc.categoryId)] as any) : undefined,
        categoryNameSnapshot: doc.categoryNameSnapshot,
        aiAdvice: doc.aiAdvice,
        aiSummary: doc.aiSummary,
        aiKeywords: doc.aiKeywords,
        isActive: doc.isActive,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      });
      summary.manual_products.imported += 1;
    }

    const latestWebhookSettings = webhookSettings.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (latestWebhookSettings) {
      await ctx.db.insert("admin_webhook_settings", {
        verifyToken: latestWebhookSettings.verifyToken,
        accessToken: latestWebhookSettings.accessToken,
        appId: latestWebhookSettings.appId,
        defaultPhoneNumberId: latestWebhookSettings.defaultPhoneNumberId,
        updatedAt: latestWebhookSettings.updatedAt,
      });
      summary.webhook_settings.imported += 1;
    }

    for (const doc of files) {
      await ctx.db.insert("admin_files", {
        storageId: doc.storageId,
        url: doc.url,
        name: doc.name,
        mimeType: doc.mimeType,
        size: doc.size,
        uploadedBy: doc.uploadedBy ? (userMap[String(doc.uploadedBy)] as any) : undefined,
        category: doc.category,
        whatsappMediaId: doc.whatsappMediaId,
        createdAt: doc.createdAt,
      });
      summary.files.imported += 1;
    }

    return summary;
  },
});

export const recordImportRunInternal = internalMutation({
  args: {
    status: v.union(v.literal("success"), v.literal("failed"), v.literal("dry_run")),
    summary: v.any(),
    startedAt: v.number(),
    finishedAt: v.number(),
    durationMs: v.number(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("admin_seed_runs", {
      status: args.status,
      summary: args.summary,
      startedAt: args.startedAt,
      finishedAt: args.finishedAt,
      durationMs: args.durationMs,
      error: args.error,
    });
  },
});

export const importStatus = query({
  args: {},
  handler: async (ctx) => {
    const latest = await ctx.db
      .query("admin_seed_runs")
      .withIndex("by_started_at")
      .order("desc")
      .first();

    return {
      hasRun: !!latest,
      latest,
    };
  },
});

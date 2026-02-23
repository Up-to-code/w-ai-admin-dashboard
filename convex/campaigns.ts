import { query, mutation, action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { retrier, crons } from "./index";
import { categorizeWhatsAppError } from "./errorUtils";
import { logDebug, logWarn, logError } from "./logging";

const INVALID_TEMPLATE_PRECHECK_PREFIX = "[INVALID_TEMPLATE_PRECHECK]";
const DEFAULT_INVALID_TEMPLATE_NAMES = ["tasees_day2"];
const MAX_TEST_CONTACT_PHONES = 5;

function normalizePhone(raw: string | null | undefined): string {
    return String(raw ?? "").replace(/[^\d+]/g, "");
}

// Shared args validator - single source of truth for campaign creation (includes test campaign fields)
const createCampaignArgs = {
    name: v.string(),
    templateId: v.id("templates"),
    templateName: v.string(),
    templateLanguage: v.optional(v.string()),
    phoneNumberId: v.optional(v.string()),
    isTestCampaign: v.optional(v.boolean()),
    testBypassRecentContact: v.optional(v.boolean()),
    testContactPhones: v.optional(v.array(v.string())),
    segmentId: v.optional(v.id("segments")),
    targetTags: v.optional(v.array(v.string())),
    targetContactIds: v.optional(v.array(v.id("contacts"))),
    scheduledAt: v.number(),
    recurrenceCronSpec: v.optional(v.string()),
    sendingConfig: v.optional(v.object({
        messagesPerSecond: v.number(),
        delayBetweenMessages: v.number(),
        maxRetries: v.number(),
        skipRecentlyContacted: v.boolean(),
        recentContactHours: v.number(),
    })),
};

// 1. Create a Campaign - delegates to createCampaignInternal
export const create = mutation({
    args: createCampaignArgs,
    handler: async (ctx, args): Promise<Id<"campaigns">> => {
        return await ctx.runMutation(internal.campaigns.createCampaignInternal, args);
    },
});

// Action that accepts full args including test campaign fields (same as create)
export const createWithTestConfig = action({
    args: createCampaignArgs,
    handler: async (ctx, args): Promise<Id<"campaigns">> => {
        return await ctx.runMutation(internal.campaigns.createCampaignInternal, args);
    },
});

export const createCampaignInternal = internalMutation({
    args: createCampaignArgs,
    handler: async (ctx, args) => {
        if (!args.phoneNumberId) {
            throw new Error("A sending number is required for scoped template campaigns.");
        }
        const isTestCampaign = args.isTestCampaign ?? false;
        const testBypassRecentContact = args.testBypassRecentContact ?? false;
        const testContactPhones = (args.testContactPhones ?? [])
            .map((phone) => normalizePhone(phone))
            .filter((phone) => phone.length > 0);

        if (!isTestCampaign && (testBypassRecentContact || testContactPhones.length > 0)) {
            throw new Error("Test bypass settings are only allowed when test campaign mode is enabled.");
        }
        if (testBypassRecentContact && testContactPhones.length === 0) {
            throw new Error("At least one test contact phone is required when bypass is enabled.");
        }
        if (testContactPhones.length > MAX_TEST_CONTACT_PHONES) {
            throw new Error(`Test contact phones cannot exceed ${MAX_TEST_CONTACT_PHONES}.`);
        }

        if (args.phoneNumberId) {
            const template = await ctx.db.get(args.templateId);
            if (!template) {
                throw new Error("Template not found. Please select a valid template.");
            }
            if (template.phoneNumberId !== args.phoneNumberId) {
                throw new Error(
                    `Template "${args.templateName}" is not available for the selected number. ` +
                    "Please select a template synced for this number, or change the sending number."
                );
            }
            if (template.status !== "APPROVED") {
                throw new Error(`Template "${args.templateName}" is not approved for sending.`);
            }
        }

        const id = await ctx.db.insert("campaigns", {
            name: args.name,
            templateId: args.templateId,
            templateName: args.templateName,
            templateLanguage: args.templateLanguage,
            phoneNumberId: args.phoneNumberId,
            isTestCampaign,
            testBypassRecentContact,
            testContactPhones: testContactPhones.length > 0 ? testContactPhones : undefined,
            segmentId: args.segmentId,
            targetTags: args.targetTags,
            targetContactIds: args.targetContactIds,
            status: "SCHEDULED",
            scheduledAt: args.scheduledAt,
            recurrenceCronSpec: args.recurrenceCronSpec,
            sendingConfig: args.sendingConfig,
            stats: { total: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
            createdAt: Date.now(),
        });

        if (args.recurrenceCronSpec) {
            await crons.register(
                ctx,
                { kind: "cron", cronspec: args.recurrenceCronSpec },
                internal.campaigns.startProcessing,
                { campaignId: id },
                `campaign-${id}`
            );
        }

        const delay = Math.max(0, args.scheduledAt - Date.now());
        if (delay > 0) {
            await ctx.scheduler.runAfter(delay, internal.campaigns.startProcessing, { campaignId: id });
        } else {
            await ctx.scheduler.runAfter(0, internal.campaigns.startProcessing, { campaignId: id });
        }

        return id;
    },
});

export const createQuickScopedCampaign = action({
    args: {
        phoneNumberId: v.string(),
    },
    handler: async (ctx, args): Promise<{ campaignId: string; templateName: string; language: string }> => {
        try {
            await ctx.runAction(api.templates.syncFromMeta, {
                phoneNumberId: args.phoneNumberId,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(
                `Cannot create quick campaign because scoped template sync is required and failed for this number. ${message}`
            );
        }

        const scopedTemplates = await ctx.runQuery(internal.campaigns.listApprovedTemplatesByPhone, {
            phoneNumberId: args.phoneNumberId,
        });
        const selectedTemplate = scopedTemplates[0];
        if (!selectedTemplate) {
            throw new Error("لا توجد قوالب معتمدة لهذا الرقم بعد المزامنة.");
        }

        const campaignId = await ctx.runMutation(internal.campaigns.insertQuickCampaignInternal, {
            name: `حملة سريعة ${new Date().toISOString().slice(0, 10)}`,
            templateId: selectedTemplate._id,
            templateName: selectedTemplate.name,
            templateLanguage: selectedTemplate.language,
            phoneNumberId: args.phoneNumberId,
            scheduledAt: Date.now(),
        });
        await ctx.scheduler.runAfter(0, internal.campaigns.startProcessing, { campaignId });

        return {
            campaignId: String(campaignId),
            templateName: selectedTemplate.name,
            language: selectedTemplate.language,
        };
    },
});

export const listApprovedTemplatesByPhone = internalQuery({
    args: { phoneNumberId: v.string() },
    handler: async (ctx, args) => {
        const templates = await ctx.db
            .query("templates")
            .withIndex("by_phone_number_id", (q) => q.eq("phoneNumberId", args.phoneNumberId))
            .order("desc")
            .collect();
        return templates.filter((template) => template.status === "APPROVED");
    },
});

export const insertQuickCampaignInternal = internalMutation({
    args: {
        name: v.string(),
        templateId: v.id("templates"),
        templateName: v.string(),
        templateLanguage: v.optional(v.string()),
        phoneNumberId: v.string(),
        scheduledAt: v.number(),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("campaigns", {
            name: args.name,
            templateId: args.templateId,
            templateName: args.templateName,
            templateLanguage: args.templateLanguage,
            phoneNumberId: args.phoneNumberId,
            status: "SCHEDULED",
            scheduledAt: args.scheduledAt,
            stats: { total: 0, sent: 0, delivered: 0, read: 0, failed: 0 },
            createdAt: Date.now(),
        });
    },
});

export const validateTemplateSelection = query({
    args: {
        templateName: v.string(),
        phoneNumberId: v.optional(v.string()),
        requestedLanguage: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const resolved: any = await ctx.runQuery(internal.templates.resolveTemplateForSend, {
            templateName: args.templateName,
            phoneNumberId: args.phoneNumberId,
            requestedLanguage: args.requestedLanguage,
            allowFallback: false,
            requireScoped: true,
        });
        if (!resolved.ok) {
            return {
                ...resolved,
                suggestedAction: "Sync templates from Meta and select an approved template for this number.",
            };
        }
        return {
            ok: true as const,
            templateId: resolved.selected.templateId,
            name: resolved.selected.name,
            language: resolved.selected.language,
            phoneNumberId: resolved.selected.phoneNumberId,
            status: "APPROVED",
            resolutionMode: resolved.resolutionMode,
            attempted: resolved.attempted,
        };
    },
});

export const getSendReadiness = query({
    args: {
        phoneNumberId: v.string(),
    },
    handler: async (ctx, args) => {
        const number = await ctx.db
            .query("whatsapp_numbers")
            .withIndex("by_business_number_id", (q) => q.eq("businessNumberId", args.phoneNumberId))
            .first();
        const scopedApprovedCount: number = await ctx.runQuery(
            internal.templates.getScopedApprovedCountInternal,
            { phoneNumberId: args.phoneNumberId }
        );

        const hasToken = Boolean(number?.accessToken?.trim());
        const tokenStatus =
            number?.tokenStatus ??
            (hasToken ? "connected" : "missing");

        let blockingReason: "NUMBER_NOT_FOUND" | "TOKEN_MISSING" | "AUTH_FAILED" | "NO_SCOPED_TEMPLATES" | null = null;
        let recommendedAction = "Ready to send.";

        if (!number) {
            blockingReason = "NUMBER_NOT_FOUND";
            recommendedAction = "Select a valid sending number from Integrations.";
        } else if (!hasToken) {
            blockingReason = "TOKEN_MISSING";
            recommendedAction = "Set an access token for this number in Integrations.";
        } else if (tokenStatus === "auth_failed") {
            blockingReason = "AUTH_FAILED";
            recommendedAction =
                "Reconnect this number in Integrations and replace the access token from the active Meta app.";
        } else if (scopedApprovedCount === 0) {
            blockingReason = "NO_SCOPED_TEMPLATES";
            recommendedAction = "Sync templates from Meta for this number, then pick an approved scoped template.";
        }

        return {
            ready: blockingReason === null,
            phoneNumberId: args.phoneNumberId,
            phoneNumberName: number?.name ?? null,
            tokenStatus,
            scopedApprovedCount,
            blockingReason,
            recommendedAction,
            lastAuthErrorCode: number?.lastAuthErrorCode ?? null,
            lastAuthErrorMessage: number?.lastAuthErrorMessage ?? null,
            lastAuthErrorAt: number?.lastAuthErrorAt ?? null,
        };
    },
});

export const listRecentAuthBlocks = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
        const numbers = await ctx.db.query("whatsapp_numbers").collect();
        const numberById = new Map(numbers.map((n) => [n.businessNumberId, n]));

        const rows: Array<{
            source: "number_status" | "campaign_log";
            phoneNumberId: string;
            phoneNumberName: string | null;
            tokenStatus: string;
            campaignId: string | null;
            campaignName: string | null;
            error: string | null;
            createdAt: number;
            lastAuthErrorCode: number | null;
            lastAuthErrorMessage: string | null;
            lastAuthErrorAt: number | null;
        }> = [];

        for (const number of numbers) {
            if (number.tokenStatus !== "auth_failed") continue;
            rows.push({
                source: "number_status",
                phoneNumberId: number.businessNumberId,
                phoneNumberName: number.name ?? null,
                tokenStatus: number.tokenStatus,
                campaignId: null,
                campaignName: null,
                error: number.lastAuthErrorMessage ?? null,
                createdAt: number.lastAuthErrorAt ?? number._creationTime,
                lastAuthErrorCode: number.lastAuthErrorCode ?? null,
                lastAuthErrorMessage: number.lastAuthErrorMessage ?? null,
                lastAuthErrorAt: number.lastAuthErrorAt ?? null,
            });
        }

        const logs = await ctx.db.query("campaign_logs").order("desc").take(limit * 20);
        const campaignCache = new Map<string, any>();
        for (const log of logs) {
            const error = String(log.error || "");
            if (!error) continue;
            const lower = error.toLowerCase();
            const isAuthBlock =
                lower.includes("[auth_error_precheck]") ||
                lower.includes("(#190)") ||
                lower.includes("[190]") ||
                lower.includes("auth_error") ||
                lower.includes("invalid or expired access token") ||
                lower.includes("application has been deleted");
            if (!isAuthBlock) continue;

            const campaignId = String(log.campaignId);
            let campaign = campaignCache.get(campaignId);
            if (!campaign) {
                campaign = await ctx.db.get(log.campaignId);
                campaignCache.set(campaignId, campaign);
            }
            const phoneNumberId = campaign?.phoneNumberId ? String(campaign.phoneNumberId) : null;
            if (!phoneNumberId) continue;
            const number = numberById.get(phoneNumberId);
            rows.push({
                source: "campaign_log",
                phoneNumberId,
                phoneNumberName: number?.name ?? null,
                tokenStatus: number?.tokenStatus ?? (number?.accessToken?.trim() ? "connected" : "missing"),
                campaignId,
                campaignName: campaign?.name ?? null,
                error,
                createdAt: log._creationTime,
                lastAuthErrorCode: number?.lastAuthErrorCode ?? null,
                lastAuthErrorMessage: number?.lastAuthErrorMessage ?? null,
                lastAuthErrorAt: number?.lastAuthErrorAt ?? null,
            });
            if (rows.length >= limit * 3) break;
        }

        return rows
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, limit);
    },
});

export const validateTemplateForSend = internalQuery({
    args: {
        templateName: v.string(),
        phoneNumberId: v.optional(v.string()),
        languageCode: v.optional(v.string()),
        allowFallback: v.optional(v.boolean()),
        requireScoped: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const resolved: any = await ctx.runQuery(internal.templates.resolveTemplateForSend, {
            templateName: args.templateName,
            phoneNumberId: args.phoneNumberId,
            requestedLanguage: args.languageCode,
            allowFallback: args.allowFallback ?? true,
            requireScoped: args.requireScoped ?? true,
        });
        if (!resolved.ok) {
            return {
                ...resolved,
                suggestedAction: "Sync templates from Meta and select a valid template.",
            };
        }
        return {
            ok: true as const,
            templateId: resolved.selected.templateId,
            name: resolved.selected.name,
            language: resolved.selected.language,
            status: "APPROVED",
            phoneNumberId: resolved.selected.phoneNumberId,
            resolutionMode: resolved.resolutionMode,
            attempted: resolved.attempted,
        };
    },
});

// 2. Start Processing (Internal) - Initial Setup
export const startProcessing = internalAction({
    args: { campaignId: v.id("campaigns") },
    handler: async (ctx, args) => {
        const campaign = await ctx.runQuery(internal.campaigns.getCampaignById, { id: args.campaignId });
        if (!campaign) {
            throw new Error(`Campaign not found: ${args.campaignId}`);
        }
        if (!campaign.phoneNumberId) {
            const reason =
                `${INVALID_TEMPLATE_PRECHECK_PREFIX} PHONE_NUMBER_REQUIRED ` +
                `templateName="${campaign.templateName}" campaignId="${args.campaignId}"`;
            logError("[INVALID_TEMPLATE_PRECHECK][Campaign][Start] Blocking campaign start: missing sending number", {
                templateName: campaign.templateName,
                requestedLanguage: null,
                approvedLanguage: null,
                resolvedPhoneNumberId: null,
                reasonCode: "PHONE_NUMBER_REQUIRED",
                resolutionMode: null,
                campaignId: args.campaignId,
            });
            await ctx.runMutation(internal.campaigns.failCampaignForInvalidTemplate, {
                campaignId: args.campaignId,
                reason,
            });
            return;
        }

        const selectedTemplate = await ctx.runQuery(api.templates.getById, { id: campaign.templateId });
        const scopedTemplateByName = selectedTemplate
            ? null
            : await ctx.runQuery(internal.templates.getTemplateByName, {
                name: campaign.templateName,
                phoneNumberId: campaign.phoneNumberId ?? undefined,
            });
        const requestedLanguage =
            campaign.templateLanguage ??
            selectedTemplate?.language ??
            scopedTemplateByName?.language;
        const precheck: any = await ctx.runAction(internal.templates.resolveTemplateForSendWithSync, {
            templateName: campaign.templateName,
            phoneNumberId: campaign.phoneNumberId ?? undefined,
            requestedLanguage,
            allowFallback: false,
            requireScoped: true,
            failOnSyncError: true,
        });
        if (!precheck.ok) {
            const reason =
                `${INVALID_TEMPLATE_PRECHECK_PREFIX} ${precheck.reasonCode ?? "PRECHECK_FAILED"} ` +
                `templateName="${campaign.templateName}" requestedLanguage="${requestedLanguage ?? "unknown"}" ` +
                `resolvedPhoneNumberId="${campaign.phoneNumberId ?? "none"}" campaignId="${args.campaignId}"`;
            logError("[INVALID_TEMPLATE_PRECHECK][Campaign][Start] Blocking campaign start", {
                templateName: campaign.templateName,
                requestedLanguage: requestedLanguage ?? null,
                approvedLanguage: null,
                resolvedPhoneNumberId: campaign.phoneNumberId ?? null,
                reasonCode: precheck.reasonCode,
                resolutionMode: precheck.resolutionMode ?? null,
                campaignId: args.campaignId,
            });
            await ctx.runMutation(internal.campaigns.failCampaignForInvalidTemplate, {
                campaignId: args.campaignId,
                reason,
            });
            return;
        }
        if (precheck.resolutionMode !== "scoped_exact") {
            logWarn("[Campaign] Template resolved using fallback before processing", {
                campaignId: args.campaignId,
                templateName: campaign.templateName,
                requestedLanguage: requestedLanguage ?? null,
                approvedLanguage: precheck.selected?.language ?? null,
                resolvedPhoneNumberId: campaign.phoneNumberId ?? null,
                reasonCode: "FALLBACK_USED",
                resolutionMode: precheck.resolutionMode,
            });
        }

        // 1. Count target audience
        const contacts = await ctx.runQuery(internal.campaigns.getCampaignContacts, {
            campaignId: args.campaignId,
            limit: 10000
        });

        // 2. Update status to PROCESSING and Total Count
        await ctx.runMutation(internal.campaigns.updateStatus, {
            campaignId: args.campaignId,
            status: "PROCESSING",
            total: contacts.length
        });

        // 3. Kick off the first batch
        await ctx.runAction(internal.campaigns.processBatch, {
            campaignId: args.campaignId,
            cursor: null // Start from beginning
        });
    },
});

// Default anti-spam sending configuration
const DEFAULT_SENDING_CONFIG = {
    messagesPerSecond: 10,        // Conservative: 10 msgs/sec (WhatsApp allows 80)
    delayBetweenMessages: 100,    // 100ms between each message
    maxRetries: 3,                // 3 retries per contact
    skipRecentlyContacted: true,  // Skip recently contacted
    recentContactHours: 24,       // Don't re-contact within 24h
};

// 3. Process Batch (Recursive)
export const processBatch = internalAction({
    args: {
        campaignId: v.id("campaigns"),
        cursor: v.union(v.string(), v.null()),
    },
    handler: async (ctx, args) => {
        const campaign = await ctx.runQuery(internal.campaigns.getCampaignById, { id: args.campaignId });
        if (!campaign || campaign.status !== "PROCESSING") {
            return;
        }

        const BATCH_SIZE = 50;
        const BATCH_DELAY_MS = 5000; // 5 seconds between batches for anti-spam

        // 1. Fetch batch and campaign config
        const { contacts, nextCursor, templateName, sendingConfig } = await ctx.runQuery(internal.campaigns.getBatchForProcessing, {
            campaignId: args.campaignId,
            cursor: args.cursor,
            limit: BATCH_SIZE
        });

        // Merge with defaults
        const config = {
            ...DEFAULT_SENDING_CONFIG,
            ...sendingConfig
        };

        if (contacts.length === 0) {
            // Reached the end of the contact list.
            const finalized: any = await ctx.runMutation(internal.campaigns.finalizeCampaignIfDone, {
                campaignId: args.campaignId,
            });

            // Only force completion if we are stuck in PROCESSING and not already FAILED or done.
            if (!finalized?.done && finalized?.status === "PROCESSING") {
                // Let's only force COMPLETED if all messages actually failed to enqueue or something similar.
                // In reality, if it's PROCESSING, we should just let the background jobs finish. 
                // However, there might be edge cases where no messages were enqueued.
                const campaignAfterFinishing = await ctx.runQuery(internal.campaigns.getCampaignById, { id: args.campaignId });
                // If there are exactly zero processed logs, it might be stuck.
                // But normally we shouldn't indiscriminately mark it as COMPLETED.
                // It's safer to just do nothing here and rely on finalizeStaleProcessingCampaigns.
                // For now, if it truly has 0 total or is somehow stuck, we run a safe stat calculation.
            }
            return;
        }

        logDebug(`[Campaign] Processing batch of ${contacts.length} contacts with ${config.delayBetweenMessages}ms delay between messages`);

        // Sync templates from Meta before first batch to avoid 132001 (stale name+language in DB)
        if (args.cursor === null && campaign.phoneNumberId) {
            try {
                await ctx.runAction(api.templates.syncFromMeta, { phoneNumberId: campaign.phoneNumberId });
                logDebug("[Campaign] Synced templates from Meta before first batch send");
            } catch (syncErr) {
                const syncMsg = syncErr instanceof Error ? syncErr.message : String(syncErr);
                // If Meta sync fails (e.g., missing whatsapp_business_management permission),
                // continue with cached scoped templates as long as resolver can still resolve one.
                const fallbackResolution: any = await ctx.runQuery(internal.templates.resolveTemplateForSend, {
                    templateName: campaign.templateName,
                    phoneNumberId: campaign.phoneNumberId ?? undefined,
                    requestedLanguage: undefined,
                    allowFallback: false,
                    requireScoped: true,
                });
                if (!fallbackResolution?.ok) {
                    logError("[Campaign] Template sync failed and no cached scoped template could be resolved", {
                        campaignId: args.campaignId,
                        error: syncMsg,
                        reasonCode: fallbackResolution?.reasonCode ?? "SYNC_FAILED",
                    });
                    await ctx.runMutation(internal.campaigns.failCampaignForInvalidTemplate, {
                        campaignId: args.campaignId,
                        reason: `Template sync failed before send. Reconnect the number in Integrations and try again. Error: ${syncMsg.slice(0, 200)}`,
                    });
                    await ctx.runMutation(internal.campaigns.finalizeCampaignIfDone, { campaignId: args.campaignId });
                    return;
                }
                logWarn("[Campaign] Template sync failed before first batch; continuing with cached scoped template", {
                    campaignId: args.campaignId,
                    templateName: campaign.templateName,
                    resolutionMode: fallbackResolution.resolutionMode ?? "scoped_fallback",
                    error: syncMsg,
                });
            }
        }

        // 2. Send Messages via Retrier with anti-spam delay
        for (const contact of contacts) {
            const latestCampaign = await ctx.runQuery(internal.campaigns.getCampaignById, { id: args.campaignId });
            if (!latestCampaign || latestCampaign.status !== "PROCESSING") {
                logWarn("[Campaign] Stopping batch loop because campaign is no longer PROCESSING", {
                    campaignId: args.campaignId,
                    status: latestCampaign?.status ?? null,
                });
                break;
            }
            await retrier.run(
                ctx,
                internal.campaigns.sendToContact,
                { campaignId: args.campaignId, contactId: contact._id },
                { initialBackoffMs: 500, base: 2, maxFailures: config.maxRetries }
            );

            // Anti-spam delay between messages (default: 100ms = 10 msgs/sec)
            if (config.delayBetweenMessages > 0) {
                await new Promise(resolve => setTimeout(resolve, config.delayBetweenMessages));
            }
        }

        // 4. Recurse if there's more with increased delay
        const campaignAfterBatch = await ctx.runQuery(internal.campaigns.getCampaignById, { id: args.campaignId });
        if (nextCursor && campaignAfterBatch?.status === "PROCESSING") {
            logDebug(`[Campaign] Scheduling next batch in ${BATCH_DELAY_MS}ms`);
            await ctx.scheduler.runAfter(BATCH_DELAY_MS, internal.campaigns.processBatch, {
                campaignId: args.campaignId,
                cursor: nextCursor
            });
        } else {
            // Completion handled in sendToContact
        }
    },
});

/**
 * Sends a campaign template message to a single contact.
 * 
 * This function handles both standard and carousel template messages according to
 * the WhatsApp Cloud API specification.
 * 
 * ## Standard Templates
 * For standard templates, components are built from the template definition:
 * - HEADER: Can be TEXT, IMAGE, VIDEO, or DOCUMENT format
 * - BODY: Text content with optional {{variable}} placeholders
 * - FOOTER: Optional footer text
 * - BUTTONS: Quick reply, URL, phone number, or copy code buttons
 * 
 * ## Carousel Templates
 * Carousel templates require special handling per Meta's API documentation:
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates/media-card-carousel-templates/
 * 
 * The carousel structure is:
 * ```json
 * {
 *   "type": "carousel",
 *   "cards": [
 *     {
 *       "card_index": 0,
 *       "components": [
 *         { "type": "header", "parameters": [{ "type": "image", "image": { "link": "..." } }] },
 *         { "type": "body", "parameters": [...] },
 *         { "type": "button", "sub_type": "url", "index": 0, "parameters": [...] }
 *       ]
 *     }
 *   ]
 * }
 * ```
 * 
 * Key points for carousel templates:
 * 1. Headers with `example.header_handle` require the carousel component structure
 * 2. Each card must have a `card_index` (0-based)
 * 3. Static carousels (no variables, no header handles) send empty components array
 * 4. Media URLs from template creation (header_handle) are used as `link` parameters
 * 
 * ## Error Handling
 * Errors are categorized using `errorUtils.ts` for consistent handling:
 * - #131030: Phone not in allowed list (sandbox mode)
 * - #132012: Template parameter format mismatch
 * - #10: Permission denied
 * - #80005/#200: Rate limiting (retryable)
 */
export const sendToContact = internalAction({
    args: { campaignId: v.id("campaigns"), contactId: v.id("contacts") },
    handler: async (ctx, args): Promise<{ success: boolean; messageId?: string } | null | void> => {
        const campaign = await ctx.runQuery(internal.campaigns.getCampaignById, { id: args.campaignId });
        const contact = await ctx.runQuery(internal.campaigns.getContactById, { id: args.contactId });
        if (!campaign || !contact) {
            logError(`[Campaign] Campaign or contact not found: campaign=${args.campaignId}, contact=${args.contactId}`);
            throw new Error("Campaign or contact not found");
        }
        if (campaign.status !== "PROCESSING") {
            return;
        }
        if (!campaign.phoneNumberId) {
            const reason =
                `${INVALID_TEMPLATE_PRECHECK_PREFIX} PHONE_NUMBER_REQUIRED ` +
                `templateName="${campaign.templateName}" campaignId="${args.campaignId}"`;
            await ctx.runMutation(internal.campaigns.logBatchResults, {
                campaignId: args.campaignId,
                logs: [{
                    contactId: args.contactId,
                    status: "failed",
                    error: reason,
                }],
            });
            await ctx.runMutation(internal.campaigns.failCampaignForInvalidTemplate, {
                campaignId: args.campaignId,
                reason,
            });
            await ctx.runMutation(internal.campaigns.finalizeCampaignIfDone, {
                campaignId: args.campaignId,
            });
            return;
        }

        // Anti-spam: Check if contact was recently messaged
        const config = {
            ...DEFAULT_SENDING_CONFIG,
            ...campaign.sendingConfig
        };

        if (config.skipRecentlyContacted && contact.lastMessagedAt) {
            const campaignAllowsBypass = campaign.isTestCampaign && campaign.testBypassRecentContact;
            const normalizedContactPhone = normalizePhone(contact.phone);
            const isBypassedTestContact = campaignAllowsBypass &&
                Array.isArray(campaign.testContactPhones) &&
                campaign.testContactPhones.some((phone: string) => normalizePhone(phone) === normalizedContactPhone);
            if (isBypassedTestContact) {
                logDebug("[Campaign] Test bypass applied for recently contacted check", {
                    campaignId: args.campaignId,
                    contactId: args.contactId,
                    phone: normalizedContactPhone,
                });
            }
            if (isBypassedTestContact) {
                // Proceed with send for explicitly allowed test contacts.
            } else {
                const recentThreshold = Date.now() - (config.recentContactHours * 60 * 60 * 1000);

                if (contact.lastMessagedAt > recentThreshold) {
                    const hoursAgo = Math.round((Date.now() - contact.lastMessagedAt) / 3600000);
                    logDebug(`[Campaign] Skipping contact ${args.contactId} - messaged ${hoursAgo}h ago (threshold: ${config.recentContactHours}h)`);

                    // Log as skipped
                    await ctx.runMutation(internal.campaigns.logBatchResults, {
                        campaignId: args.campaignId,
                        logs: [{
                            contactId: args.contactId,
                            status: "skipped",
                            skipReason: "recently_contacted"
                        }]
                    });
                    await ctx.runMutation(internal.campaigns.finalizeCampaignIfDone, {
                        campaignId: args.campaignId,
                    });

                    return; // Skip this contact
                }
            }
        }

        // Resolve template for this send with fallback chain.
        const selectedTemplate = await ctx.runQuery(api.templates.getById, { id: campaign.templateId });
        const scopedTemplateByName = selectedTemplate
            ? null
            : await ctx.runQuery(internal.templates.getTemplateByName, {
                name: campaign.templateName,
                phoneNumberId: campaign.phoneNumberId ?? undefined,
            });
        const requestedLanguage =
            campaign.templateLanguage ??
            selectedTemplate?.language ??
            scopedTemplateByName?.language;
        let resolved: any = await ctx.runQuery(internal.templates.resolveTemplateForSend, {
            templateName: campaign.templateName,
            phoneNumberId: campaign.phoneNumberId ?? undefined,
            requestedLanguage,
            allowFallback: false,
            requireScoped: true,
        });
        if (!resolved.ok) {
            const precheckError = `[INVALID_TEMPLATE_PRECHECK] ${resolved.message} templateName="${campaign.templateName}" requestedLanguage="${requestedLanguage || "unknown"}" resolvedPhoneNumberId="${campaign.phoneNumberId || "none"}" campaignId="${args.campaignId}"`;
            logError("[Campaign] Blocking send due to template resolver failure:", {
                templateName: campaign.templateName,
                requestedLanguage: requestedLanguage ?? null,
                approvedLanguage: null,
                resolvedPhoneNumberId: campaign.phoneNumberId ?? null,
                reasonCode: resolved.reasonCode,
                resolutionMode: resolved.resolutionMode ?? null,
                campaignId: args.campaignId,
            });
            await ctx.runMutation(internal.campaigns.logBatchResults, {
                campaignId: args.campaignId,
                logs: [{
                    contactId: args.contactId,
                    status: "failed",
                    error: precheckError,
                }],
            });
            await ctx.runMutation(internal.campaigns.failCampaignForInvalidTemplate, {
                campaignId: args.campaignId,
                reason: precheckError,
            });
            await ctx.runMutation(internal.campaigns.finalizeCampaignIfDone, {
                campaignId: args.campaignId,
            });
            return;
        }
        if (resolved.resolutionMode !== "scoped_exact") {
            logWarn("[Campaign] Fallback template resolution used", {
                templateName: campaign.templateName,
                requestedLanguage: requestedLanguage ?? null,
                approvedLanguage: resolved.selected?.language ?? null,
                resolvedPhoneNumberId: campaign.phoneNumberId ?? null,
                reasonCode: "FALLBACK_USED",
                resolutionMode: resolved.resolutionMode,
                campaignId: args.campaignId,
            });
        }

        // Fetch resolved template to construct components.
        let template = await ctx.runQuery(api.templates.getById, { id: resolved.selected.templateId });
        if (!template) {
            const errorMsg = `[INVALID_TEMPLATE_PRECHECK] Resolved template could not be loaded templateName="${campaign.templateName}" requestedLanguage="${requestedLanguage || "unknown"}" resolvedPhoneNumberId="${campaign.phoneNumberId || "none"}" campaignId="${args.campaignId}"`;
            await ctx.runMutation(internal.campaigns.logBatchResults, {
                campaignId: args.campaignId,
                logs: [{
                    contactId: args.contactId,
                    status: "failed",
                    error: errorMsg,
                }],
            });
            await ctx.runMutation(internal.campaigns.failCampaignForInvalidTemplate, {
                campaignId: args.campaignId,
                reason: errorMsg,
            });
            await ctx.runMutation(internal.campaigns.finalizeCampaignIfDone, {
                campaignId: args.campaignId,
            });
            return;
        }

        if (template.status !== "APPROVED") {
            logWarn(`[Campaign] Template ${campaign.templateName} status is ${template.status}, may fail to send`);
        }

        let failedLanguage132001: string | null = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
            // On second attempt (after 132001): sync from Meta and re-resolve with fallback; retry send only if resolution changed.
            if (attempt === 2) {
                try {
                    await ctx.runAction(api.templates.syncFromMeta, { phoneNumberId: campaign.phoneNumberId! });
                } catch (syncErr) {
                    logWarn("[Campaign] Sync during 132001 retry failed", { campaignId: args.campaignId, error: syncErr instanceof Error ? syncErr.message : String(syncErr) });
                }
                // Prefer a different language on retry when Send API rejected the previous one (e.g. "does not exist in ar").
                const failedLang = (failedLanguage132001 ?? "").trim().toLowerCase().split(/[-_]/)[0];
                const retryRequestedLanguage =
                    failedLang === "ar"
                        ? "en"
                        : failedLang === "en"
                            ? "ar"
                            : requestedLanguage;
                const newResolved: any = await ctx.runQuery(internal.templates.resolveTemplateForSend, {
                    templateName: campaign.templateName,
                    phoneNumberId: campaign.phoneNumberId ?? undefined,
                    requestedLanguage: retryRequestedLanguage,
                    allowFallback: false,
                    requireScoped: true,
                });
                if (!newResolved.ok || (newResolved.selected.templateId === resolved.selected.templateId && newResolved.selected.language === resolved.selected.language)) {
                    // No change or failed; log and finalize then exit loop (contact remains failed)
                    const noChangeReason = `${INVALID_TEMPLATE_PRECHECK_PREFIX} INVALID_TEMPLATE (retry had no different template) templateName="${campaign.templateName}" requestedLanguage="${resolved.selected?.language ?? requestedLanguage ?? "unknown"}" campaignId="${args.campaignId}"`;
                    await ctx.runMutation(internal.campaigns.logBatchResults, {
                        campaignId: args.campaignId,
                        logs: [{ contactId: args.contactId, status: "failed", error: noChangeReason }],
                    });
                    await ctx.runMutation(internal.campaigns.failCampaignForInvalidTemplate, {
                        campaignId: args.campaignId,
                        reason: noChangeReason,
                    });
                    await ctx.runMutation(internal.campaigns.finalizeCampaignIfDone, { campaignId: args.campaignId });
                    break;
                }
                resolved = newResolved;
                const newTemplate = await ctx.runQuery(api.templates.getById, { id: resolved.selected.templateId });
                if (!newTemplate) {
                    const noTemplateReason = `${INVALID_TEMPLATE_PRECHECK_PREFIX} INVALID_TEMPLATE (retry resolved but template not found) templateName="${campaign.templateName}" campaignId="${args.campaignId}"`;
                    await ctx.runMutation(internal.campaigns.logBatchResults, {
                        campaignId: args.campaignId,
                        logs: [{ contactId: args.contactId, status: "failed", error: noTemplateReason }],
                    });
                    await ctx.runMutation(internal.campaigns.failCampaignForInvalidTemplate, {
                        campaignId: args.campaignId,
                        reason: noTemplateReason,
                    });
                    await ctx.runMutation(internal.campaigns.finalizeCampaignIfDone, { campaignId: args.campaignId });
                    break;
                }
                template = newTemplate;
                logDebug("[Campaign] 132001 retry: re-resolved template", { templateName: campaign.templateName, newLanguage: resolved.selected.language, campaignId: args.campaignId });
            }

            const components: any[] = [];
            logDebug(`[Campaign] Template structure:`, {
                hasComponents: !!template?.components,
                componentsLength: template?.components?.length || 0,
                components: JSON.stringify(template?.components || [], null, 2)
            });

            /**
             * Processes a header component for standard (non-carousel) templates.
             * 
             * Header formats supported:
             * - IMAGE: Uses header_handle URL or placeholder
             * - VIDEO: Uses video URL
             * - DOCUMENT: Uses document URL with filename
             * - TEXT: Static text or text with {{variables}}
             * 
             * Note: For static text headers (no variables), the header component
             * should be included WITHOUT parameters per WhatsApp API spec.
             */
            const processHeaderComponent = (comp: any) => {
                if (comp.format === "IMAGE") {
                    const link = comp.example?.header_handle?.[0] || comp.example?.header_url?.[0] || "https://placehold.co/600x400.png";
                    return {
                        type: "header",
                        parameters: [{ type: "image", image: { link } }]
                    };
                } else if (comp.format === "VIDEO") {
                    return {
                        type: "header",
                        parameters: [{ type: "video", video: { link: "https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4" } }]
                    };
                } else if (comp.format === "DOCUMENT") {
                    return {
                        type: "header",
                        parameters: [{ type: "document", document: { link: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", filename: "document.pdf" } }]
                    };
                } else if (comp.format === "TEXT") {
                    // Check if header has variables by looking at the text content
                    // If text contains {{variable}} patterns, it has variables
                    const hasVariables = comp.text?.includes("{{") ||
                        (comp.example?.header_text && comp.example.header_text.length > 0);

                    if (hasVariables && comp.example?.header_text && comp.example.header_text.length > 0) {
                        // Header has variables - include parameters
                        return {
                            type: "header",
                            parameters: comp.example.header_text.map((text: string) => ({ type: "text", text }))
                        };
                    } else {
                        // Static text header - include header WITHOUT parameters field
                        // WhatsApp API: if header has no variables, don't include parameters at all
                        return {
                            type: "header"
                            // No parameters field for static headers
                        };
                    }
                }
                return null;
            };

            if (template && template.components) {
                // Check for PRODUCT_CAROUSEL template
                const productCarouselComp = template.components.find((c: any) =>
                    c.type === "PRODUCT_CAROUSEL" || c.type === "product_carousel"
                );

                // Check for CATALOG template
                const catalogComp = template.components.find((c: any) =>
                    c.type === "CATALOG" || c.type === "catalog"
                );

                // Check for CAROUSEL template
                const carouselComp = template.components.find((c: any) =>
                    c.type === "CAROUSEL" || c.type === "carousel"
                );

                // Handle PRODUCT_CAROUSEL template
                if (productCarouselComp && productCarouselComp.catalog_id && productCarouselComp.products) {
                    logDebug(`[Campaign] Processing PRODUCT_CAROUSEL template with ${productCarouselComp.products.length} products`);

                    const bodyComp: any = template.components.find((c: any) => c.type === "BODY");
                    const footerComp: any = template.components.find((c: any) => c.type === "FOOTER");

                    const interactiveContent: any = {
                        type: "product_list",
                        body: {
                            text: bodyComp?.text || "Our Products"
                        },
                        footer: footerComp ? { text: footerComp.text } : undefined,
                        action: {
                            catalog_id: productCarouselComp.catalog_id,
                            sections: [{
                                title: "Products",
                                product_items: productCarouselComp.products.map((p: any) => ({
                                    product_retailer_id: p.product_retailer_id || p.productId
                                }))
                            }]
                        }
                    };

                    const result: any = await ctx.runAction(api.whatsapp.sendMessage, {
                        to: (contact as { phone?: string }).phone as string,
                        type: "interactive",
                        content: interactiveContent,
                        phoneNumberId: campaign.phoneNumberId ?? undefined,
                    });

                    await ctx.runMutation(internal.campaigns.logBatchResults, {
                        campaignId: args.campaignId,
                        logs: [{ contactId: args.contactId, status: "sent", metaId: result.messages?.[0]?.id }]
                    });
                    await ctx.runMutation(internal.campaigns.finalizeCampaignIfDone, {
                        campaignId: args.campaignId,
                    });

                    return { success: true, messageId: result.messages?.[0]?.id };
                }

                // Handle CATALOG template
                if (catalogComp && catalogComp.catalog_id) {
                    logDebug(`[Campaign] Processing CATALOG template`);

                    const headerComp = template.components.find((c: any) => c.type === "HEADER");
                    const bodyComp = template.components.find((c: any) => c.type === "BODY");
                    const footerComp = template.components.find((c: any) => c.type === "FOOTER");

                    const interactiveContent: any = {
                        type: "catalog_message",
                        body: {
                            text: bodyComp?.text || "View our catalog"
                        },
                        footer: footerComp ? { text: footerComp.text } : undefined,
                        action: {
                            name: "catalog",
                            parameters: {
                                thumbnail_product_retailer_id: catalogComp.thumbnail_product_id || undefined
                            }
                        }
                    };

                    // Add header if present
                    if (headerComp && headerComp.example?.header_handle) {
                        interactiveContent.header = {
                            type: "image",
                            image: {
                                id: headerComp.example.header_handle[0] // Media ID
                            }
                        };
                    }

                    const result: any = await ctx.runAction(api.whatsapp.sendMessage, {
                        to: (contact as { phone?: string }).phone as string,
                        type: "interactive",
                        content: interactiveContent,
                        phoneNumberId: campaign.phoneNumberId ?? undefined,
                    });

                    await ctx.runMutation(internal.campaigns.logBatchResults, {
                        campaignId: args.campaignId,
                        logs: [{ contactId: args.contactId, status: "sent", metaId: result.messages?.[0]?.id }]
                    });
                    await ctx.runMutation(internal.campaigns.finalizeCampaignIfDone, {
                        campaignId: args.campaignId,
                    });

                    return { success: true, messageId: result.messages?.[0]?.id };
                }

                if (carouselComp && carouselComp.cards) {
                    // CAROUSEL templates: headers are inside cards (template definition)
                    // Headers with example.header_handle require carousel component structure
                    logDebug(`[Campaign] Processing CAROUSEL template with ${carouselComp.cards.length} cards`);
                    logDebug(`[Campaign] CAROUSEL template detected - headers are in cards, not top-level`);

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

                    logDebug(`[Campaign] CAROUSEL analysis:`, {
                        bodyHasVariables,
                        cardsHaveHeaderHandles,
                        cardsHaveVariables
                    });

                    // IMPORTANT: WhatsApp carousel templates REQUIRE header parameters for each card.
                    // We cannot send empty components or skip headers.
                    // 
                    // The header_handle URLs stored in templates are temporary and expire (403 Forbidden).
                    // We need to upload the media to WhatsApp and get fresh media IDs before sending.

                    if (cardsHaveHeaderHandles) {
                        logDebug(`[Campaign] CAROUSEL has ${carouselComp.cards.length} cards with media headers - uploading to get media IDs`);

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

                                logDebug(`[Campaign] Card ${i}: Uploading ${headerFormat} from header_handle...`);

                                try {
                                    // Upload media to WhatsApp and get a media ID (use campaign's number so DB token is used)
                                    const mediaId = await ctx.runAction(api.whatsapp.uploadMediaFromUrl, {
                                        url: headerUrl,
                                        type: headerFormat,
                                        phoneNumberId: campaign.phoneNumberId ?? undefined,
                                    });
                                    mediaIds.push(mediaId);
                                    logDebug(`[Campaign] Card ${i}: Got media ID: ${mediaId}`);
                                } catch (uploadError) {
                                    logError(`[Campaign] Card ${i}: Failed to upload media:`, uploadError);
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
                            logError(`[Campaign] ${failedUploads}/${mediaIds.length} media uploads failed - header_handle URLs may be expired`);
                            throw new Error(`Failed to upload ${failedUploads} media items for carousel. The template media URLs may have expired. Please edit the template and re-upload the images.`);
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
                                logDebug(`[Campaign] Card ${index} body has variables - needs implementation`);
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
                                    logDebug(`[Campaign] Card ${index} buttons have variables - needs implementation`);
                                }
                            }

                            return {
                                card_index: index,
                                components: cardComponents
                            };
                        });

                        // Add body component if main body has variables
                        if (bodyHasVariables) {
                            logDebug(`[Campaign] CAROUSEL template body has variables - needs implementation`);
                        }

                        // Add carousel component
                        components.push({
                            type: "carousel",
                            cards: carouselCards
                        });

                        logDebug(`[Campaign] Constructed carousel with ${carouselCards.length} cards using media IDs`);
                    } else {
                        // Carousel without media headers - just handle variables if any
                        logDebug(`[Campaign] CAROUSEL without media headers - processing variables only`);

                        if (bodyHasVariables || cardsHaveVariables) {
                            const carouselCards = carouselComp.cards.map((card: any, index: number) => {
                                const cardComponents: any[] = [];

                                // Process body if it has variables
                                const cardBodyComp = card.components?.find((c: any) =>
                                    c.type === "BODY" || c.type === "body"
                                );
                                if (cardBodyComp && cardBodyComp.text?.includes("{{")) {
                                    logDebug(`[Campaign] Card ${index} body has variables - needs implementation`);
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
                } else {
                    // Standard template: process top-level components (HEADER, BODY, BUTTONS)
                    for (const comp of template.components) {
                        logDebug(`[Campaign] Processing component:`, {
                            type: comp.type,
                            format: comp.format,
                            hasExample: !!comp.example,
                            example: comp.example
                        });

                        if (comp.type === "HEADER" || comp.type === "header") {
                            const headerComponent = processHeaderComponent(comp);
                            if (headerComponent) components.push(headerComponent);
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
                }
            }

            // After constructing components array, check if we missed any HEADER components
            if (components.length === 0) {
                // Skip check for CAROUSEL templates (they don't have top-level headers)
                const isCarousel = template.components?.some((c: any) =>
                    c.type === "CAROUSEL" || c.type === "carousel"
                );

                if (!isCarousel) {
                    // Only check for headers in non-carousel templates
                    let hasHeader = template.components?.some((c: any) =>
                        (c.type === "HEADER" || c.type === "header")
                    );

                    if (hasHeader) {
                        logWarn(`[Campaign] Template has HEADER but no header component was added. Template components:`,
                            JSON.stringify(template.components, null, 2));
                        // Try to add a default header without parameters for static headers
                        components.push({
                            type: "header"
                            // No parameters field for static headers
                        });
                    }
                } else {
                    // CAROUSEL template with empty components - this is correct only if truly static
                    // (no header handles, no variables) - already logged in CAROUSEL handling section
                    logDebug(`[Campaign] CAROUSEL template - empty components array is correct (truly static template)`);
                }
            }

            logDebug(`[Campaign] Final components to send:`, JSON.stringify(components, null, 2));

            try {
                const templateLanguage = resolved.selected.language;
                const res = await ctx.runAction(api.whatsapp.sendMessage, {
                    to: (contact as { phone?: string }).phone as string,
                    type: "template",
                    content: {
                        name: resolved.selected.name,
                        language: { code: templateLanguage },
                        components: components
                    },
                    phoneNumberId: campaign.phoneNumberId,
                });
                await ctx.runMutation(internal.campaigns.logBatchResults, {
                    campaignId: args.campaignId,
                    logs: [{
                        contactId: args.contactId,
                        status: "sent",
                        metaId: res.messages?.[0]?.id,
                        skipReason: resolved.resolutionMode !== "scoped_exact"
                            ? `fallback:${resolved.resolutionMode}`
                            : undefined,
                    }]
                });

                // Update contact's lastMessagedAt for anti-spam tracking
                await ctx.runMutation(internal.campaigns.updateContactLastMessaged, {
                    contactId: args.contactId,
                    templateName: resolved.selected.name
                });
                await ctx.runMutation(internal.campaigns.finalizeCampaignIfDone, {
                    campaignId: args.campaignId,
                });
                break; // success; exit retry loop
            } catch (e: unknown) {
                // Try to extract error properties from various error formats
                // Convex action boundaries can strip custom error properties, so we need to reliably parse them
                let err: Error & { code?: number; category?: string; retryable?: boolean } =
                    (e instanceof Error) ? (e as any) : new Error(String(e));

                // Extract explicit properties if they got serialized over
                const rawE = e as any;
                if (rawE && typeof rawE === "object") {
                    if (rawE.code !== undefined && err.code === undefined) err.code = rawE.code;
                    if (rawE.category !== undefined && err.category === undefined) err.category = rawE.category;
                    if (rawE.retryable !== undefined && err.retryable === undefined) err.retryable = rawE.retryable;
                }

                // Fall back to message parsing
                if (!err.code && err.message) {
                    let codeMatch = err.message.match(/\(#(\d+)\)/);
                    if (!codeMatch) codeMatch = err.message.match(/(?:error\s+)?code[:\s]+(\d+)/i);
                    if (!codeMatch) codeMatch = err.message.match(/"code"\s*:\s*(\d+)/);
                    if (codeMatch) err.code = parseInt(codeMatch[1], 10);
                }

                // Fall back to category parsing
                if (!err.category && err.message) {
                    const categoryMatch = err.message.match(/"category"\s*:\s*"([^"]+)"/);
                    if (categoryMatch) err.category = categoryMatch[1];
                }

                // Categorize if missing
                if (err.code && !err.category) {
                    const errorInfo = categorizeWhatsAppError(err.code, err.message);
                    err.category = errorInfo.category;
                    err.retryable = errorInfo.retryable;
                }

                // Fall back to text inspection
                if (!err.category && err.message) {
                    const msgLower = err.message.toLowerCase();
                    if (msgLower.includes("not in allowed list")) {
                        err.category = "PHONE_NOT_ALLOWED";
                        err.retryable = false;
                    } else if (msgLower.includes("parameter format")) {
                        err.category = "TEMPLATE_FORMAT";
                        err.retryable = false;
                    } else if (msgLower.includes("rate limit") || msgLower.includes("throttl")) {
                        err.category = "RATE_LIMIT";
                        err.retryable = true;
                    } else if (msgLower.includes("permission") || msgLower.includes("unauthorized") || msgLower.includes("invalid token")) {
                        err.category = "AUTH_ERROR";
                        err.retryable = false;
                    } else if (msgLower.includes("132001") || msgLower.includes("template name does not exist")) {
                        err.category = "INVALID_TEMPLATE";
                        err.retryable = false;
                        if (!err.code) err.code = 132001;
                    }
                }

                if (err.retryable === undefined && err.category) {
                    err.retryable = err.category === "RATE_LIMIT" || err.category === "NETWORK_ERROR";
                }

                const errorMsg = err?.message || String(e);
                // Normalize code (may be string or lost across action boundary); ensure 132001 is detected from message
                let code: number | undefined = err?.code != null ? Number(err.code) : undefined;
                if (code !== 132001 && (errorMsg.includes("132001") || errorMsg.toLowerCase().includes("template name does not exist in the translation"))) {
                    code = 132001;
                    if (!err.category) (err as { category?: string }).category = "INVALID_TEMPLATE";
                }

                // Handle specific WhatsApp errors gracefully
                if (code === 131030) {
                    // Phone number not in allowed list - non-retryable, log as failed
                    // This typically happens in sandbox mode when phone isn't added to test list
                    logDebug(`[Campaign] Skipping contact ${args.contactId}: Phone number not in allowed list (sandbox mode)`);
                } else if (code === 10) {
                    // Permission error - non-retryable, log as failed
                    // This happens when the app doesn't have required WhatsApp Business API permissions
                    logError(`[Campaign] Permission error for contact ${args.contactId}:`, {
                        error: errorMsg,
                        suggestion: "Check WhatsApp Business API permissions in Meta Business Suite"
                    });
                } else if (code === 132012) {
                    // Template format error - non-retryable, log as failed
                    logError(`[Campaign] Template format error for contact ${args.contactId}:`, {
                        error: errorMsg,
                        templateName: campaign.templateName,
                        componentsSent: components.length,
                        templateComponents: template?.components?.length || 0
                    });
                } else if (
                    err.category === "AUTH_ERROR" ||
                    code === 190 ||
                    code === 401 ||
                    code === 403
                ) {
                    // Authentication/token/app failure - non-retryable and terminal for the campaign.
                    err.retryable = false;
                    const authFailureReason =
                        `[AUTH_ERROR_PRECHECK] AUTH_ERROR ` +
                        `templateName="${campaign.templateName}" requestedLanguage="${resolved.selected?.language ?? requestedLanguage ?? "unknown"}" ` +
                        `resolvedPhoneNumberId="${campaign.phoneNumberId ?? "none"}" campaignId="${args.campaignId}"`;
                    logError(`[AUTH_ERROR_PRECHECK][Campaign] Auth failure for contact ${args.contactId}:`, {
                        templateName: campaign.templateName,
                        requestedLanguage: resolved.selected?.language ?? requestedLanguage ?? null,
                        approvedLanguage: resolved.selected?.language ?? null,
                        resolvedPhoneNumberId: campaign.phoneNumberId ?? null,
                        reasonCode: "AUTH_ERROR",
                        code,
                        error: errorMsg,
                        suggestion: "Reconnect this number in Integrations and retry the campaign.",
                    });
                    await ctx.runMutation(internal.campaigns.failCampaignForInvalidTemplate, {
                        campaignId: args.campaignId,
                        reason: authFailureReason,
                    });
                } else if (code === 132001 || (err as { code?: unknown }).code == 132001 || err.category === "INVALID_TEMPLATE") {
                    err.retryable = false;
                    if (attempt === 1) {
                        failedLanguage132001 = resolved.selected?.language ?? requestedLanguage ?? null;
                        logDebug("[Campaign] 132001/INVALID_TEMPLATE on first attempt; will sync and retry with fallback", {
                            contactId: args.contactId,
                            campaignId: args.campaignId,
                            failedLanguage: failedLanguage132001,
                        });
                        continue;
                    }
                    // Second attempt still failed: fail campaign and log
                    const invalidTemplateReason =
                        `${INVALID_TEMPLATE_PRECHECK_PREFIX} INVALID_TEMPLATE ` +
                        `templateName="${campaign.templateName}" requestedLanguage="${resolved.selected?.language ?? requestedLanguage ?? "unknown"}" ` +
                        `resolvedPhoneNumberId="${campaign.phoneNumberId ?? "none"}" campaignId="${args.campaignId}"`;
                    logError(`[INVALID_TEMPLATE_PRECHECK][Campaign] Invalid template for contact ${args.contactId}:`, {
                        templateName: campaign.templateName,
                        requestedLanguage: resolved.selected?.language ?? requestedLanguage ?? null,
                        approvedLanguage: null,
                        resolvedPhoneNumberId: campaign.phoneNumberId ?? null,
                        reasonCode: "INVALID_TEMPLATE",
                        code,
                        error: errorMsg,
                        suggestion: "Ensure template name exists and is approved for the exact language in WABA."
                    });
                    await ctx.runMutation(internal.campaigns.failCampaignForInvalidTemplate, {
                        campaignId: args.campaignId,
                        reason: invalidTemplateReason,
                    });
                    if (resolved?.selected?.templateId) {
                        try {
                            await ctx.runMutation(internal.templates.updateStatusById, {
                                id: resolved.selected.templateId,
                                status: "REJECTED",
                            });
                        } catch (markError) {
                            logWarn("[Campaign] Failed to mark template as REJECTED after 132001", {
                                templateId: resolved.selected.templateId,
                                campaignId: args.campaignId,
                                error: markError instanceof Error ? markError.message : String(markError),
                            });
                        }
                    }
                } else if (code === 80005 || code === 200) {
                    // Rate limit error - these are retryable
                    logWarn(`[Campaign] Retryable error (${code}) for contact ${args.contactId}: ${errorMsg}`);
                    // Re-throw to let the retrier handle it
                    throw err;
                } else {
                    // Unknown error - log details for debugging
                    logError(`[Campaign] Unexpected error for contact ${args.contactId}:`, {
                        code,
                        category: err.category,
                        message: errorMsg,
                        retryable: err.retryable,
                    });
                }

                // Log the failure
                await ctx.runMutation(internal.campaigns.logBatchResults, {
                    campaignId: args.campaignId,
                    logs: [{
                        contactId: args.contactId,
                        status: "failed",
                        error: `${code != null ? `[${code}] ` : ""}${errorMsg}`,
                    }],
                });
                await ctx.runMutation(internal.campaigns.finalizeCampaignIfDone, {
                    campaignId: args.campaignId,
                });
            }
        }
    }
});

export const getCampaignById = internalQuery({
    args: { id: v.id("campaigns") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    }
});

export const getContactById = internalQuery({
    args: { id: v.id("contacts") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    }
});
export const remove = mutation({
    args: { id: v.id("campaigns") },
    handler: async (ctx, args) => {
        // Check if campaign exists first
        const campaign = await ctx.db.get(args.id);
        if (!campaign) {
            logWarn(`[Campaign] Attempt to delete non-existent campaign: ${args.id}`);
            return false;
        }

        try {
            // Delete associated logs
            const logs = await ctx.db.query("campaign_logs")
                .withIndex("by_campaign", q => q.eq("campaignId", args.id))
                .collect();

            for (const log of logs) {
                try {
                    await ctx.db.delete(log._id);
                } catch (logError) {
                    logWarn(`[Campaign] Failed to delete log ${log._id}:`, logError);
                }
            }

            // Delete the campaign
            await ctx.db.delete(args.id);
            logDebug(`[Campaign] Successfully deleted campaign ${args.id} and ${logs.length} associated logs`);
            return true;
        } catch (error) {
            // Handle case where campaign was deleted between check and delete
            const err = error as Error & { code?: string };
            if (err.code === "InvalidId" || err.message?.includes("nonexistent")) {
                logWarn(`[Campaign] Campaign ${args.id} was already deleted`);
                return false;
            }
            throw error;
        }
    }
});

export const recalculateStats = mutation({
    args: { campaignId: v.id("campaigns") },
    handler: async (ctx, args) => {
        const logs = await ctx.db
            .query("campaign_logs")
            .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
            .collect();

        const stats = {
            total: logs.length, // Or keep original total if it includes pending?
            sent: 0,
            delivered: 0,
            read: 0,
            failed: 0
        };

        for (const log of logs) {
            if (log.status === 'sent') stats.sent++;
            if (log.status === 'delivered') {
                stats.sent++;
                stats.delivered++;
            }
            if (log.status === 'read') {
                stats.sent++;
                stats.delivered++;
                stats.read++;
            }
            if (log.status === 'failed') stats.failed++;
        }

        // Preserve total from existing if it's larger (meaning pending messages)
        const campaign = await ctx.db.get(args.campaignId);
        if (campaign) {
            stats.total = Math.max(stats.total, campaign.stats.total);
            await ctx.db.patch(args.campaignId, { stats });
        }
        return stats;
    }
});

export const getCampaignContacts = internalQuery({
    args: { campaignId: v.id("campaigns"), limit: v.number() },
    handler: async (ctx, args) => {
        const campaign = await ctx.db.get(args.campaignId);
        if (!campaign) return [];

        // 1. Direct Selection
        if (campaign.targetContactIds && campaign.targetContactIds.length > 0) {
            // Fetch specific contacts
            const contacts = await Promise.all(
                campaign.targetContactIds.map(id => ctx.db.get(id))
            );
            return contacts.filter(c => c !== null);
        }

        // 2. Tag Filtering (Naive implementation for now)
        // Ideally we use a separate index or search, but for <10k contacts this might be okay-ish for MVP
        const q = ctx.db.query("contacts");
        let contacts = await q.take(args.limit);

        if (campaign.targetTags && campaign.targetTags.length > 0) {
            contacts = contacts.filter(c =>
                c.tags?.some(tag => campaign.targetTags?.includes(tag))
            );
        }

        return contacts;
    }
});

export const getBatchForProcessing = internalQuery({
    args: { campaignId: v.id("campaigns"), cursor: v.union(v.string(), v.null()), limit: v.number() },
    handler: async (ctx, args) => {
        const campaign = await ctx.db.get(args.campaignId);
        if (!campaign) throw new Error("Campaign not found");

        const templateName = campaign.templateName;
        const sendingConfig = campaign.sendingConfig;

        // Only send to selected audience: targetContactIds, targetTags, or all
        if (campaign.targetContactIds && campaign.targetContactIds.length > 0) {
            const contacts = await Promise.all(
                campaign.targetContactIds.map(id => ctx.db.get(id))
            );
            const list = contacts.filter((c): c is NonNullable<typeof c> => c !== null);
            const offset = args.cursor != null ? parseInt(args.cursor, 10) : 0;
            const page = list.slice(offset, offset + args.limit);
            const nextCursor = offset + args.limit < list.length ? String(offset + args.limit) : null;
            return { contacts: page, nextCursor, templateName, sendingConfig };
        }

        if (campaign.targetTags && campaign.targetTags.length > 0) {
            const all = await ctx.db.query("contacts").take(50000);
            const list = all.filter(c =>
                c.tags?.some(tag => campaign.targetTags?.includes(tag))
            );
            const offset = args.cursor != null ? parseInt(args.cursor, 10) : 0;
            const page = list.slice(offset, offset + args.limit);
            const nextCursor = offset + args.limit < list.length ? String(offset + args.limit) : null;
            return { contacts: page, nextCursor, templateName, sendingConfig };
        }

        // No targeting: all contacts, use Convex pagination
        const q = ctx.db.query("contacts").order("desc");
        const result = await q.paginate({ cursor: args.cursor, numItems: args.limit });
        return {
            contacts: result.page,
            nextCursor: result.continueCursor,
            templateName,
            sendingConfig
        };
    }
});

export const updateStatus = internalMutation({
    args: { campaignId: v.id("campaigns"), status: v.string(), total: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const updates: { status: "DRAFT" | "SCHEDULED" | "PROCESSING" | "COMPLETED" | "FAILED" | "PAUSED"; stats?: { total: number; sent: number; delivered: number; read: number; failed: number; skipped?: number } } = { status: args.status as "DRAFT" | "SCHEDULED" | "PROCESSING" | "COMPLETED" | "FAILED" | "PAUSED" };
        if (args.total !== undefined) updates.stats = { total: args.total, sent: 0, delivered: 0, read: 0, failed: 0, skipped: 0 };

        // Proper merge
        const campaign = await ctx.db.get(args.campaignId);
        if (campaign && args.total !== undefined) {
            updates.stats = { ...campaign.stats, total: args.total, skipped: campaign.stats.skipped || 0 };
        }

        await ctx.db.patch(args.campaignId, updates);
    }
});

export const finalizeCampaignIfDone = internalMutation({
    args: { campaignId: v.id("campaigns") },
    handler: async (ctx, args) => {
        const campaign = await ctx.db.get(args.campaignId);
        if (!campaign || campaign.status !== "PROCESSING") {
            return { done: false as const, status: campaign?.status ?? null };
        }
        const skipped = campaign.stats.skipped || 0;
        const doneCount = campaign.stats.sent + campaign.stats.failed + skipped;
        if (campaign.stats.total <= 0 || doneCount < campaign.stats.total) {
            return { done: false as const, status: campaign.status };
        }

        const nextStatus =
            campaign.stats.sent > 0 || skipped > 0
                ? ("COMPLETED" as const)
                : ("FAILED" as const);
        await ctx.db.patch(args.campaignId, { status: nextStatus });
        return { done: true as const, status: nextStatus };
    },
});

export const listProcessingCampaigns = internalQuery({
    args: {},
    handler: async (ctx) => {
        return await ctx.db
            .query("campaigns")
            .filter((q: any) => q.eq(q.field("status"), "PROCESSING"))
            .collect();
    },
});

export const getLatestCampaignLogTimestamp = internalQuery({
    args: { campaignId: v.id("campaigns") },
    handler: async (ctx, args) => {
        const latest = await ctx.db
            .query("campaign_logs")
            .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
            .order("desc")
            .first();
        return latest?._creationTime ?? null;
    },
});

export const finalizeStaleProcessingCampaigns = internalAction({
    args: { staleMs: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const staleMs = args.staleMs ?? 15 * 60 * 1000;
        const now = Date.now();
        const processing: any[] = await ctx.runQuery(internal.campaigns.listProcessingCampaigns, {});
        let finalizedDone = 0;
        let finalizedStaleFailed = 0;

        for (const campaign of processing) {
            const done: any = await ctx.runMutation(internal.campaigns.finalizeCampaignIfDone, {
                campaignId: campaign._id,
            });
            if (done?.done) {
                finalizedDone++;
                continue;
            }

            const latestLogTime = await ctx.runQuery(internal.campaigns.getLatestCampaignLogTimestamp, {
                campaignId: campaign._id,
            });
            const lastActivity = Math.max(campaign.createdAt ?? 0, latestLogTime ?? 0, campaign.scheduledAt ?? 0);
            if (now - lastActivity > staleMs) {
                await ctx.runMutation(internal.campaigns.updateStatus, {
                    campaignId: campaign._id,
                    status: "FAILED",
                });
                finalizedStaleFailed++;
            }
        }

        return {
            scanned: processing.length,
            finalizedDone,
            finalizedStaleFailed,
            staleMs,
        };
    },
});

export const failCampaignForInvalidTemplate = internalMutation({
    args: {
        campaignId: v.id("campaigns"),
        reason: v.string(),
    },
    handler: async (ctx, args) => {
        const campaign = await ctx.db.get(args.campaignId);
        if (!campaign) {
            return {
                updated: false,
                recurringDisabled: false,
                previousStatus: null,
            };
        }

        let recurringDisabled = false;
        if (campaign.recurrenceCronSpec) {
            try {
                await crons.delete(ctx, { name: `campaign-${campaign._id}` });
                recurringDisabled = true;
            } catch (error) {
                logWarn("[Campaign] Failed to remove recurring cron while failing campaign", {
                    campaignId: campaign._id,
                    reason: args.reason,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        if (campaign.status !== "FAILED" || campaign.recurrenceCronSpec) {
            await ctx.db.patch(campaign._id, {
                status: "FAILED",
                recurrenceCronSpec: undefined,
            });
        }

        return {
            updated: campaign.status !== "FAILED",
            recurringDisabled,
            previousStatus: campaign.status,
        };
    },
});

export const listAllCampaigns = internalQuery({
    args: {},
    handler: async (ctx) => {
        return await ctx.db.query("campaigns").collect();
    },
});

export const listLogsForCampaign = internalQuery({
    args: { campaignId: v.id("campaigns") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("campaign_logs")
            .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
            .collect();
    },
});

export const cleanupInvalidTemplateCampaigns = internalAction({
    args: {
        templateNames: v.optional(v.array(v.string())),
        dryRun: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const dryRun = args.dryRun ?? false;
        const templateNames = (args.templateNames && args.templateNames.length > 0
            ? args.templateNames
            : DEFAULT_INVALID_TEMPLATE_NAMES
        )
            .map((name) => name.trim())
            .filter((name) => name.length > 0);
        const normalizedNames = new Set(templateNames.map((name) => name.toLowerCase()));

        const campaigns: any[] = await ctx.runQuery(internal.campaigns.listAllCampaigns, {});
        let affectedCampaigns = 0;
        let failedUpdated = 0;
        let recurringDisabled = 0;
        const affectedCampaignIds: string[] = [];

        for (const campaign of campaigns) {
            const campaignTemplateName = String(campaign.templateName || "").toLowerCase();
            let hasInvalidReference = normalizedNames.has(campaignTemplateName);

            if (!hasInvalidReference) {
                const logs: any[] = await ctx.runQuery(internal.campaigns.listLogsForCampaign, {
                    campaignId: campaign._id,
                });
                hasInvalidReference = logs.some((log) => {
                    const error = String(log.error || "").toLowerCase();
                    if (!error) return false;
                    if (error.includes(INVALID_TEMPLATE_PRECHECK_PREFIX.toLowerCase())) return true;
                    if (error.includes("132001")) return true;
                    for (const templateName of normalizedNames) {
                        if (error.includes(templateName)) return true;
                    }
                    return false;
                });
            }

            if (!hasInvalidReference) continue;
            affectedCampaigns++;
            affectedCampaignIds.push(String(campaign._id));

            const isMutableStatus =
                campaign.status === "SCHEDULED" || campaign.status === "PROCESSING";
            if (!isMutableStatus) {
                continue;
            }

            if (dryRun) {
                failedUpdated++;
                if (campaign.recurrenceCronSpec) recurringDisabled++;
                continue;
            }

            const reason =
                `${INVALID_TEMPLATE_PRECHECK_PREFIX} TEMPLATE_NOT_FOUND ` +
                `templateName="${campaign.templateName}" campaignId="${campaign._id}"`;
            const result: any = await ctx.runMutation(internal.campaigns.failCampaignForInvalidTemplate, {
                campaignId: campaign._id,
                reason,
            });
            if (result?.updated) failedUpdated++;
            if (result?.recurringDisabled) recurringDisabled++;
        }

        return {
            scanned: campaigns.length,
            affectedCampaigns,
            failedUpdated,
            recurringDisabled,
            dryRun,
            templateNames,
            affectedCampaignIds: affectedCampaignIds.slice(0, 200),
        };
    },
});

export const reconcileInvalidTemplateCampaigns = internalAction({
    args: {
        dryRun: v.optional(v.boolean()),
        templateNames: v.optional(v.array(v.string())),
        include132001Logs: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const dryRun = args.dryRun ?? true;
        const include132001Logs = args.include132001Logs ?? true;
        const names = (args.templateNames ?? DEFAULT_INVALID_TEMPLATE_NAMES)
            .map((name) => name.trim().toLowerCase())
            .filter((name) => name.length > 0);
        const nameSet = new Set(names);
        const campaigns: any[] = await ctx.runQuery(internal.campaigns.listAllCampaigns, {});

        let scanned = 0;
        let candidateCampaigns = 0;
        let failedUpdated = 0;
        let recurringDisabled = 0;
        const affectedCampaignIds: string[] = [];

        for (const campaign of campaigns) {
            scanned++;
            if (campaign.status !== "SCHEDULED" && campaign.status !== "PROCESSING") continue;

            let shouldFail = nameSet.has(String(campaign.templateName || "").toLowerCase());
            if (!shouldFail && include132001Logs) {
                const logs: any[] = await ctx.runQuery(internal.campaigns.listLogsForCampaign, { campaignId: campaign._id });
                shouldFail = logs.some((log) => {
                    const error = String(log.error || "").toLowerCase();
                    return error.includes("132001") || error.includes(INVALID_TEMPLATE_PRECHECK_PREFIX.toLowerCase());
                });
            }
            if (!shouldFail) continue;

            candidateCampaigns++;
            affectedCampaignIds.push(String(campaign._id));
            if (dryRun) continue;

            const reason =
                `${INVALID_TEMPLATE_PRECHECK_PREFIX} RECONCILE_INVALID_TEMPLATE ` +
                `templateName="${campaign.templateName}" campaignId="${campaign._id}"`;
            const result: any = await ctx.runMutation(internal.campaigns.failCampaignForInvalidTemplate, {
                campaignId: campaign._id,
                reason,
            });
            if (result?.updated) failedUpdated++;
            if (result?.recurringDisabled) recurringDisabled++;
        }

        return {
            scanned,
            candidateCampaigns,
            failedUpdated,
            recurringDisabled,
            dryRun,
            include132001Logs,
            templateNames: names,
            affectedCampaignIds: affectedCampaignIds.slice(0, 200),
        };
    },
});

export const listRecentInvalidTemplateBlocks = query({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, args) => {
        const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);
        const logs = await ctx.db.query("campaign_logs").order("desc").take(limit * 5);
        const rows: Array<{
            campaignId: string;
            contactId: string;
            status: string;
            error: string;
            createdAt: number;
            campaignName: string | null;
            templateName: string | null;
        }> = [];

        for (const log of logs) {
            const error = String(log.error || "");
            if (
                !error.includes(INVALID_TEMPLATE_PRECHECK_PREFIX) &&
                !error.includes("132001")
            ) {
                continue;
            }
            const campaign = await ctx.db.get(log.campaignId);
            rows.push({
                campaignId: String(log.campaignId),
                contactId: String(log.contactId),
                status: log.status,
                error,
                createdAt: log._creationTime,
                campaignName: campaign?.name ?? null,
                templateName: campaign?.templateName ?? null,
            });
            if (rows.length >= limit) break;
        }

        return rows;
    },
});

export const logBatchResults = internalMutation({
    args: {
        campaignId: v.id("campaigns"),
        logs: v.array(v.object({
            contactId: v.id("contacts"),
            status: v.string(),
            metaId: v.optional(v.string()),
            error: v.optional(v.string()),
            skipReason: v.optional(v.string())  // "recently_contacted", "rate_limited", etc.
        }))
    },
    handler: async (ctx, args) => {
        const campaign = await ctx.db.get(args.campaignId);
        if (!campaign) return;

        let sent = 0, failed = 0, skipped = 0;

        for (const log of args.logs) {
            await ctx.db.insert("campaign_logs", {
                campaignId: args.campaignId,
                contactId: log.contactId,
                status: log.status as "sent" | "delivered" | "read" | "failed" | "skipped",
                metaMessageId: log.metaId,
                error: log.error,
                skipReason: log.skipReason
            });

            if (log.status === 'sent') sent++;
            if (log.status === 'failed') failed++;
            if (log.status === 'skipped') skipped++;
        }

        // Increment Stats
        await ctx.db.patch(args.campaignId, {
            stats: {
                ...campaign.stats,
                sent: campaign.stats.sent + sent,
                failed: campaign.stats.failed + failed,
                skipped: (campaign.stats.skipped || 0) + skipped
            }
        });
    }
});

// Update contact's last messaged timestamp for anti-spam tracking
export const updateContactLastMessaged = internalMutation({
    args: {
        contactId: v.id("contacts"),
        templateName: v.string()
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.contactId, {
            lastMessagedAt: Date.now(),
            lastMessagedTemplate: args.templateName
        });
    }
});

export const updateMessageStatus = internalMutation({
    args: {
        metaMessageId: v.string(),
        status: v.string(),
    },
    handler: async (ctx, args) => {
        const log = await ctx.db
            .query("campaign_logs")
            .withIndex("by_message_id", (q) => q.eq("metaMessageId", args.metaMessageId))
            .first();

        if (!log) {
            // Expected for non-campaign messages (e.g. agent/chat); no log noise.
            return false;
        }

        // Ignore if status is same
        if (log.status === args.status) {
            return true;
        }

        const oldStatus = log.status;
        const newStatus = args.status;

        // Valid statuses from Meta: sent, delivered, read, failed
        // Map to our schema types
        const mappedStatus = newStatus;
        if (!["sent", "delivered", "read", "failed"].includes(newStatus)) {
            // Meta might send 'deleted' or others, ignore or map
            return true;
        }

        await ctx.db.patch(log._id, { status: mappedStatus as "sent" | "delivered" | "read" | "failed" });

        // Update Campaign Stats
        const campaign = await ctx.db.get(log.campaignId);
        if (campaign) {
            const stats = { ...campaign.stats };

            if (mappedStatus === 'delivered' && oldStatus !== 'delivered' && oldStatus !== 'read') {
                stats.delivered++;
            } else if (mappedStatus === 'read' && oldStatus !== 'read') {
                stats.read++;
                // If it jumped from sent to read, it implies delivered too
                if (oldStatus === 'sent') {
                    stats.delivered++; // implied
                }
            } else if (mappedStatus === 'failed' && oldStatus !== 'failed') {
                stats.failed++;
            }

            await ctx.db.patch(campaign._id, { stats });
            logDebug(`[Campaigns] Stats updated:`, stats);
        } else {
            logError(`[Campaigns] Campaign not found for log ${log._id}`);
        }

        return true;
    }
});

// Front-end queries
export const list = query({
    args: { phoneNumberId: v.optional(v.union(v.string(), v.null())) },
    handler: async (ctx, args) => {
        const phoneNumberId = args.phoneNumberId ?? undefined;
        if (phoneNumberId) {
            return await ctx.db
                .query("campaigns")
                .withIndex("by_phone_number_id", (q) => q.eq("phoneNumberId", phoneNumberId))
                .order("desc")
                .take(20);
        }
        return await ctx.db.query("campaigns").order("desc").take(20);
    }
});

export const getCampaignLogs = query({
    args: { campaignId: v.id("campaigns") },
    handler: async (ctx, args) => {
        const logs = await ctx.db
            .query("campaign_logs")
            .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
            .collect();

        // Enrich with contact details
        const enrichedLogs = await Promise.all(
            logs.map(async (log) => {
                const contact = await ctx.db.get(log.contactId);
                return {
                    ...log,
                    contactName: contact?.name || "Unknown",
                    contactPhone: contact?.phone || "N/A",
                };
            })
        );

        return enrichedLogs;
    },
});

export const getContactSendHistory = query({
    args: {
        phone: v.string(),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const normalizedPhone = normalizePhone(args.phone);
        const maxRows = Math.min(Math.max(args.limit ?? 20, 1), 100);
        const contact = await ctx.db
            .query("contacts")
            .withIndex("by_phone", (q) => q.eq("phone", normalizedPhone))
            .first();
        if (!contact) return [];

        const logs = await ctx.db
            .query("campaign_logs")
            .order("desc")
            .take(300);
        const filtered = logs.filter((log) => String(log.contactId) === String(contact._id)).slice(0, maxRows);

        const history = await Promise.all(filtered.map(async (log) => {
            const campaign = await ctx.db.get(log.campaignId);
            const skipReason = log.skipReason ?? null;
            const error = log.error ?? null;
            let resolutionMode: string | null = null;
            if (skipReason && skipReason.startsWith("fallback:")) {
                resolutionMode = skipReason.replace("fallback:", "");
            } else if (error && error.includes("resolutionMode=\"")) {
                const match = error.match(/resolutionMode=\"([^\"]+)\"/);
                if (match) resolutionMode = match[1];
            }
            return {
                campaignId: String(log.campaignId),
                campaignName: campaign?.name ?? null,
                campaignStatus: campaign?.status ?? null,
                templateName: campaign?.templateName ?? null,
                templateId: campaign?.templateId ? String(campaign.templateId) : null,
                phoneNumberId: campaign?.phoneNumberId ?? null,
                status: log.status,
                skipReason,
                error,
                resolutionMode,
                createdAt: log._creationTime,
                contactPhone: contact.phone,
                contactName: contact.name,
            };
        }));

        return history;
    },
});

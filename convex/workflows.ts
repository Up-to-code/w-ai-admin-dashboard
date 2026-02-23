import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

export const list = query({
    args: { phoneNumberId: v.optional(v.string()) },
    handler: async (ctx, args) => {
        if (args.phoneNumberId) {
            return await ctx.db
                .query("workflows")
                .filter((q: any) => q.eq(q.field("phoneNumberId"), args.phoneNumberId))
                .order("desc")
                .collect();
        }
        return await ctx.db.query("workflows").order("desc").collect();
    }
});

export const create = mutation({
    args: {
        name: v.string(),
        trigger: v.string(),
        triggerConfig: v.any(),
        action: v.string(),
        actionConfig: v.any(),
        phoneNumberId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        return await ctx.db.insert("workflows", {
            phoneNumberId: args.phoneNumberId,
            name: args.name,
            trigger: args.trigger,
            triggerConfig: args.triggerConfig,
            action: args.action,
            actionConfig: args.actionConfig,
            enabled: true,
            stats: { runs: 0 },
            createdAt: Date.now(),
        });
    }
});

export const toggle = mutation({
    args: { id: v.id("workflows") },
    handler: async (ctx, args) => {
        const workflow = await ctx.db.get(args.id);
        if (workflow) {
            await ctx.db.patch(args.id, { enabled: !workflow.enabled });
        }
    }
});

export const update = mutation({
    args: {
        id: v.id("workflows"),
        name: v.string(),
        trigger: v.string(),
        triggerConfig: v.any(),
        action: v.string(),
        actionConfig: v.any(),
        phoneNumberId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, {
            phoneNumberId: args.phoneNumberId,
            name: args.name,
            trigger: args.trigger,
            triggerConfig: args.triggerConfig,
            action: args.action,
            actionConfig: args.actionConfig,
        });
    }
});

export const remove = mutation({
    args: { id: v.id("workflows") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
    }
});

// --- Execution Engine ---

async function executeWorkflowAction(ctx: any, workflow: any, contactPhone: string, contactId?: string, phoneNumberId?: string) {
    console.log(`[Workflows] Executing rule "${workflow.name}"`);

    // Increment stats
    await ctx.db.patch(workflow._id, {
        stats: {
            runs: (workflow.stats?.runs || 0) + 1,
            lastRun: Date.now()
        }
    });

    // Execute Action
    if (workflow.action === "send_template") {
        const scopedPhoneNumberId = phoneNumberId ?? workflow.phoneNumberId ?? undefined;
        const configuredTemplateId = workflow.actionConfig?.templateId;
        const configuredTemplateName = workflow.actionConfig?.template;
        const templateNameHint = configuredTemplateName ?? configuredTemplateId ?? "unknown";
        if (configuredTemplateId || configuredTemplateName) {
            try {
                const templateById = configuredTemplateId
                    ? await ctx.db.get(configuredTemplateId)
                    : null;
                const templateName = templateById?.name ?? configuredTemplateName;
                if (!templateName) {
                    throw new Error("Workflow template is missing template name.");
                }
                if (scopedPhoneNumberId) {
                    const number = await ctx.runQuery(internal.whatsappNumbers.getByBusinessNumberId, {
                        businessNumberId: scopedPhoneNumberId,
                    });
                    if (number?.tokenStatus === "auth_failed") {
                        console.error("[INVALID_TEMPLATE_PRECHECK][Workflows] Blocking template send due to auth_failed number", {
                            templateName,
                            requestedLanguage: workflow.actionConfig?.language ?? null,
                            approvedLanguage: null,
                            resolvedPhoneNumberId: scopedPhoneNumberId,
                            reasonCode: "AUTH_FAILED",
                            resolutionMode: null,
                        });
                        await ctx.scheduler.runAfter(0, internal.notifications.create, {
                            type: "warning",
                            title: "Workflow Template Send Blocked",
                            message: "Cannot sync/send templates for this number until the token is reconnected in Integrations.",
                            link: "/integrations",
                        });
                        return;
                    }
                }
                if (templateById && templateById.phoneNumberId !== scopedPhoneNumberId) {
                    throw new Error("Workflow template is no longer scoped to this sending number.");
                }

                const scopedTemplateByName = await ctx.runQuery(internal.templates.getTemplateByName, {
                    name: templateName,
                    phoneNumberId: scopedPhoneNumberId,
                });
                const requestedLanguage =
                    workflow.actionConfig?.language ??
                    templateById?.language ??
                    scopedTemplateByName?.language;
                const resolved: any = await ctx.runQuery(internal.templates.resolveTemplateForSend, {
                    templateName,
                    phoneNumberId: scopedPhoneNumberId,
                    requestedLanguage,
                    allowFallback: false,
                    requireScoped: true,
                });
                if (!resolved.ok) {
                    console.error("[INVALID_TEMPLATE_PRECHECK][Workflows] Blocking template send", {
                        templateName,
                        requestedLanguage: requestedLanguage ?? null,
                        approvedLanguage: null,
                        resolvedPhoneNumberId: scopedPhoneNumberId ?? null,
                        reasonCode: resolved.reasonCode,
                        resolutionMode: resolved.resolutionMode ?? null,
                    });
                    await ctx.scheduler.runAfter(0, internal.notifications.create, {
                        type: "warning",
                        title: "Workflow Template Validation Failed",
                        message: `[INVALID_TEMPLATE_PRECHECK] ${resolved.message}`,
                        link: "/templates",
                    });
                    return;
                }

                if (resolved.resolutionMode !== "scoped_exact") {
                    console.warn("[Workflows] Template resolved using fallback", {
                        templateName,
                        requestedLanguage: requestedLanguage ?? null,
                        approvedLanguage: resolved.selected?.language ?? null,
                        resolvedPhoneNumberId: scopedPhoneNumberId ?? null,
                        reasonCode: "FALLBACK_USED",
                        resolutionMode: resolved.resolutionMode,
                    });
                }

                const template = await ctx.db.get(resolved.selected.templateId);
                if (!template) {
                    await ctx.scheduler.runAfter(0, internal.notifications.create, {
                        type: "warning",
                        title: "Workflow Template Missing",
                        message: `Resolved template "${templateName}" could not be loaded.`,
                        link: "/templates",
                    });
                    return;
                }

                const components: any[] = [];
                for (const comp of template.components || []) {
                    if ((comp.type === "BODY" || comp.type === "body") && comp.example?.body_text) {
                        const texts = (comp.example.body_text as (string | string[])[]).flat();
                        components.push({
                            type: "body",
                            parameters: texts.map((t: string) => ({ type: "text", text: t || "1" })),
                        });
                    }
                    if ((comp.type === "HEADER" || comp.type === "header") && comp.format === "TEXT" && comp.example?.header_text) {
                        components.push({
                            type: "header",
                            parameters: comp.example.header_text.map((t: string) => ({ type: "text", text: t || "1" })),
                        });
                    }
                }

                await ctx.scheduler.runAfter(0, api.whatsapp.sendMessage, {
                    to: contactPhone,
                    type: "template",
                    content: {
                        name: resolved.selected.name,
                        language: { code: resolved.selected.language },
                        components,
                    },
                    phoneNumberId: scopedPhoneNumberId,
                });
                console.log(`[Workflows] Scheduled Template: ${templateName}`);
            } catch (error: any) {
                console.error(`[Workflows] send_template failed for "${templateNameHint}"`, error);
                await ctx.scheduler.runAfter(0, internal.notifications.create, {
                    type: "error",
                    title: "Workflow Send Failed",
                    message: error?.message || `Failed to schedule template "${templateNameHint}"`,
                    link: "/workflows",
                });
            }
        }
    } else if (workflow.action === "add_tag") {
        const tag = workflow.actionConfig?.tag;
        if (tag) {
            // If we have contactId, use it directly, otherwise search
            let contact = null;
            if (contactId) {
                contact = await ctx.db.get(contactId);
            } else {
                contact = await ctx.db
                    .query("contacts")
                    .withIndex("by_phone", (q: any) => q.eq("phone", contactPhone))
                    .first();
            }

            if (contact) {
                const tags = contact.tags || [];
                if (!tags.includes(tag)) {
                    await ctx.db.patch(contact._id, { tags: [...tags, tag] });
                    console.log(`[Workflows] Action: Added Tag "${tag}" to ${contactPhone}`);
                }
            }
        }
    } else if (workflow.action === "notify") {
        const message = workflow.actionConfig?.message || `Automation Rule "${workflow.name}" triggered.`;
        await ctx.scheduler.runAfter(0, internal.notifications.create, {
            type: "info",
            title: "Automation Alert",
            message: message,
            link: "/workflows"
        });
    } else if (workflow.action === "remove_tag") {
        const tag = workflow.actionConfig?.tag;
        if (tag) {
            let contact = null;
            if (contactId) {
                contact = await ctx.db.get(contactId);
            } else {
                contact = await ctx.db
                    .query("contacts")
                    .withIndex("by_phone", (q: any) => q.eq("phone", contactPhone))
                    .first();
            }

            if (contact && contact.tags && contact.tags.includes(tag)) {
                const newTags = contact.tags.filter((t: string) => t !== tag);
                await ctx.db.patch(contact._id, { tags: newTags });
                console.log(`[Workflows] Action: Removed Tag "${tag}" from ${contactPhone}`);
            }
        }
    } else if (workflow.action === "assign_user") {
        const userId = workflow.actionConfig?.userId;
        if (userId) {
            // Find chat for this contact; when phoneNumberId is provided (message path), scope by number
            let chat;
            if (phoneNumberId) {
                chat = await ctx.db
                    .query("chats")
                    .filter((q: any) =>
                        q.and(
                            q.eq(q.field("contactPhone"), contactPhone),
                            q.eq(q.field("phoneNumberId"), phoneNumberId)
                        )
                    )
                    .first();
            } else {
                chat = await ctx.db
                    .query("chats")
                    .filter((q: any) => q.eq(q.field("contactPhone"), contactPhone))
                    .first();
            }

            if (chat) {
                await ctx.db.patch(chat._id, { assignedTo: userId });
                console.log(`[Workflows] Action: Assigned chat ${chat._id} to user ${userId}`);
            }
        }
    }
}

export const checkAndExecuteWorkflows = internalMutation({
    args: {
        messageId: v.id("messages"),
        content: v.string(),
        contactPhone: v.string(),
        phoneNumberId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // 1. Fetch Active Workflows
        const workflows = await ctx.db.query("workflows").collect();

        if (workflows.length === 0) return;

        console.log(`[Workflows] Checking ${workflows.length} rules for message: ${args.messageId}`);

        for (const workflow of workflows) {
            if (!workflow.enabled) continue;
            if (workflow.phoneNumberId && workflow.phoneNumberId !== args.phoneNumberId) continue;
            let matched = false;

            // 2. Check Triggers
            if (workflow.trigger === "new_message") {
                matched = true;
            } else if (workflow.trigger === "keyword") {
                const keyword = workflow.triggerConfig?.keyword?.toLowerCase();
                if (keyword && args.content.toLowerCase().includes(keyword)) {
                    matched = true;
                }
            }

            // 3. Execute Action if Matched
            if (matched) {
                await executeWorkflowAction(ctx, workflow, args.contactPhone, undefined, args.phoneNumberId);
            }
        }
    }
});

export const checkContactWorkflows = internalMutation({
    args: {
        contactId: v.id("contacts"),
        contactPhone: v.string(),
        isNew: v.boolean(),
        phoneNumberId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const workflows = await ctx.db.query("workflows").collect();

        for (const workflow of workflows) {
            if (!workflow.enabled) continue;
            if (workflow.phoneNumberId && workflow.phoneNumberId !== args.phoneNumberId) continue;
            if (workflow.trigger === "contact_created" && args.isNew) {
                await executeWorkflowAction(ctx, workflow, args.contactPhone, args.contactId, args.phoneNumberId);
            }
        }
    }
});
export const checkTagWorkflows = internalMutation({
    args: {
        contactId: v.id("contacts"),
        contactPhone: v.string(),
        addedTag: v.string(),
        phoneNumberId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const workflows = await ctx.db.query("workflows").collect();

        for (const workflow of workflows) {
            if (!workflow.enabled) continue;
            if (workflow.phoneNumberId && workflow.phoneNumberId !== args.phoneNumberId) continue;
            if (workflow.trigger === "tag_added") {
                // Check if this is the specific tag we are looking for (optional, if UI supports specific tag trigger)
                // Assuming triggerConfig.tag might exist, or it triggers on ANY tag if empty
                const targetTag = workflow.triggerConfig?.tag;

                if (!targetTag || targetTag === args.addedTag) {
                    await executeWorkflowAction(ctx, workflow, args.contactPhone, args.contactId, args.phoneNumberId);
                }
            }
        }
    }
});

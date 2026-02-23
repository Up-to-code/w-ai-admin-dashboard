import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const DEFAULT_IMPORTED_NAME = "عميل بدون اسم";

function toAsciiDigits(value: string) {
    return value
        .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
        .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776));
}

function normalizePhone(value: string) {
    return toAsciiDigits(value).replace(/\D/g, "");
}

export const list = query({
    args: {
        search: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        limit: v.optional(v.number())
    },
    handler: async (ctx, args) => {
        const q = ctx.db.query("contacts");

        // Note: Simple filtering for now. For scale, we'd use search capabilities or more indexes.
        if (args.limit) {
            return await q.take(args.limit);
        }
        return await q.collect();
    },
});

export const create = mutation({
    args: {
        name: v.string(),
        phone: v.string(),
        email: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        stage: v.optional(v.string()),
        customFields: v.optional(v.any()),
        phoneNumberId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const id = await ctx.db.insert("contacts", {
            name: args.name,
            phone: args.phone,
            email: args.email,
            tags: args.tags || [],
            stage: args.stage,
            customFields: args.customFields || {},
            isSubscribed: true,
            createdAt: Date.now(),
        });

        // Trigger Workflows for new contact
        await ctx.scheduler.runAfter(0, internal.workflows.checkContactWorkflows, {
            contactId: id,
            contactPhone: args.phone,
            isNew: true,
            phoneNumberId: args.phoneNumberId,
        });

        // Trigger Workflows for added tags
        if (args.tags && args.tags.length > 0) {
            for (const tag of args.tags) {
                await ctx.scheduler.runAfter(0, internal.workflows.checkTagWorkflows, {
                    contactId: id,
                    contactPhone: args.phone,
                    addedTag: tag,
                    phoneNumberId: args.phoneNumberId,
                });
            }
        }

        return id;
    },
});

export const update = mutation({
    args: {
        id: v.id("contacts"),
        name: v.optional(v.string()),
        email: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        stage: v.optional(v.string()),
        phoneNumberId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const contact = await ctx.db.get(args.id);
        if (!contact) throw new Error("Contact not found");

        // Calculate added tags
        if (args.tags) {
            const oldTags = contact.tags || [];
            const addedTags = args.tags.filter(t => !oldTags.includes(t));

            for (const tag of addedTags) {
                await ctx.scheduler.runAfter(0, internal.workflows.checkTagWorkflows, {
                    contactId: args.id,
                    contactPhone: contact.phone,
                    addedTag: tag,
                    phoneNumberId: args.phoneNumberId,
                });
            }
        }

        await ctx.db.patch(args.id, {
            name: args.name,
            email: args.email,
            tags: args.tags,
            stage: args.stage,
        });
    },
});

export const bulkCreate = mutation({
    args: {
        contacts: v.array(v.object({
            name: v.string(),
            phone: v.string(),
            email: v.optional(v.string()),
            tags: v.optional(v.array(v.string())),
            stage: v.optional(v.string()),
        })),
        skipDuplicates: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const skipDuplicates = args.skipDuplicates !== false;
        const seenPhones = new Set<string>();

        let importedCount = 0;
        let skippedDuplicateCount = 0;
        let skippedInvalidCount = 0;
        let completedNameCount = 0;
        let totalProcessed = 0;

        for (const contact of args.contacts) {
            totalProcessed += 1;

            const normalizedPhone = normalizePhone(contact.phone);
            if (normalizedPhone.length < 7 || normalizedPhone.length > 15) {
                skippedInvalidCount += 1;
                continue;
            }

            if (skipDuplicates) {
                if (seenPhones.has(normalizedPhone)) {
                    skippedDuplicateCount += 1;
                    continue;
                }

                const existing = await ctx.db
                    .query("contacts")
                    .withIndex("by_phone", (q) => q.eq("phone", normalizedPhone))
                    .first();

                if (existing) {
                    skippedDuplicateCount += 1;
                    continue;
                }

                seenPhones.add(normalizedPhone);
            }

            const name = contact.name.trim() || DEFAULT_IMPORTED_NAME;
            if (!contact.name.trim()) {
                completedNameCount += 1;
            }

            const email = contact.email?.trim() || undefined;
            const stage = contact.stage?.trim() || undefined;
            const tags = Array.from(
                new Set((contact.tags || []).map((tag) => tag.trim()).filter(Boolean))
            );

            await ctx.db.insert("contacts", {
                name,
                phone: normalizedPhone,
                email,
                tags,
                stage,
                isSubscribed: true,
                createdAt: Date.now(),
            });

            importedCount += 1;
        }

        return {
            importedCount,
            skippedDuplicateCount,
            skippedInvalidCount,
            completedNameCount,
            totalProcessed,
        };
    },
});

export const getById = query({
    args: { id: v.id("contacts") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.id);
    },
});

export const remove = mutation({
    args: { id: v.id("contacts") },
    handler: async (ctx, args) => {
        const contact = await ctx.db.get(args.id);
        if (!contact) throw new Error("Contact not found");
        await ctx.db.delete(args.id);
        return { success: true };
    },
});

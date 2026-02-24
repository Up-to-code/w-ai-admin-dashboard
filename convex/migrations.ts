import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const backfillTemplatePhoneNumberScope = mutation({
  args: { defaultPhoneNumberId: v.string() },
  handler: async (ctx, args) => {
    const templates = await ctx.db.query("templates").collect();
    let patched = 0;
    for (const template of templates) {
      if (!template.phoneNumberId) {
        await ctx.db.patch(template._id, { phoneNumberId: args.defaultPhoneNumberId });
        patched += 1;
      }
    }
    return { patched };
  },
});

export const backfillWorkflowPhoneNumberScope = mutation({
  args: { defaultPhoneNumberId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const workflows = await ctx.db.query("workflows").collect();
    let patched = 0;
    for (const workflow of workflows) {
      if (!workflow.phoneNumberId && args.defaultPhoneNumberId) {
        await ctx.db.patch(workflow._id, { phoneNumberId: args.defaultPhoneNumberId });
        patched += 1;
      }
    }
    return { patched };
  },
});

export const cleanupTemplatesForStrictNumberScope = mutation({
  args: {},
  handler: async (ctx) => {
    const templates = await ctx.db.query("templates").collect();
    let removedGlobalCount = 0;
    for (const template of templates) {
      if (!template.phoneNumberId) {
        await ctx.db.delete(template._id);
        removedGlobalCount += 1;
      }
    }

    const scopedTemplates = templates.filter((template) => !!template.phoneNumberId);
    const grouped = new Map<string, typeof scopedTemplates>();
    for (const template of scopedTemplates) {
      const language = (template.language || "").trim().toLowerCase().replace("-", "_");
      const key = `${template.phoneNumberId}\0${template.name}\0${language}`;
      const list = grouped.get(key) ?? [];
      list.push(template);
      grouped.set(key, list);
    }

    let dedupedCount = 0;
    for (const list of grouped.values()) {
      if (list.length <= 1) continue;
      const sorted = list
        .slice()
        .sort((a, b) => (b.lastSyncedAt ?? b._creationTime) - (a.lastSyncedAt ?? a._creationTime));
      for (const duplicate of sorted.slice(1)) {
        await ctx.db.delete(duplicate._id);
        dedupedCount += 1;
      }
    }

    return {
      removedGlobalCount,
      dedupedCount,
    };
  },
});

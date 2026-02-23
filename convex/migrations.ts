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

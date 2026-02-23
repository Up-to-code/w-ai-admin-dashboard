import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const saveFileRecord = internalMutation({
    args: {
        storageId: v.string(),
        name: v.string(),
        mimeType: v.string(),
        size: v.number(),
        category: v.optional(v.string())
    },
    handler: async (ctx, args) => {
        // Get URL
        const url = await ctx.storage.getUrl(args.storageId);
        if (!url) throw new Error("Could not get URL for storage ID");

        const user = (await ctx.db.query("users").first()) ?? (await ctx.db.insert("users", { name: "System", role: "admin" }) && await ctx.db.query("users").first());

        const fileId = await ctx.db.insert("files", {
            storageId: args.storageId,
            url,
            name: args.name,
            mimeType: args.mimeType,
            size: args.size,
            category: args.category || "general",
            uploadedBy: user!._id,
            createdAt: Date.now()
        });

        return { fileId, url };
    }
});

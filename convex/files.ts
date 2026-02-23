import { mutation, query, action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
});


export const saveFile = mutation({
  args: {
    storageId: v.string(),
    name: v.string(),
    mimeType: v.string(),
    size: v.number(),
    category: v.optional(v.string())
  },
  handler: async (ctx, args): Promise<{ fileId: Id<"files">; url: string | null }> => {
    return await ctx.runMutation((internal as any).filesInternal.saveFileRecord, args);
  },
});

export const list = query({
  args: {
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.category) {
      return await ctx.db
        .query("files")
        .withIndex("by_category", (q) => q.eq("category", args.category))
        .order("desc")
        .collect();
    }
    return await ctx.db.query("files").order("desc").collect();
  }
});

export const saveExternalImage = action({
  args: {
    url: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args): Promise<{ storageId: string; fileId: Id<"files">; mimeType: string }> => {
    // 1. Fetch the image
    const response = await fetch(args.url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const blob = await response.blob();

    // 2. Store in Convex Storage
    const storageId = await ctx.storage.store(blob);

    // 3. Save Metadata via Mutation
    const { fileId, url } = await ctx.runMutation((internal as any).filesInternal.saveFileRecord, {
      storageId,
      name: args.name,
      mimeType: blob.type || "image/jpeg",
      size: blob.size,
      category: "product",
    });

    return { storageId, fileId, mimeType: blob.type || "image/jpeg" };
  },
});

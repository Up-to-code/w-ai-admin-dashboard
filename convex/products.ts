import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.search) {
      // Use Full Text Search
      return await ctx.db
        .query("products")
        .withSearchIndex("search_products", (q) => 
            q.search("name", args.search!)
             //.eq("inStock", true) // Optional: filter only in stock
        )
        .take(10);
    }
    
    // Default list (no search)
    return await ctx.db.query("products").take(50);
  },
});

export const getById = query({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

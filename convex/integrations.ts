import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const syncProducts = mutation({
  args: { apiKey: v.string() },
  handler: async (ctx, args) => {
    // Mock sync
    await ctx.db.insert("products", {
      externalId: "solo_123",
      name: "Sample Product from SOLO",
      price: 99.99,
      currency: "USD",
      inStock: true,
    });
  },
});

export const listProducts = query({
  handler: async (ctx) => {
    return await ctx.db.query("products").collect();
  },
});

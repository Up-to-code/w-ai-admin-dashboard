import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Update user profile
export const updateProfile = mutation({
  args: { 
    userId: v.id("users"),
    name: v.optional(v.string()),
    email: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { userId, ...updates } = args;
    await ctx.db.patch(userId, updates);
    return true;
  },
});

export const getProfile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

/** For settings page: current user role for permission-aware UI. Uses first user when no auth (single-tenant); later wire to ctx.auth.getUserIdentity() + lookup by tokenIdentifier. */
export const getCurrentUserRole = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity?.tokenIdentifier) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
        .first();
      if (user) return { role: user.role as "admin" | "agent" | "user" };
    }
    const first = await ctx.db.query("users").first();
    if (first) return { role: first.role as "admin" | "agent" | "user" };
    return null;
  },
});

export const updateRole = mutation({
  args: { 
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("agent"), v.literal("user"))
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("المستخدم غير موجود");
    
    await ctx.db.patch(args.userId, { role: args.role });
    return true;
  },
});

import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

const ENRICHMENT_MODEL = process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-lite-preview-02-05:free";

function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeImages(images: Array<{ storageId?: string; url: string; alt?: string; order: number }>) {
  return images
    .filter((img) => !!img.url?.trim())
    .map((img, index) => ({
      storageId: img.storageId,
      url: img.url.trim(),
      alt: img.alt?.trim() || undefined,
      order: Number.isFinite(img.order) ? img.order : index,
    }))
    .sort((a, b) => a.order - b.order)
    .map((img, index) => ({ ...img, order: index }));
}

async function enrichProductData(args: { title: string; description: string }) {
  const apiKey = process.env.OPENROUTER_KEY;
  if (!apiKey) {
    return {
      categoryName: "Uncategorized",
      categoryDescription: "",
      advice: "",
      shortSummary: args.description.slice(0, 160),
      keywords: [] as string[],
    };
  }

  const prompt = `Analyze this product and return strict JSON with keys: categoryName, categoryDescription, advice, shortSummary, keywords.\nProduct title: ${args.title}\nDescription: ${args.description}\nRules: keywords is array of max 6 short terms. Keep advice concise for sales assistant.`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: ENRICHMENT_MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    return {
      categoryName: "Uncategorized",
      categoryDescription: "",
      advice: "",
      shortSummary: args.description.slice(0, 160),
      keywords: [] as string[],
    };
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  let parsed: any = {};
  try {
    parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
  } catch {
    parsed = {};
  }

  return {
    categoryName: String(parsed.categoryName || "Uncategorized").slice(0, 80),
    categoryDescription: String(parsed.categoryDescription || "").slice(0, 200),
    advice: String(parsed.advice || "").slice(0, 500),
    shortSummary: String(parsed.shortSummary || args.description).slice(0, 240),
    keywords: Array.isArray(parsed.keywords)
      ? parsed.keywords.map((k: unknown) => String(k).trim()).filter(Boolean).slice(0, 6)
      : [],
  };
}

async function upsertProductKnowledgeInternal(
  ctx: any,
  args: {
    productId: any;
    phoneNumberId: string;
    title: string;
    description: string;
    categoryName?: string;
    advice?: string;
    summary?: string;
  }
) {
  const content = [
    `Product: ${args.title}`,
    args.categoryName ? `Category: ${args.categoryName}` : "",
    `Description: ${args.description}`,
    args.summary ? `Summary: ${args.summary}` : "",
    args.advice ? `Advice: ${args.advice}` : "",
  ].filter(Boolean).join("\n");

  const embedding = await ctx.runAction((internal as any).ai.embedText, {
    text: `${args.title}\n${content}`.slice(0, 8000),
  });

  await ctx.runMutation((internal as any).ai.upsertKnowledgeBySourceRef, {
    phoneNumberId: args.phoneNumberId,
    sourceRef: `manual_product:${String(args.productId)}`,
    title: args.title,
    content,
    embedding,
    sourceType: "manual_product",
  });
}

export const getCategoryById = internalQuery({
  args: { categoryId: v.optional(v.id("product_categories")) },
  handler: async (ctx, args) => {
    if (!args.categoryId) return null;
    return await ctx.db.get(args.categoryId);
  },
});

export const listCategories = query({
  args: {
    phoneNumberId: v.string(),
    search: v.optional(v.string()),
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("product_categories")
      .withIndex("by_phone_updated", (q) => q.eq("phoneNumberId", args.phoneNumberId))
      .order("desc")
      .collect();

    const products = await ctx.db
      .query("manual_products")
      .withIndex("by_phone_updated", (q) => q.eq("phoneNumberId", args.phoneNumberId))
      .collect();

    const counts = new Map<string, number>();
    for (const p of products) {
      if (!p.categoryId) continue;
      counts.set(String(p.categoryId), (counts.get(String(p.categoryId)) || 0) + 1);
    }

    const q = args.search?.trim().toLowerCase();
    return rows
      .filter((row) => (args.includeInactive ? true : row.isActive))
      .filter((row) => (q ? row.name.toLowerCase().includes(q) || row.slug.toLowerCase().includes(q) : true))
      .map((row) => ({
        ...row,
        productsCount: counts.get(String(row._id)) || 0,
      }));
  },
});

export const createCategory = mutation({
  args: {
    phoneNumberId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    if (name.length < 2) throw new Error("Category name must be at least 2 characters");
    const slug = normalizeSlug(name);
    if (!slug) throw new Error("Invalid category name");

    const existing = await ctx.db
      .query("product_categories")
      .withIndex("by_phone_slug", (q) => q.eq("phoneNumberId", args.phoneNumberId).eq("slug", slug))
      .first();
    if (existing) throw new Error("Category already exists");

    const now = Date.now();
    return await ctx.db.insert("product_categories", {
      phoneNumberId: args.phoneNumberId,
      name,
      slug,
      description: args.description?.trim() || undefined,
      source: "manual",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateCategory = mutation({
  args: {
    categoryId: v.id("product_categories"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.categoryId);
    if (!existing) throw new Error("Category not found");

    const patch: Record<string, unknown> = { updatedAt: Date.now() };

    if (args.name !== undefined) {
      const name = args.name.trim();
      if (name.length < 2) throw new Error("Category name must be at least 2 characters");
      const slug = normalizeSlug(name);
      const duplicate = await ctx.db
        .query("product_categories")
        .withIndex("by_phone_slug", (q) => q.eq("phoneNumberId", existing.phoneNumberId).eq("slug", slug))
        .first();
      if (duplicate && duplicate._id !== existing._id) {
        throw new Error("Category already exists");
      }
      patch.name = name;
      patch.slug = slug;
    }

    if (args.description !== undefined) patch.description = args.description.trim() || undefined;
    if (args.isActive !== undefined) patch.isActive = args.isActive;

    await ctx.db.patch(args.categoryId, patch);
    return args.categoryId;
  },
});

export const deleteCategory = mutation({
  args: {
    categoryId: v.id("product_categories"),
    reassignToCategoryId: v.optional(v.id("product_categories")),
  },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.categoryId);
    if (!category) throw new Error("Category not found");

    const products = await ctx.db
      .query("manual_products")
      .withIndex("by_phone_category", (q) => q.eq("phoneNumberId", category.phoneNumberId).eq("categoryId", args.categoryId))
      .collect();

    if (products.length > 0 && !args.reassignToCategoryId) {
      throw new Error("Category has products. Reassign products before deleting.");
    }

    let reassignCategoryName: string | undefined;
    if (args.reassignToCategoryId) {
      const toCategory = await ctx.db.get(args.reassignToCategoryId);
      if (!toCategory || toCategory.phoneNumberId !== category.phoneNumberId) {
        throw new Error("Invalid reassignment category");
      }
      reassignCategoryName = toCategory.name;
    }

    for (const product of products) {
      await ctx.db.patch(product._id, {
        categoryId: args.reassignToCategoryId,
        categoryNameSnapshot: reassignCategoryName,
        updatedAt: Date.now(),
      });
    }

    await ctx.db.delete(args.categoryId);
    return { deleted: true, movedProducts: products.length };
  },
});

export const listManualProducts = query({
  args: {
    phoneNumberId: v.string(),
    search: v.optional(v.string()),
    categoryId: v.optional(v.id("product_categories")),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const page = Math.max(1, args.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, args.pageSize ?? 12));

    const search = args.search?.trim();
    let rows: any[] = [];

    if (search) {
      rows = await ctx.db
        .query("manual_products")
        .withSearchIndex("search_manual_products", (q) => q.search("title", search).eq("phoneNumberId", args.phoneNumberId))
        .take(200);
    } else {
      rows = await ctx.db
        .query("manual_products")
        .withIndex("by_phone_updated", (q) => q.eq("phoneNumberId", args.phoneNumberId))
        .order("desc")
        .collect();
    }

    rows = rows.filter((row) => (args.categoryId ? row.categoryId === args.categoryId : true));

    const total = rows.length;
    const start = (page - 1) * pageSize;
    const items = rows.slice(start, start + pageSize);

    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  },
});

export const getManualProduct = query({
  args: { id: v.id("manual_products") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const enrichManualProduct = action({
  args: {
    phoneNumberId: v.string(),
    title: v.string(),
    description: v.string(),
  },
  handler: async (_ctx, args) => {
    return enrichProductData({ title: args.title, description: args.description });
  },
});

export const upsertProductKnowledge = action({
  args: {
    productId: v.id("manual_products"),
    phoneNumberId: v.string(),
    title: v.string(),
    description: v.string(),
    categoryName: v.optional(v.string()),
    advice: v.optional(v.string()),
    summary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await upsertProductKnowledgeInternal(ctx, args);
  },
});

export const upsertCategoryFromAi = internalMutation({
  args: {
    phoneNumberId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedName = args.name.trim() || "Uncategorized";
    const slug = normalizeSlug(normalizedName) || "uncategorized";
    const existing = await ctx.db
      .query("product_categories")
      .withIndex("by_phone_slug", (q) => q.eq("phoneNumberId", args.phoneNumberId).eq("slug", slug))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        description: args.description?.trim() || existing.description,
        updatedAt: Date.now(),
      });
      return { categoryId: existing._id, categoryName: existing.name };
    }

    const now = Date.now();
    const categoryId = await ctx.db.insert("product_categories", {
      phoneNumberId: args.phoneNumberId,
      name: normalizedName,
      slug,
      description: args.description?.trim() || undefined,
      source: "ai",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    return { categoryId, categoryName: normalizedName };
  },
});

export const createManualProduct = action({
  args: {
    phoneNumberId: v.string(),
    title: v.string(),
    description: v.string(),
    images: v.array(v.object({
      storageId: v.optional(v.string()),
      url: v.string(),
      alt: v.optional(v.string()),
      order: v.number(),
    })),
    categoryId: v.optional(v.id("product_categories")),
  },
  handler: async (ctx, args) => {
    const title = args.title.trim();
    const description = args.description.trim();
    const images = normalizeImages(args.images);

    if (title.length < 2) throw new Error("Product title must be at least 2 characters");
    if (description.length < 10) throw new Error("Product description must be at least 10 characters");
    if (images.length < 1) throw new Error("At least one product image is required");

    const enrichment = await enrichProductData({ title, description });

    const aiCategory: any = await ctx.runMutation((internal as any).manualCatalog.upsertCategoryFromAi, {
      phoneNumberId: args.phoneNumberId,
      name: enrichment.categoryName,
      description: enrichment.categoryDescription,
    });

    const explicitCategory: any = await ctx.runQuery((internal as any).manualCatalog.getCategoryById, {
      categoryId: args.categoryId,
    });
    if (explicitCategory && explicitCategory.phoneNumberId !== args.phoneNumberId) {
      throw new Error("Selected category does not belong to this number");
    }
    const finalCategoryId = explicitCategory?._id || aiCategory.categoryId;
    const finalCategoryName = explicitCategory?.name || aiCategory.categoryName;

    const now = Date.now();
    const productId: any = await ctx.runMutation((internal as any).manualCatalog.insertManualProductInternal, {
      phoneNumberId: args.phoneNumberId,
      title,
      description,
      images,
      primaryImageUrl: images[0]?.url,
      categoryId: finalCategoryId,
      categoryNameSnapshot: finalCategoryName,
      aiAdvice: enrichment.advice,
      aiSummary: enrichment.shortSummary,
      aiKeywords: enrichment.keywords,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    try {
      await upsertProductKnowledgeInternal(ctx, {
        productId,
        phoneNumberId: args.phoneNumberId,
        title,
        description,
        categoryName: finalCategoryName,
        advice: enrichment.advice,
        summary: enrichment.shortSummary,
      });
    } catch (error) {
      console.warn("[manualCatalog] Product created but KB upsert failed", {
        productId,
        phoneNumberId: args.phoneNumberId,
        error,
      });
    }

    return productId;
  },
});

export const updateManualProduct = action({
  args: {
    id: v.id("manual_products"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    images: v.optional(v.array(v.object({
      storageId: v.optional(v.string()),
      url: v.string(),
      alt: v.optional(v.string()),
      order: v.number(),
    }))),
    categoryId: v.optional(v.id("product_categories")),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.runQuery((api as any).manualCatalog.getManualProduct, { id: args.id });
    if (!existing) throw new Error("Product not found");

    const nextTitle = args.title?.trim() ?? existing.title;
    const nextDescription = args.description?.trim() ?? existing.description;
    const nextImages = args.images ? normalizeImages(args.images) : existing.images;

    if (nextTitle.length < 2) throw new Error("Product title must be at least 2 characters");
    if (nextDescription.length < 10) throw new Error("Product description must be at least 10 characters");
    if (nextImages.length < 1) throw new Error("At least one product image is required");

    const enrichment = await enrichProductData({ title: nextTitle, description: nextDescription });

    const aiCategory: any = await ctx.runMutation((internal as any).manualCatalog.upsertCategoryFromAi, {
      phoneNumberId: existing.phoneNumberId,
      name: enrichment.categoryName,
      description: enrichment.categoryDescription,
    });

    const explicitCategory: any = await ctx.runQuery((internal as any).manualCatalog.getCategoryById, {
      categoryId: args.categoryId,
    });
    if (explicitCategory && explicitCategory.phoneNumberId !== existing.phoneNumberId) {
      throw new Error("Selected category does not belong to this number");
    }
    const finalCategoryId = explicitCategory?._id || args.categoryId || existing.categoryId || aiCategory.categoryId;
    const finalCategoryName = explicitCategory?.name || existing.categoryNameSnapshot || aiCategory.categoryName;

    await ctx.runMutation((internal as any).manualCatalog.patchManualProductInternal, {
      id: args.id,
      title: nextTitle,
      description: nextDescription,
      images: nextImages,
      primaryImageUrl: nextImages[0]?.url,
      categoryId: finalCategoryId,
      categoryNameSnapshot: finalCategoryName,
      aiAdvice: enrichment.advice,
      aiSummary: enrichment.shortSummary,
      aiKeywords: enrichment.keywords,
      isActive: args.isActive ?? existing.isActive,
      updatedAt: Date.now(),
    });

    try {
      await upsertProductKnowledgeInternal(ctx, {
        productId: args.id,
        phoneNumberId: existing.phoneNumberId,
        title: nextTitle,
        description: nextDescription,
        categoryName: finalCategoryName,
        advice: enrichment.advice,
        summary: enrichment.shortSummary,
      });
    } catch (error) {
      console.warn("[manualCatalog] Product updated but KB upsert failed", {
        productId: args.id,
        phoneNumberId: existing.phoneNumberId,
        error,
      });
    }

    return args.id;
  },
});

export const deleteManualProduct = action({
  args: { id: v.id("manual_products") },
  handler: async (ctx, args) => {
    const existing = await ctx.runQuery((api as any).manualCatalog.getManualProduct, { id: args.id });
    if (!existing) return { deleted: false };

    await ctx.runMutation((internal as any).manualCatalog.deleteManualProductInternal, { id: args.id });
    await ctx.runMutation((internal as any).manualCatalog.deleteKnowledgeBySourceRefInternal, {
      sourceRef: `manual_product:${String(args.id)}`,
    });

    return { deleted: true };
  },
});

export const insertManualProductInternal = internalMutation({
  args: {
    phoneNumberId: v.string(),
    title: v.string(),
    description: v.string(),
    images: v.array(v.object({
      storageId: v.optional(v.string()),
      url: v.string(),
      alt: v.optional(v.string()),
      order: v.number(),
    })),
    primaryImageUrl: v.optional(v.string()),
    categoryId: v.optional(v.id("product_categories")),
    categoryNameSnapshot: v.optional(v.string()),
    aiAdvice: v.optional(v.string()),
    aiSummary: v.optional(v.string()),
    aiKeywords: v.optional(v.array(v.string())),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("manual_products", args);
  },
});

export const patchManualProductInternal = internalMutation({
  args: {
    id: v.id("manual_products"),
    title: v.string(),
    description: v.string(),
    images: v.array(v.object({
      storageId: v.optional(v.string()),
      url: v.string(),
      alt: v.optional(v.string()),
      order: v.number(),
    })),
    primaryImageUrl: v.optional(v.string()),
    categoryId: v.optional(v.id("product_categories")),
    categoryNameSnapshot: v.optional(v.string()),
    aiAdvice: v.optional(v.string()),
    aiSummary: v.optional(v.string()),
    aiKeywords: v.optional(v.array(v.string())),
    isActive: v.boolean(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args;
    await ctx.db.patch(id, patch);
    return id;
  },
});

export const deleteManualProductInternal = internalMutation({
  args: { id: v.id("manual_products") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});

export const deleteKnowledgeBySourceRefInternal = internalMutation({
  args: { sourceRef: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("knowledge_base").collect();
    const target = all.find((row) => row.sourceRef === args.sourceRef);
    if (target) await ctx.db.delete(target._id);
    return true;
  },
});

export const searchManualProductsForAgent = internalQuery({
  args: {
    phoneNumberId: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(10, Math.max(1, args.limit ?? 5));
    const q = args.query.trim();
    if (!q) return [];

    const searched = await ctx.db
      .query("manual_products")
      .withSearchIndex("search_manual_products", (idx) => idx.search("title", q).eq("phoneNumberId", args.phoneNumberId))
      .take(40);

    const lowered = q.toLowerCase();
    const filtered = searched.filter((p) => {
      const inDescription = p.description.toLowerCase().includes(lowered);
      const inCategory = (p.categoryNameSnapshot || "").toLowerCase().includes(lowered);
      const inKeywords = (p.aiKeywords || []).some((k) => k.toLowerCase().includes(lowered));
      const inTitle = p.title.toLowerCase().includes(lowered);
      return p.isActive && (inTitle || inDescription || inCategory || inKeywords);
    });

    if (filtered.length > 0) return filtered.slice(0, limit);
    return searched.filter((p) => p.isActive).slice(0, limit);
  },
});

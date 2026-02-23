import { query, action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const EMBEDDING_MODEL = "openai/text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

/** Generate embedding for text via OpenRouter. Used by saveKnowledge and searchKnowledge. */
export const embedText = internalAction({
  args: { text: v.string() },
  handler: async (ctx, args): Promise<number[]> => {
    const apiKey = process.env.OPENROUTER_KEY;
    if (!apiKey) throw new Error("Missing OPENROUTER_KEY for embeddings");
    const text = args.text.trim().slice(0, 8000);
    if (!text) return new Array(EMBEDDING_DIMENSIONS).fill(0);

    const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Embedding API error: ${err}`);
    }
    const data = (await res.json()) as { data?: { embedding?: number[] }[] };
    const embedding = data.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error("Invalid embedding response");
    }
    return embedding;
  },
});

/** Insert a knowledge entry with precomputed embedding. Called from saveKnowledge action. */
export const insertKnowledge = internalMutation({
  args: {
    phoneNumberId: v.optional(v.string()),
    title: v.string(),
    content: v.string(),
    embedding: v.array(v.float64()),
    sourceType: v.union(v.literal("text"), v.literal("pdf"), v.literal("manual_product"), v.literal("product_category")),
    sourceRef: v.optional(v.string()),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("knowledge_base", {
      phoneNumberId: args.phoneNumberId,
      title: args.title,
      content: args.content,
      embedding: args.embedding,
      sourceType: args.sourceType,
      sourceRef: args.sourceRef,
      createdAt: args.createdAt,
    });
  },
});

/** Save knowledge: generate embedding then insert. Public action for dashboard/API. */
export const saveKnowledge = action({
  args: { title: v.string(), content: v.string() },
  handler: async (ctx, args) => {
    const textToEmbed = `${args.title}\n${args.content}`.trim().slice(0, 8000);
    const embedding = await ctx.runAction(internal.ai.embedText, { text: textToEmbed });
    await ctx.runMutation(internal.ai.insertKnowledge, {
      phoneNumberId: undefined,
      title: args.title,
      content: args.content,
      embedding,
      sourceType: "text",
      sourceRef: undefined,
      createdAt: Date.now(),
    });
  },
});

export const listKnowledge = query({
  handler: async (ctx) => {
    return await ctx.db.query("knowledge_base").order("desc").collect();
  },
});

/** Load knowledge docs by IDs. Used by searchKnowledge action after vector search. */
export const getKnowledgeByIds = internalQuery({
  args: { ids: v.array(v.id("knowledge_base")) },
  handler: async (ctx, args) => {
    const out: { _id: typeof args.ids[0]; phoneNumberId?: string; title: string; content: string }[] = [];
    for (const id of args.ids) {
      const doc = await ctx.db.get(id);
      if (doc) out.push({ _id: doc._id, phoneNumberId: doc.phoneNumberId, title: doc.title, content: doc.content });
    }
    return out;
  },
});

export const upsertKnowledgeBySourceRef = internalMutation({
  args: {
    phoneNumberId: v.optional(v.string()),
    sourceRef: v.string(),
    title: v.string(),
    content: v.string(),
    embedding: v.array(v.float64()),
    sourceType: v.union(v.literal("text"), v.literal("pdf"), v.literal("manual_product"), v.literal("product_category")),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("knowledge_base").collect();
    const existing = all.find((row) => row.sourceRef === args.sourceRef);
    const payload = {
      phoneNumberId: args.phoneNumberId,
      sourceRef: args.sourceRef,
      title: args.title,
      content: args.content,
      embedding: args.embedding,
      sourceType: args.sourceType,
      createdAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }
    return await ctx.db.insert("knowledge_base", payload);
  },
});

type KnowledgeSnippet = { title: string; content: string };

/** Vector search over knowledge base. Returns top-k snippets for RAG. Called by agent. */
export const searchKnowledge = internalAction({
  args: { query: v.string(), limit: v.optional(v.number()), phoneNumberId: v.optional(v.string()) },
  handler: async (ctx, args): Promise<KnowledgeSnippet[]> => {
    const topK = Math.min(args.limit ?? 5, 10);
    const q = args.query.trim().slice(0, 1000);
    if (!q) return [];

    const embedding: number[] = await ctx.runAction(internal.ai.embedText, { text: q });
    const results: { _id: Id<"knowledge_base">; _score: number }[] = await ctx.vectorSearch("knowledge_base", "by_embedding", {
      vector: embedding,
      limit: topK,
    });
    if (results.length === 0) return [];

    const docs: { _id: Id<"knowledge_base">; phoneNumberId?: string; title: string; content: string }[] = await ctx.runQuery(internal.ai.getKnowledgeByIds, {
      ids: results.map((r) => r._id),
    });
    const scopedDocs = args.phoneNumberId
      ? docs.filter((d) => d.phoneNumberId === args.phoneNumberId)
      : docs.filter((d) => d.phoneNumberId === undefined);

    // Compact + dedupe snippets for stronger grounding and prompt-budget safety.
    const seen = new Set<string>();
    const compact: KnowledgeSnippet[] = [];
    let charBudget = 2200;
    for (const d of scopedDocs) {
      const title = (d.title ?? "").trim() || "Untitled";
      const content = (d.content ?? "").replace(/\s+/g, " ").trim();
      if (!content) continue;
      const fp = `${title.toLowerCase()}::${content.slice(0, 120).toLowerCase()}`;
      if (seen.has(fp)) continue;
      seen.add(fp);

      const trimmed = content.length > 380 ? `${content.slice(0, 380)}...` : content;
      const cost = title.length + trimmed.length;
      if (cost > charBudget) break;
      compact.push({ title, content: trimmed });
      charBudget -= cost;
      if (compact.length >= topK) break;
    }

    return compact;
  },
});

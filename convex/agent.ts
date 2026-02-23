import { action, internalAction, internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { isToolAllowed, normalizeToolsEnabled } from "./agentsUtils";
import { buildConversationContext } from "./contextBuilder";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Tool registry: add new tools here and implement parsing in LLM response + executeTool/messengerProduct. */
const TOOL_REGISTRY = [
  { name: "send_product", handler: "messengerProduct", payload: { name: "string", price: "string", imageUrl: "string", productUrl: "string", description: "string" } },
  { name: "send_text", handler: "executeTool", payload: { text: "string" } },
  { name: "send_image", handler: "executeTool", payload: { imageUrl: "string", caption: "string" } },
  { name: "send_link", handler: "executeTool", payload: { url: "string" } },
  { name: "send_audio", handler: "executeTool", payload: { audioUrl: "string" } },
  { name: "transfer_to_human", handler: "transferToHuman", payload: {} },
] as const;

const HANDOFF_MESSAGE = "تم تحويل المحادثة إلى أحد الموظفين. سنرد عليك قريباً.";

const PRODUCT_DESC_MAX = 250;
function formatProductMessage(name: string, price: string, description: string, productUrl: string): string {
  const raw = (description || "").replace(/<[^>]*>/g, "").trim();
  const desc = raw.length > PRODUCT_DESC_MAX ? raw.slice(0, PRODUCT_DESC_MAX) + "…" : raw;
  return `*${name}*\n💰 *Price:* ${price}\n\n${desc}\n\n🔗 *Link:* ${productUrl || "N/A"}`;
}

function cleanText(t: string): string {
  if (typeof t !== "string") return "";
  let out = t
    .replace(/https?:\/\/\S+\.(png|jpe?g|webp|gif)(\?\S*)?/gi, "")
    .replace(/ImageURL:\s*\S+/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  out = out.replace(/\*\*/g, "").replace(/__/g, "").replace(/```[\s\S]*?```/g, "");
  if (out.length > 4000) out = out.slice(0, 4000);
  return out.trim();
}

function hasArabicText(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

export function buildIdentityLockPrompt(input: {
  phoneNumberId?: string;
  businessName?: string;
  businessPhone?: string;
}): string {
  const businessName = input.businessName?.trim() || "this business";
  const businessPhone = input.businessPhone?.trim() || "unknown";
  const phoneNumberId = input.phoneNumberId?.trim() || "unknown";
  return [
    "Identity lock (critical):",
    `- You represent ONLY "${businessName}" on WhatsApp number "${businessPhone}" (phone_number_id: ${phoneNumberId}).`,
    "- Never claim to be another company, brand, business unit, or assistant.",
    "- Never merge identities or mention internal multi-number setup to customers.",
    "- If asked about a different business, state you are this business only and offer human handoff when needed.",
  ].join("\n");
}

// --- Tools ---

async function searchProducts(ctx: any, query: string) {
  // Simple fuzzy search using Convex filter if possible, or fetch all and filter
  // For production, Vector Search is better. Here we use basic filter.
  // Note: We can't access DB directly in action, so we call a query.
  const products = await ctx.runQuery(api.products.list, { search: query });
  return JSON.stringify(products.slice(0, 5)); // Limit to top 5
}

// --- Agent Logic ---

export const testResponse = internalAction({
    args: {
        message: v.string(),
        systemPrompt: v.string(),
        model: v.string(),
    },
    handler: async (ctx, args) => {
        const apiKey = process.env.OPENROUTER_KEY;
        if (!apiKey) throw new Error("Missing OPENROUTER_KEY");

        const messages = [
            { role: "system", content: args.systemPrompt },
            { role: "user", content: args.message }
        ];

        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://w-ai.com",
                    "X-Title": "W-AI Agent Test",
                },
                body: JSON.stringify({
                    model: args.model,
                    messages: messages,
                })
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`OpenRouter Error: ${err}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || "No response generated.";
        } catch (error: any) {
            console.error("Test Agent Failed:", error);
            throw new Error(error.message);
        }
    }
});

/**
 * Real LLM test: uses current AI config (system prompt + model) and calls OpenRouter.
 * Use from CLI: npx convex run agent:runRealTest '{"message":"كم سعر الهاتف؟"}'
 * Requires OPENROUTER_KEY in Convex env.
 */
export const runRealTest = action({
  args: {
    message: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ message: string; model: string; response: string }> => {
    const apiKey = process.env.OPENROUTER_KEY;
    if (!apiKey) throw new Error("Missing OPENROUTER_KEY");
    const config = await ctx.runQuery(api.ai_config.getConfig, {}) as { systemPrompt?: string; model?: string } | null;
    const systemPrompt = config?.systemPrompt ?? "You are a helpful sales assistant.";
    const model = config?.model ?? "arcee-ai/trinity-mini:free";
    const userMessage = (args.message ?? "مرحبا، ما المنتجات المتوفرة؟").trim();
    const messages = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userMessage },
    ];
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://w-ai.com",
        "X-Title": "W-AI Agent Real Test",
      },
      body: JSON.stringify({ model, messages }),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter Error: ${err}`);
    }
    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? "No response generated.";
    return { message: userMessage, model, response: content };
  },
});

/** Public action for AI Settings page: run a single LLM test (no RAG, no product search). */
export const runTest = action({
  args: {
    message: v.string(),
    systemPrompt: v.string(),
    model: v.string(),
    temperature: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENROUTER_KEY;
    if (!apiKey) throw new Error("Missing OPENROUTER_KEY");
    const messages = [
      { role: "system", content: args.systemPrompt },
      { role: "user", content: args.message },
    ];
    const body: { model: string; messages: typeof messages; temperature?: number } = {
      model: args.model,
      messages,
    };
    if (args.temperature !== undefined) body.temperature = args.temperature;
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://w-ai.com",
        "X-Title": "W-AI Agent Test",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenRouter Error: ${err}`);
    }
    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? "No response generated.";
  },
});

// --- Agent feedback (ratings / improving) ---

export const saveFeedback = mutation({
  args: {
    source: v.union(v.literal("test"), v.literal("chat")),
    rating: v.number(),
    comment: v.optional(v.string()),
    testInput: v.optional(v.string()),
    testOutput: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.rating < 1 || args.rating > 5) throw new Error("Rating must be 1–5");
    await ctx.db.insert("agent_feedback", {
      source: args.source,
      rating: args.rating,
      comment: args.comment,
      testInput: args.testInput,
      testOutput: args.testOutput,
      createdAt: Date.now(),
    });
  },
});

export const listFeedback = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 20, 50);
    return await ctx.db
      .query("agent_feedback")
      .withIndex("by_created_at")
      .order("desc")
      .take(limit);
  },
});

export const feedbackStats = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("agent_feedback").collect();
    if (all.length === 0) return { average: 0, count: 0 };
    const sum = all.reduce((s, r) => s + r.rating, 0);
    return { average: sum / all.length, count: all.length };
  },
});

export const generateResponse = internalAction({
  args: {
    chatId: v.id("chats"),
    contactPhone: v.string(),
    userMessage: v.string(),
  },
  handler: async (ctx, args) => {
// Conversation context manager
interface ConversationContext {
  searchHistory: Array<{
    query: string;
    intent: string;
    results: number;
    timestamp: number;
  }>;
  userPreferences: {
    preferredCategories?: string[];
    priceRange?: { min?: number; max?: number };
    language?: 'ar' | 'en';
    priceSensitive?: boolean;
  };
  lastSuccessfulSearch?: string;
}

const conversationContext: Record<string, ConversationContext> = {};

function updateConversationContext(userId: string, searchData: { query: string; intent: string; results: number }) {
  if (!conversationContext[userId]) {
    conversationContext[userId] = {
      searchHistory: [],
      userPreferences: {}
    };
  }
  
  conversationContext[userId].searchHistory.push({
    query: searchData.query,
    intent: searchData.intent,
    results: searchData.results,
    timestamp: Date.now()
  });
  
  // Keep only recent searches (last 10)
  conversationContext[userId].searchHistory = conversationContext[userId].searchHistory.slice(-10);
  
  // Update last successful search if results found
  if (searchData.results > 0) {
    conversationContext[userId].lastSuccessfulSearch = searchData.query;
  }
  
  // Detect patterns in user behavior
  const recentSearches = conversationContext[userId].searchHistory.slice(-5);
  const priceInquiries = recentSearches.filter(s => s.intent === 'price_inquiry').length;
  const categorySearches = recentSearches.filter(s => s.intent === 'category_search').length;
  
  if (priceInquiries >= 3) {
    conversationContext[userId].userPreferences.priceSensitive = true;
  }
  
  if (categorySearches >= 2) {
    // Extract categories from recent searches (simplified)
    conversationContext[userId].userPreferences.preferredCategories = ['electronics', 'clothing']; // This would be extracted from actual queries
  }
}

function getContextualResponse(userId: string, intentResult: any, productCount: number): string {
  const context = conversationContext[userId];
  if (!context) return '';
  
  const recentSearches = context.searchHistory.slice(-3);
  const suggestions = [];
  
  // Provide contextual suggestions based on user behavior
  if (context.userPreferences.priceSensitive && intentResult.queryType !== 'price_inquiry') {
    suggestions.push("💡 I notice you've been asking about prices. Would you like to see our current promotions or budget-friendly options?");
  }
  
  if (productCount === 0 && context.lastSuccessfulSearch) {
    suggestions.push(`💡 I couldn't find what you're looking for. You might be interested in similar products to "${context.lastSuccessfulSearch}".`);
  }
  
  if (recentSearches.length >= 2 && recentSearches.every(s => s.results === 0)) {
    suggestions.push("💡 I see you're having trouble finding products. Try being more specific with product names, brands, or categories.");
  }
  
  // Language preference detection
  const arabicQueries = recentSearches.filter(s => /[\u0600-\u06FF]/.test(s.query)).length;
  if (arabicQueries >= 2) {
    context.userPreferences.language = 'ar';
  } else if (recentSearches.length >= 2 && arabicQueries === 0) {
    context.userPreferences.language = 'en';
  }
  
  return suggestions.length > 0 ? `\n\n${suggestions.join('\n')}` : '';
}
    let selectedProduct: {
      name: string;
      price: string;
      imageUrl: string;
      productUrl: string;
      description: string;
    } | null = null;

    // 1. Get AI Config & Chat Details
    const chat = await ctx.runQuery(api.chat.getChat, { chatId: args.chatId });
    // Get AI config for this specific phone number (falls back to global if none)
    const config = await ctx.runQuery(internal.ai_config.getInternalConfig, { 
      phoneNumberId: chat?.phoneNumberId 
    });
    const model = config?.model || process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash-lite-preview-02-05:free";
    const systemPrompt = config?.systemPrompt || "You are a helpful sales assistant.";
    const numberProfile = chat?.phoneNumberId
      ? await ctx.runQuery(internal.whatsappNumbers.getByBusinessNumberId, {
          businessNumberId: chat.phoneNumberId,
        })
      : null;
    const identityLockPrompt = buildIdentityLockPrompt({
      phoneNumberId: chat?.phoneNumberId ?? undefined,
      businessName: numberProfile?.name ?? undefined,
      businessPhone: numberProfile?.phone ?? undefined,
    });
    const toolsEnabled = normalizeToolsEnabled(config?.toolsEnabled as string[] | undefined);
    const recommendProducts = config?.recommendProducts ?? true;
    const manualCatalogEnabled = config?.manualCatalogEnabled ?? true;
    const effectiveApiKey = (config as { openRouterApiKey?: string } | undefined)?.openRouterApiKey?.trim() || process.env.OPENROUTER_KEY;
    if (!effectiveApiKey) {
      console.error("[Agent] Missing OPENROUTER_KEY (neither per-number nor env)");
      return;
    }
    if (!config?.isActive) {
      console.log(
        `[Agent] Auto-reply skipped: disabled for phoneNumberId=${chat?.phoneNumberId ?? "none"} chatId=${args.chatId}`
      );
      await ctx.runMutation(internal.webhookEvents.logWhatsappProcessing, {
        body: { chatId: args.chatId, contactPhone: args.contactPhone },
        processingStatus: "received",
        eventType: "agent_disabled",
        resolvedPhoneNumberId: chat?.phoneNumberId ?? undefined,
        fallbackUsed: false,
        note: "Agent disabled for this number, response skipped",
      });
      return;
    }
    console.log(
      `[Agent] Using config for phoneNumberId=${chat?.phoneNumberId ?? "global"} model=${model} recommendProducts=${recommendProducts} manualCatalogEnabled=${manualCatalogEnabled} tools=${toolsEnabled.join(",")}`
    );

    // 2. Gather context inputs (last 5 messages + summary + KB snippets)
    const recentForContext = await ctx.runQuery(internal.messages.getRecentForContext, {
      chatId: args.chatId,
      limit: 5,
    });
    let knowledgeSnippets: Array<{ title: string; content: string }> = [];
    try {
      knowledgeSnippets = await ctx.runAction(internal.ai.searchKnowledge, {
        query: args.userMessage,
        limit: 5,
        phoneNumberId: chat?.phoneNumberId ?? undefined,
      });
    } catch (e) {
      console.warn("[Agent] Knowledge search failed:", e);
    }

    const builtContext = buildConversationContext({
      systemPrompt: `${systemPrompt}\n\n${identityLockPrompt}`,
      messages: recentForContext,
      existingSummary: chat?.aiSummary,
      knowledgeSnippets,
    });
    const recentHistory = builtContext.recentMessages;

    // 3. Prepare messages for LLM with deterministic context contract
    const messages = [
      { role: "system", content: builtContext.finalSystemContext },
      ...recentHistory,
      { role: "user", content: args.userMessage }
    ];

    console.log(
      `[Agent] Calling ${model} with ${messages.length} messages context={recent:${builtContext.diagnostics.recentMessagesCount},summaryChars:${builtContext.diagnostics.summaryChars},kb:${builtContext.diagnostics.knowledgeSnippetsCount}}`
    );

    // 4. Enhanced Intent Detection & Tool Use
    // Advanced NLP-based query intent recognition with context-aware detection
    
    const detectSearchIntent = (message: string): { shouldSearch: boolean; queryType: string; extractedParams: any } => {
      const lowerMessage = message.toLowerCase().trim();
      
      // Comprehensive search intent patterns with confidence scoring
      const intentPatterns = [
        // Product availability queries (high confidence)
        { pattern: /\b(do you have|do u have|have you got|got any)\b.*?(product|item|thing)?\s*(?:number|#)?\s*([a-z0-9\-]+)?/i, type: 'availability', confidence: 0.9 },
        // Price-related queries (high confidence) - Added "for" support and improved spacing
        { pattern: /(?:^|\s|\b)(how much|what.*price|price of|cost of|بكم|بكام|كم سعر|شقد|قيمة)(?:\b|\s|$)\s*(?:is|the|for|of)?\s*(.+?)(?:\?|؟|$)/i, type: 'price_inquiry', confidence: 0.9 },
        // Product search with identifiers (high confidence)
        { pattern: /\b(product|item|thing).*?(?:number|#|code)\s*[:\-]?\s*([a-z0-9\-]+)/i, type: 'product_number', confidence: 0.95 },
        // General search patterns (medium confidence) - Renamed to product_search
        { pattern: /\b(search|find|look for|show me|get me|i want|i need|looking for|want to see)\b\s*(?:a|the|some|for)?\s*(.+?)(?:\?|$)/i, type: 'product_search', confidence: 0.7 },
        // Category searches (medium confidence) - Improved regex
        { pattern: /\b(what.*category|category of|type of|kind of)\b\s*(?:is|are)?\s*(.+?)(?:\?|$)/i, type: 'category_search', confidence: 0.6 },
        // Comparison queries (medium confidence)
        { pattern: /\b(compare|difference|vs|versus|أو|between|among)\b\s*(?:the|between|in)?\s*(.+?)(?:\?|$)/i, type: 'comparison', confidence: 0.65 },
        // Arabic search patterns (high confidence) - Fixed boundaries for Arabic
        { pattern: /(?:^|\s)(ابحث عن|وريني|جيب لي|عرض|عندك|فيها|توجد)(?:\s+|$).*?(?:منتج|سلعة|شيء|ال)?\s*(.+?)(?:\?|$)/i, type: 'product_search', confidence: 0.8 },
        // Reference to previous search (high confidence to override general/availability)
        { pattern: /\b(like that|similar|same as|another one|the other one)\b/i, type: 'reference_search', confidence: 0.95 }
      ];
      
      // Product identifier patterns (SKUs, model numbers, etc.)
      const identifierPatterns = [
        /\b[a-z]{2,}-\d{3,}\b/i,  // ABC-123 format (case insensitive)
        /\b\d{4,}\b/,            // 4+ digit numbers
        /\b(?=[a-z0-9]*\d)[a-z0-9]{6,}\b/i,      // Mixed alphanumeric 6+ chars (must have digit inside)
        /\b(?:model|sku|code|ref)[:\-]?\s*([a-z0-9\-]+)/i
      ];
      
      let bestMatch = null;
      let maxConfidence = 0.5; // Minimum threshold
      let extractedParams: any = {};
      
      // Check each intent pattern
      for (const intent of intentPatterns) {
        const match = lowerMessage.match(intent.pattern);
        if (match && intent.confidence > maxConfidence) {
          bestMatch = intent.type;
          maxConfidence = intent.confidence;
          
          // Extract parameters based on pattern type
          if (intent.type === 'product_number' && match[2]) {
            extractedParams.productNumber = match[2].toUpperCase();
          } else if (intent.type === 'price_inquiry' && match[match.length - 1]) {
            extractedParams.productName = match[match.length - 1].trim();
          } else if ((intent.type === 'product_search' || intent.type === 'availability') && match[match.length - 1]) {
            extractedParams.searchQuery = match[match.length - 1].trim();
          } else if (intent.type === 'category_search' && match[match.length - 1]) {
            extractedParams.category = match[match.length - 1].trim();
            extractedParams.searchQuery = extractedParams.category;
          } else if (intent.type === 'comparison' && match[match.length - 1]) {
            extractedParams.searchQuery = match[match.length - 1].trim();
          }
        }
      }
      
      // Look for product identifiers if not already found
      if (!extractedParams.productNumber) {
        for (const pattern of identifierPatterns) {
            const match = lowerMessage.match(pattern);
            if (match) {
              const id = match[1] || match[0];
              extractedParams.productNumber = id.toUpperCase().replace(/[^A-Z0-9\-]/g, '');
              // Force product_number type if explicit identifier found
              if (!bestMatch || bestMatch === 'product_search' || bestMatch === 'price_inquiry' || bestMatch === 'availability') {
                  bestMatch = 'product_number';
                  maxConfidence = 0.95;
              }
              break;
            }
          }
      }
      
      // Context-aware enhancement: Check if this is a follow-up question
      const isFollowUp = recentHistory.some((msg: { role: string; content: string }) =>
        msg.role === 'assistant' &&
        (msg.content.includes('product') || msg.content.includes('found') || msg.content.includes('search'))
      );
      
      if (isFollowUp && maxConfidence < 0.7) {
        maxConfidence = Math.min(maxConfidence + 0.2, 0.8); // Boost confidence for follow-ups
      }
      
      return {
        shouldSearch: maxConfidence >= 0.6,
        queryType: bestMatch || 'product_search',
        extractedParams
      };
    };
    
    const intentResult = detectSearchIntent(args.userMessage);
    const shouldSearch = intentResult.shouldSearch && recommendProducts;

    if (shouldSearch) {
        // Smart query cleaning based on detected intent and extracted parameters
        let cleanQuery = args.userMessage;
        
        // Use extracted parameters to build targeted search query
        if (intentResult.extractedParams.productNumber) {
            // Priority search by product number/SKU
            cleanQuery = intentResult.extractedParams.productNumber;
            console.log(`[Agent] Product number detected: "${cleanQuery}"`);
        } else if (intentResult.extractedParams.productName) {
            // Search by extracted product name from price inquiry
            cleanQuery = intentResult.extractedParams.productName;
            console.log(`[Agent] Product name from price inquiry: "${cleanQuery}"`);
        } else if (intentResult.extractedParams.searchQuery) {
            // Use extracted search query
            cleanQuery = intentResult.extractedParams.searchQuery;
            console.log(`[Agent] Extracted search query: "${cleanQuery}"`);
        } else if (intentResult.extractedParams.category) {
            // Search by category
            cleanQuery = intentResult.extractedParams.category;
            console.log(`[Agent] Category search: "${cleanQuery}"`);
        } else {
            // Fallback: intelligent cleaning based on query type
            const cleaningPatterns = {
                'price_inquiry': /(how much|what.*price|price of|cost of|بكم|بكام|كم سعر|شقد|قيمة|is|the|does it|cost|for|of)/gi,
                'availability': /(do you have|do u have|have you got|got any|is there|are there|available|in stock|left|still|موجود|متوفر|عندك)/gi,
                'product_search': /(search|find|look for|show me|get me|i want|i need|looking for|want to see|ابحث عن|وريني|جيب لي|عرض|عندك|فيها|توجد|بدي|عايز|أبي|أريد)/gi,
                'comparison': /(compare|difference|vs|versus|أو|between|among)/gi
            };
            
            // Apply type-specific cleaning
            if (intentResult.queryType && cleaningPatterns[intentResult.queryType as keyof typeof cleaningPatterns]) {
                cleanQuery = cleanQuery.replace(cleaningPatterns[intentResult.queryType as keyof typeof cleaningPatterns], '');
            }
            
            // General cleaning for conversational phrases and question marks
            cleanQuery = cleanQuery
                .replace(/(لو سمحت|ممكن|ابغى|اريد|بدي|فرجيني|شوف)/gi, '')
                .replace(/[؟?]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
        }
        
        // Final cleanup and validation
        cleanQuery = cleanQuery.replace(/^\s+|\s+$/g, '').replace(/\s{2,}/g, ' ');
        
        // If query becomes too short or generic, enhance with context
        if (cleanQuery.length < 2 || ['this', 'that', 'it', 'one'].includes(cleanQuery.toLowerCase())) {
            // Use conversation history for context
            const lastProductMention = recentHistory.find((msg: { role: string; content: string }) =>
                msg.role === 'user' && (msg.content.includes('product') || msg.content.includes('item'))
            );
            if (lastProductMention) {
                cleanQuery = lastProductMention.content;
                console.log(`[Agent] Enhanced query with conversation context: "${cleanQuery}"`);
            }
        }
        
        console.log(`[Agent] Intent: ${intentResult.queryType}, Clean query: "${cleanQuery}"`);

        console.log(`[Agent] Detected search intent. Raw: "${args.userMessage}", Clean: "${cleanQuery}"`);
        
        let products: any[] = [];
        const seenProductKey = new Set<string>();
        const pushUnique = (items: any[]) => {
          for (const item of items) {
            const key = String(item._id || item.id || item.externalId || item.sku || item.name || Math.random());
            if (seenProductKey.has(key)) continue;
            seenProductKey.add(key);
            products.push(item);
          }
        };

        // 0. Manual per-number catalog first (if enabled)
        if (chat?.phoneNumberId && manualCatalogEnabled) {
          try {
            const manualProducts = await ctx.runQuery((internal as any).manualCatalog.searchManualProductsForAgent, {
              phoneNumberId: chat.phoneNumberId,
              query: cleanQuery,
              limit: 5,
            });
            if (manualProducts.length > 0) {
              console.log(`[Agent] Found ${manualProducts.length} manual products for number ${chat.phoneNumberId}`);
              pushUnique(
                manualProducts.map((p: any) => ({
                  ...p,
                  source: "manual",
                  price: p.price || "N/A",
                  currency: p.currency || "",
                  image: p.primaryImageUrl || p.images?.[0]?.url || null,
                  url: "",
                }))
              );
            }
          } catch (e) {
            console.warn("[Agent] Manual catalog search failed", e);
          }
        }
        
        // 1. Try Salla Live Search (with Retry Strategy)
        try {
            // Helper function to search with fallback
            const searchSalla = async (query: string) => {
                console.log(`[Agent] Searching Salla for: "${query}"`);
                const result = await ctx.runAction(api.salla.fetchProducts, { 
                    keyword: query,
                    perPage: 5 
                });
                return result;
            };

            // Attempt 1: Full Clean Query
            let sallaResult = await searchSalla(cleanQuery);
            
            // Attempt 2: If no results and query has multiple words, try first 2 words (likely the main product name)
            if ((!sallaResult.products || sallaResult.products.length === 0) && cleanQuery.split(" ").length > 2) {
                const simplifiedQuery = cleanQuery.split(" ").slice(0, 2).join(" ");
                console.log(`[Agent] No results for full query. Retrying with simplified: "${simplifiedQuery}"`);
                sallaResult = await searchSalla(simplifiedQuery);
            }

            if (sallaResult.connected) {
                if (sallaResult.products && sallaResult.products.length > 0) {
                    console.log(`[Agent] Found ${sallaResult.products.length} products via Salla API`);
                    pushUnique(sallaResult.products.map((p: any) => ({ ...p, source: "salla" })));
                } else {
                    console.log(`[Agent] Salla search returned 0 products after retries.`);
                }
            } else {
                console.log(`[Agent] Salla integration not connected.`);
            }
        } catch (e) {
            console.warn("[Agent] Salla Live Search failed, checking local DB...", e);
        }

        // 2. Fallback to Local DB if Salla didn't return anything
        if (products.length === 0 || products.length < 5) {
             console.log(`[Agent] Fallback to Local DB search for: "${cleanQuery}"`);
             const localProducts = await ctx.runQuery(api.products.list, { search: cleanQuery });
             pushUnique(localProducts.map((p: any) => ({ ...p, source: "local" })));
             console.log(`[Agent] Found ${localProducts.length} products via Local DB`);
        }
        
        if (products && products.length > 0) {
            // Update conversation context with successful search
            updateConversationContext(args.contactPhone || 'anonymous', {
                query: cleanQuery,
                intent: intentResult.queryType,
                results: products.length
            });

            // Enhanced Product Context with query-type specific formatting
            const productContextList = products.map((p: any) => ({
                id: p._id || p.id,
                name: p.title || p.name,
                price: p.price != null ? `${p.price} ${p.currency || ""}`.trim() : "N/A",
                description: p.description || p.aiSummary || "No description",
                image: p.primaryImageUrl || p.images?.[0]?.url || p.images?.[0] || p.image || p.imageUrl || null,
                url: p.url || p.urls?.customer || null, // Salla product URL
                stock: p.stock_status || p.availability || 'unknown',
                sku: p.sku || p.code || null,
                category: p.categoryNameSnapshot || null,
                advice: p.aiAdvice || null,
                source: p.source || "unknown",
            })).slice(0, 5); // Limit to 5

            // Contextual response based on query type
            let contextHeader = "";
            let responseTone = "";
            let productSelectionLogic = "";
            
            switch (intentResult.queryType) {
                case 'price_inquiry':
                    contextHeader = "[SYSTEM: User asked about pricing. Focus on price information and value proposition.]";
                    responseTone = "Provide clear pricing information and mention any discounts or special offers.";
                    // For price inquiries, prioritize the most relevant/affordable option
                    productContextList.sort((a, b) => {
                        const priceA = parseFloat(a.price.replace(/[^0-9.]/g, ''));
                        const priceB = parseFloat(b.price.replace(/[^0-9.]/g, ''));
                        return priceA - priceB;
                    });
                    break;
                    
                case 'availability':
                    contextHeader = "[SYSTEM: User asked about availability. Confirm stock status clearly.]";
                    responseTone = "Be definitive about availability. If out of stock, offer alternatives or restocking information.";
                    // For availability, show in-stock items first
                     productContextList.sort((a: any, b: any) => {
                         const stockOrder: { [key: string]: number } = { 
                             'in_stock': 1, 
                             'available': 1, 
                             'limited': 2, 
                             'out_of_stock': 3, 
                             'unknown': 2 
                         };
                         return (stockOrder[a.stock] || 2) - (stockOrder[b.stock] || 2);
                     });
                    break;
                    
                case 'product_number':
                    contextHeader = "[SYSTEM: User provided specific product number/SKU. Be precise about exact matches.]";
                    responseTone = "Acknowledge the specific product identifier and confirm if it's an exact match.";
                    // For product numbers, prioritize exact SKU matches
                    if (intentResult.extractedParams.productNumber) {
                        const exactMatch = productContextList.find(p => 
                            p.sku?.toUpperCase() === intentResult.extractedParams.productNumber ||
                            p.name.toUpperCase().includes(intentResult.extractedParams.productNumber)
                        );
                        if (exactMatch) {
                            productContextList.unshift(exactMatch);
                            productContextList.splice(1, 0, ...productContextList.filter(p => p !== exactMatch));
                        }
                    }
                    break;
                    
                case 'category_search':
                    contextHeader = "[SYSTEM: User asked about product categories. Show variety within the category.]";
                    responseTone = "Show range of options in the requested category, from different price points and styles.";
                    break;
                    
                case 'comparison':
                    contextHeader = "[SYSTEM: User wants to compare products. Highlight differences in features and pricing.]";
                    responseTone = "Present options side-by-side, emphasizing key differences in features, price, and value.";
                    break;
                    
                default:
                    contextHeader = "[SYSTEM: General product search. Show most relevant results.]";
                    responseTone = "Be helpful and conversational while presenting the best matching products.";
            }

            let productsText = "";
            productContextList.forEach((p: any, index: number) => {
                const stockIndicator = p.stock === 'in_stock' || p.stock === 'available' ? '✅ In Stock' : 
                                     p.stock === 'out_of_stock' ? '❌ Out of Stock' : 
                                     p.stock === 'limited' ? '⚠️ Limited Stock' : '🤔 Check Availability';
                
                productsText += `
Product ${index + 1}:
Name: ${p.name}
Price: ${p.price} ${stockIndicator}
Source: ${p.source}`;
                
                // Add SKU if available and it was a product number search
                if (p.sku && intentResult.queryType === 'product_number') {
                    productsText += `
SKU: ${p.sku}`;
                }
                
                productsText += `
Description: ${p.description.substring(0, 150)}...
-------------------`;
                if (p.category) {
                  productsText += `\nCategory: ${p.category}`;
                }
                if (p.advice) {
                  productsText += `\nAdvice: ${String(p.advice).substring(0, 160)}...`;
                }
            });

            // Select primary product based on query context
            const primaryProduct = productContextList[0];
            const toolPayload = {
                name: primaryProduct.name,
                price: primaryProduct.price,
                imageUrl: primaryProduct.image,
                productUrl: primaryProduct.url || "N/A",
                description: primaryProduct.description.substring(0, 150).replace(/<[^>]*>/g, "") + "..."
            };
            selectedProduct = toolPayload;
            
            // Get contextual suggestions based on conversation history
            const contextualSuggestions = getContextualResponse(args.contactPhone || 'anonymous', intentResult, products.length);
            
            const toolInstruction = isToolAllowed(toolsEnabled, "send_product")
              ? `
            <TOOL:send_product>
            ${JSON.stringify(toolPayload)}
            </TOOL:send_product>`
              : `
            [SYSTEM: Tool send_product is disabled for this number. Mention the best product in plain text without tool tags.]`;
            const productsContext = `
            ${contextHeader}
            [SYSTEM: I have searched the store and found these products matching the user's ${intentResult.queryType} query:]
            ${productsText}
            
            [INSTRUCTION: ${responseTone} Write a contextual response that addresses their specific query type (${intentResult.queryType}). Use the tool tag for the most relevant product. Do NOT include any image URL in your text. Only include the product link in the formatted text. The image must be sent as WhatsApp media using its URL internally. The tool tag will not be shown to the user.]
            
            Based on your ${intentResult.queryType.replace('_', ' ')} request, here's what I found:
            ${toolInstruction}
            ${contextualSuggestions}
            `;
            
            // Inject context into the last user message
            messages[messages.length - 1].content += productsContext;
        } else {
            // Enhanced no-results handling with contextual suggestions
            let noResultsMessage = `\n\n[SYSTEM: I searched the store for "${cleanQuery}" but found NO products. `;
            
            // Provide contextual suggestions based on query type
            switch (intentResult.queryType) {
                case 'product_number':
                    noResultsMessage += `The product number/SKU "${intentResult.extractedParams.productNumber}" was not found. `;
                    noResultsMessage += `Please double-check the number or try searching by product name.]`;
                    break;
                case 'price_inquiry':
                    noResultsMessage += `I couldn't find pricing for "${intentResult.extractedParams.productName}". `;
                    noResultsMessage += `Try searching with a different product name or browse our available categories.]`;
                    break;
                case 'availability':
                    noResultsMessage += `I couldn't find availability information for your query. `;
                    noResultsMessage += `You can browse our catalog or contact support for specific product availability.]`;
                    break;
                default:
                    noResultsMessage += `Try using different keywords, check spelling, or browse by category. `;
                    noResultsMessage += `You can also ask me about specific product types or brands.]`;
            }
            
            messages[messages.length - 1].content += noResultsMessage;
        }
    }

    try {
        const response = await fetch(OPENROUTER_API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${effectiveApiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://w-ai.com",
                "X-Title": "W-AI Agent",
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("[Agent] OpenRouter Error:", errText);
            let parsed: { error?: { code?: number; message?: string } } = {};
            try {
                parsed = JSON.parse(errText) as typeof parsed;
            } catch {
                // ignore
            }
            const code = parsed?.error?.code ?? response.status;
            const isRateLimit = code === 429 || (typeof parsed?.error?.message === "string" && parsed.error.message.includes("Rate limit"));
            if (isRateLimit) {
                const fallback = hasArabicText(args.userMessage)
                    ? "عذراً، الطلب كثير حالياً. جرّب بعد دقائق أو تواصل معنا لاحقاً."
                    : "Sorry, we're a bit overloaded. Try again in a few minutes or contact us later.";
                await ctx.runMutation(internal.messages.sendAndSave, {
                    chatId: args.chatId,
                    content: fallback,
                    type: "text",
                    contactPhone: args.contactPhone,
                });
            }
            return;
        }

        const data = await response.json();
        let aiText = data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";

        // Quality guard: if user wrote Arabic but model replied non-Arabic, auto-rewrite in Arabic.
        if (hasArabicText(args.userMessage) && !hasArabicText(aiText)) {
            try {
                const rewriteResponse = await fetch(OPENROUTER_API_URL, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${effectiveApiKey}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://w-ai.com",
                        "X-Title": "W-AI Agent Arabic Rewriter",
                    },
                    body: JSON.stringify({
                        model,
                        messages: [
                            {
                                role: "system",
                                content:
                                    "أعد صياغة الرد التالي إلى العربية الفصحى المبسطة، بصياغة قصيرة مناسبة لواتساب (سطرين إلى 4 أسطر)، بدون JSON أو أكواد.",
                            },
                            {
                                role: "user",
                                content: aiText,
                            },
                        ],
                    }),
                });
                if (rewriteResponse.ok) {
                    const rewriteData = await rewriteResponse.json();
                    const rewritten = rewriteData.choices?.[0]?.message?.content;
                    if (typeof rewritten === "string" && hasArabicText(rewritten)) {
                        aiText = rewritten;
                    }
                }
            } catch (rewriteError) {
                console.warn("[Agent] Arabic rewrite fallback failed:", rewriteError);
            }
        }

        console.log(`[Agent] Response: ${aiText.substring(0, 50)}...`);

        let sentByTool = false;

        // Transfer to human: turn off AI for this chat and send handoff message
        const transferRegex = /<TOOL:transfer_to_human>\s*/i;
        if (transferRegex.test(aiText)) {
            aiText = aiText.replace(transferRegex, "").trim();
            if (isToolAllowed(toolsEnabled, "transfer_to_human")) {
              await ctx.runMutation(internal.chat.transferToHuman, { chatId: args.chatId });
              await ctx.runMutation(internal.messages.sendAndSave, {
                  chatId: args.chatId,
                  content: HANDOFF_MESSAGE,
                  type: "text",
                  contactPhone: args.contactPhone
              });
              await ctx.scheduler.runAfter(0, (internal as any).notifications.sendHumanEscalationPush, {
                  chatId: args.chatId,
                  title: chat?.contactName || args.contactPhone,
                  body: "The customer asked for a human agent.",
                  phoneNumberId: chat?.phoneNumberId,
              });
              sentByTool = true;
            }
        }

        const toolRegex = /<TOOL:send_product>\s*(?:```json\s*)?({[\s\S]*?})(?:\s*```)?/i;
        const toolMatch = !sentByTool && aiText.match(toolRegex);
        if (toolMatch) {
            const jsonText = toolMatch[1];
            let payload: Record<string, unknown> | null = null;
            try {
                payload = JSON.parse(jsonText);
            } catch {}
            aiText = aiText.replace(toolMatch[0], "").trim();
            if (
              payload &&
              typeof payload.name === "string" &&
              typeof payload.price === "string" &&
              isToolAllowed(toolsEnabled, "send_product")
            ) {
                await ctx.runAction(internal.agent.messengerProduct, {
                    chatId: args.chatId,
                    contactPhone: args.contactPhone,
                    name: payload.name as string,
                    price: payload.price as string,
                    imageUrl: (payload.imageUrl as string) || "",
                    productUrl: (payload.productUrl as string) || "",
                    description: (payload.description as string) || ""
                });
                sentByTool = true;
                if (aiText) {
                    await ctx.runMutation(internal.messages.sendAndSave, {
                        chatId: args.chatId,
                        content: cleanText(aiText),
                        type: "text",
                        contactPhone: args.contactPhone
                    });
                }
            } else {
                await ctx.runMutation(internal.messages.sendAndSave, {
                    chatId: args.chatId,
                    content: cleanText(aiText),
                    type: "text",
                    contactPhone: args.contactPhone
                });
            }
        } else {
        // Parse generic tool tags: send_text, send_image, send_link
        const genericTools: Array<{ type: "text" | "image" | "link" | "audio"; gate: "send_text" | "send_image" | "send_link" | "send_audio"; pattern: RegExp }> = [
            { type: "text", gate: "send_text", pattern: /<TOOL:send_text>\s*(?:```(?:json|text)\s*)?({[\s\S]*?}|[\s\S]*?)(?:\s*```)?/i },
            { type: "image", gate: "send_image", pattern: /<TOOL:send_image>\s*(?:```json\s*)?({[\s\S]*?})(?:\s*```)?/i },
            { type: "link", gate: "send_link", pattern: /<TOOL:send_link>\s*(?:```json\s*)?({[\s\S]*?})(?:\s*```)?/i },
            { type: "audio", gate: "send_audio", pattern: /<TOOL:send_audio>\s*(?:```json\s*)?({[\s\S]*?})(?:\s*```)?/i }
        ];
        for (const entry of genericTools) {
            const m = aiText.match(entry.pattern);
            if (!m) continue;
            const raw = m[1];
            aiText = aiText.replace(m[0], "").trim();
            if (!isToolAllowed(toolsEnabled, entry.gate)) {
                continue;
            }
            let payload: any = raw;
            try {
                payload = JSON.parse(raw);
            } catch {
                if (entry.type === "text") {
                    payload = { text: String(raw).trim() };
                }
            }
            await ctx.runAction(internal.agent.executeTool, {
                chatId: args.chatId,
                contactPhone: args.contactPhone,
                tool: entry.type,
                payload
            });
            sentByTool = true;
        }
        const imageTagRegex = /<SEND_IMAGE:(.*?):(.*?)(?:>|$)/;
        const match = aiText.match(imageTagRegex);
        let sentByImageTag = false;

        if (match) {
            const imageUrl = match[1];
            const caption = match[2] || "";
            
            // Clean the tag from the text sent to user
            aiText = aiText.replace(match[0], "").trim();

            // Send Text First (if any left)
            if (aiText) {
                await ctx.runMutation(internal.messages.sendAndSave, {
                    chatId: args.chatId,
                    content: cleanText(aiText),
                    type: "text",
                    contactPhone: args.contactPhone
                });
            }

            // Send Image
            if (imageUrl && imageUrl !== "null") {
                await ctx.runMutation(internal.messages.sendAndSave, {
                    chatId: args.chatId,
                    contactPhone: args.contactPhone,
                    content: caption,
                    type: "image",
                    mediaUrl: imageUrl
                });
                sentByImageTag = true;
            }
        } else {
            // Normal Text Response (skip if we already sent e.g. transfer_to_human)
            if (!sentByTool && aiText) {
                await ctx.runMutation(internal.messages.sendAndSave, {
                    chatId: args.chatId,
                    content: cleanText(aiText),
                    type: "text",
                    contactPhone: args.contactPhone
                });
            }
        }
        // Fallback: Arabic/English "send product" directive, or automatic send if we have selectedProduct
        const arabicSendRegex = /\[?أرسل المنتج\]?/;
        const englishSendRegex = /\[?send product\]?/i;
        if ((arabicSendRegex.test(aiText) || englishSendRegex.test(aiText)) && selectedProduct) {
            aiText = aiText.replace(arabicSendRegex, "").replace(englishSendRegex, "").trim();
        }
        if (!sentByTool && !sentByImageTag && selectedProduct && isToolAllowed(toolsEnabled, "send_product")) {
            await ctx.runAction(internal.agent.messengerProduct, {
                chatId: args.chatId,
                contactPhone: args.contactPhone,
                name: selectedProduct.name,
                price: selectedProduct.price,
                imageUrl: selectedProduct.imageUrl || "",
                productUrl: selectedProduct.productUrl || "",
                description: selectedProduct.description || ""
            });
            if (aiText) {
                await ctx.runMutation(internal.messages.sendAndSave, {
                    chatId: args.chatId,
                    content: cleanText(aiText),
                    type: "text",
                    contactPhone: args.contactPhone
                });
            }
        }
        }

        // 6. Trigger Summary Update (Async)
        // We do this AFTER sending response to user to avoid latency
        await ctx.scheduler.runAfter(0, internal.agent.updateSummary, {
            chatId: args.chatId,
            existingSummary: chat?.aiSummary || "",
            newMessages: [
                { role: "user", content: args.userMessage },
                { role: "assistant", content: aiText }
            ],
            model: model,
            apiKey: effectiveApiKey
        });

    } catch (error) {
        console.error("[Agent] Execution Failed:", error);
    }
  },
});

export const updateSummary = internalAction({
    args: {
        chatId: v.id("chats"),
        existingSummary: v.string(),
        newMessages: v.array(v.object({ role: v.string(), content: v.string() })),
        model: v.string(),
        apiKey: v.optional(v.string())
    },
    handler: async (ctx, args) => {
        const apiKey = args.apiKey || process.env.OPENROUTER_KEY;
        if (!apiKey) return;

        const summaryPrompt = `
        You are a conversation memory manager.
        Update memory using only high-signal facts.

        ExistingMemory:
        ${args.existingSummary || "None"}

        NewTurn:
        User: ${args.newMessages[0].content}
        Assistant: ${args.newMessages[1].content}

        Output rules:
        - Return plain text only (no markdown code fences).
        - Keep under 700 characters.
        - Use this compact structure:
          [Preferences] ...
          [OpenTasks] ...
          [RecentDecisions] ...
          [DoNotForget] ...
        - Keep unresolved requests and promised follow-ups.
        - Remove stale details and repetition.
        `;

        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://w-ai.com",
                    "X-Title": "W-AI Summary Agent",
                },
                body: JSON.stringify({
                    model: "arcee-ai/trinity-mini:free", // Use small fast model for summary
                    messages: [{ role: "user", content: summaryPrompt }],
                })
            });

            if (!response.ok) return;

            const data = await response.json();
            const newSummaryRaw = data.choices?.[0]?.message?.content || args.existingSummary;
            const newSummary = (newSummaryRaw || "").trim().slice(0, 700);

            // Update Chat
            await ctx.runMutation(internal.agent.saveSummary, {
                chatId: args.chatId,
                summary: newSummary
            });

        } catch (e) {
            console.error("[Agent] Summary Update Failed:", e);
        }
    }
});

export const saveSummary = internalMutation({
    args: { chatId: v.id("chats"), summary: v.string() },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.chatId, { aiSummary: args.summary });
    }
});

export const sendProduct = internalAction({
    args: {
        chatId: v.id("chats"),
        contactPhone: v.string(),
        name: v.string(),
        price: v.string(),
        imageUrl: v.string(),
        productUrl: v.string(),
        description: v.string()
    },
    handler: async (ctx, args) => {
        const text = formatProductMessage(args.name, args.price, args.description, args.productUrl);
        await ctx.runMutation(internal.messages.sendAndSave, {
            chatId: args.chatId,
            content: text,
            type: "text",
            contactPhone: args.contactPhone
        });
        if (args.imageUrl && args.imageUrl !== "null") {
            await ctx.runMutation(internal.messages.sendAndSave, {
                chatId: args.chatId,
                contactPhone: args.contactPhone,
                content: `${args.name} - ${args.price}`,
                type: "image",
                mediaUrl: args.imageUrl
            });
        }
    }
});

export const messengerProduct = internalAction({
    args: {
        chatId: v.id("chats"),
        contactPhone: v.string(),
        name: v.string(),
        price: v.string(),
        imageUrl: v.string(),
        productUrl: v.string(),
        description: v.string()
    },
    handler: async (ctx, args) => {
        const text = formatProductMessage(args.name, args.price, args.description, args.productUrl);
        await ctx.runAction(internal.agent.executeTool, {
            chatId: args.chatId,
            contactPhone: args.contactPhone,
            tool: "text",
            payload: { text }
        });
        if (args.imageUrl && args.imageUrl !== "null") {
            await ctx.runAction(internal.agent.executeTool, {
                chatId: args.chatId,
                contactPhone: args.contactPhone,
                tool: "image",
                payload: { imageUrl: args.imageUrl, caption: `${args.name} - ${args.price}` }
            });
        }
    }
});

export const executeTool = internalAction({
    args: {
        chatId: v.id("chats"),
        contactPhone: v.string(),
        tool: v.union(v.literal("text"), v.literal("image"), v.literal("link"), v.literal("audio")),
        payload: v.any()
    },
    handler: async (ctx, args) => {
        if (args.tool === "text") {
            const raw = typeof args.payload?.text === "string" ? args.payload.text : String(args.payload || "").trim();
            const text = cleanText(raw);
            if (text) {
                await ctx.runMutation(internal.messages.sendAndSave, {
                    chatId: args.chatId,
                    content: text,
                    type: "text",
                    contactPhone: args.contactPhone
                });
            }
            return;
        }
        if (args.tool === "image") {
            const link = String(args.payload?.imageUrl || args.payload?.link || "");
            const caption = String(args.payload?.caption || "");
            if (link) {
                await ctx.runMutation(internal.messages.sendAndSave, {
                    chatId: args.chatId,
                    contactPhone: args.contactPhone,
                    content: caption,
                    type: "image",
                    mediaUrl: link
                });
            }
            return;
        }
        if (args.tool === "link") {
            const url = String(args.payload?.url || args.payload);
            if (url) {
                const text = `🔗 *Link:* ${url}`;
                await ctx.runMutation(internal.messages.sendAndSave, {
                    chatId: args.chatId,
                    content: text,
                    type: "text",
                    contactPhone: args.contactPhone
                });
            }
            return;
        }
        if (args.tool === "audio") {
            const link = String(args.payload?.audioUrl || args.payload?.link || "");
            if (link) {
                await ctx.runMutation(internal.messages.sendAndSave, {
                    chatId: args.chatId,
                    contactPhone: args.contactPhone,
                    content: "",
                    type: "audio",
                    mediaUrl: link
                });
            }
            return;
        }
    }
});

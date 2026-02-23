import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    role: v.union(v.literal("admin"), v.literal("agent"), v.literal("user")),
    // Auth fields (if using custom auth or linking to provider)
    tokenIdentifier: v.optional(v.string()),
    password: v.optional(v.string()),
  }).index("by_email", ["email"])
    .index("by_token", ["tokenIdentifier"])
    .index("by_phone", ["phone"]),

  otps: defineTable({
    phone: v.string(),
    code: v.string(),
    expiresAt: v.number(),
    attempts: v.number(),
  }).index("by_phone", ["phone"]),

  whatsapp_numbers: defineTable({
    businessAccountId: v.string(),
    businessNumberId: v.string(), // Meta phone_number_id; used for routing
    phone: v.string(),
    name: v.string(),
    accessToken: v.optional(v.string()),
    tokenStatus: v.optional(v.union(
      v.literal("connected"),
      v.literal("token_invalid"),
      v.literal("auth_failed")
    )),
    lastAuthErrorCode: v.optional(v.number()),
    lastAuthErrorMessage: v.optional(v.string()),
    lastAuthErrorAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_business_number_id", ["businessNumberId"]),

  chats: defineTable({
    contactId: v.string(), // WhatsApp contact id / phone
    contactName: v.string(),
    contactPhone: v.string(),
    phoneNumberId: v.optional(v.string()), // Meta phone_number_id; scopes chat to a business number
    lastMessageTime: v.number(),
    unreadCount: v.number(),
    status: v.union(v.literal("active"), v.literal("expired")), // 24h window
    tags: v.optional(v.array(v.string())),
    assignedTo: v.optional(v.id("users")), // Assigned agent
    aiMode: v.optional(v.boolean()), // AI Agent Mode
    aiSummary: v.optional(v.string()), // Compressed conversation history
  }).index("by_last_message", ["lastMessageTime"])
    .index("by_assigned_to", ["assignedTo"])
    .index("by_phoneNumberId_last_message", ["phoneNumberId", "lastMessageTime"])
    .index("by_phoneNumberId_contactPhone", ["phoneNumberId", "contactPhone"]),

  ai_configs: defineTable({
    phoneNumberId: v.optional(v.string()), // null/undefined = global default; otherwise per-number config
    systemPrompt: v.string(),
    model: v.string(),
    temperature: v.optional(v.number()),
    isActive: v.boolean(),
    agentName: v.optional(v.string()),
    toolsEnabled: v.optional(v.array(v.union(
      v.literal("send_text"),
      v.literal("send_image"),
      v.literal("send_link"),
      v.literal("send_audio"),
      v.literal("send_product"),
      v.literal("transfer_to_human")
    ))),
    recommendProducts: v.optional(v.boolean()),
    manualCatalogEnabled: v.optional(v.boolean()),
    fallbackMode: v.optional(v.union(
      v.literal("no_reply"),
      v.literal("text_only"),
      v.literal("human_handoff")
    )),
    openRouterApiKey: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_phone_number_id", ["phoneNumberId"]),

  agent_feedback: defineTable({
    source: v.union(v.literal("test"), v.literal("chat")),
    rating: v.number(),
    comment: v.optional(v.string()),
    testInput: v.optional(v.string()),
    testOutput: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_created_at", ["createdAt"]),

  messages: defineTable({
    chatId: v.id("chats"),
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    type: v.union(v.literal("text"), v.literal("image"), v.literal("video"), v.literal("audio"), v.literal("document"), v.literal("template"), v.literal("interactive")),
    content: v.optional(v.string()), // Text body or Caption
    mediaId: v.optional(v.string()), // Meta Media ID
    storageId: v.optional(v.string()), // Convex Storage ID
    status: v.union(v.literal("sent"), v.literal("delivered"), v.literal("read"), v.literal("failed")),
    mediaHydrationStatus: v.optional(v.union(v.literal("pending"), v.literal("success"), v.literal("failed"))),
    mediaHydrationError: v.optional(v.string()),
    timestamp: v.number(),
    metaMessageId: v.optional(v.string()),
    replyTo: v.optional(v.id("messages")), // Reference to message being replied to
  }).index("by_chat", ["chatId"])
    .index("by_direction", ["direction"])
    .index("by_meta_message_id", ["metaMessageId"]),

  files: defineTable({
    storageId: v.string(),
    url: v.string(),
    name: v.string(),
    mimeType: v.string(),
    size: v.number(),
    uploadedBy: v.id("users"),
    category: v.optional(v.string()), // e.g., "campaign", "chat"
    whatsappMediaId: v.optional(v.string()), // Added for mapped media
    createdAt: v.number(),
  }).index("by_category", ["category"])
    .index("by_whatsapp_media_id", ["whatsappMediaId"]),

  templates: defineTable({
    phoneNumberId: v.optional(v.string()), // Meta phone_number_id; template scope per sender number
    name: v.string(),
    language: v.string(),
    category: v.string(),
    content: v.optional(v.string()), // <--- Added content field
    components: v.any(), // JSON structure of components
    status: v.union(v.literal("APPROVED"), v.literal("REJECTED"), v.literal("PENDING")),
    metaTemplateId: v.optional(v.string()),
    lastSyncedAt: v.number(),
  }).index("by_phone_number_id", ["phoneNumberId"])
    .index("by_phone_number_id_name", ["phoneNumberId", "name"])
    .index("by_phone_number_id_name_language", ["phoneNumberId", "name", "language"]),

  // Template store: library of default + user-added template definitions (not yet on Meta)
  template_store: defineTable({
    name: v.string(),
    language: v.string(),
    category: v.string(),
    components: v.any(), // Same JSON shape as Meta (BODY, HEADER, BUTTONS, etc.)
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isDefault: v.optional(v.boolean()),
    formSnapshot: v.optional(v.any()), // Form state for pre-fill on "Use template"
    createdAt: v.optional(v.number()),
  }).index("by_created_at", ["createdAt"]),

  products: defineTable({
    externalId: v.string(), // SOLO ID
    name: v.string(),
    price: v.number(),
    currency: v.string(),
    imageUrl: v.optional(v.string()),
    description: v.optional(v.string()),
    inStock: v.boolean(),
  }).index("by_external_id", ["externalId"])
    .searchIndex("search_products", {
      searchField: "name",
      filterFields: ["inStock"]
    }),

  knowledge_base: defineTable({
    phoneNumberId: v.optional(v.string()),
    title: v.string(),
    content: v.string(),
    embedding: v.array(v.float64()), // Vector for RAG; must match vector index dimensions
    sourceType: v.union(v.literal("text"), v.literal("pdf"), v.literal("manual_product"), v.literal("product_category")),
    sourceRef: v.optional(v.string()),
    createdAt: v.number(),
  }).vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
  }),

  product_categories: defineTable({
    phoneNumberId: v.string(),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    source: v.union(v.literal("ai"), v.literal("manual")),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_phone_name", ["phoneNumberId", "name"])
    .index("by_phone_slug", ["phoneNumberId", "slug"])
    .index("by_phone_updated", ["phoneNumberId", "updatedAt"]),

  manual_products: defineTable({
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
  }).index("by_phone_updated", ["phoneNumberId", "updatedAt"])
    .index("by_phone_category", ["phoneNumberId", "categoryId"])
    .searchIndex("search_manual_products", {
      searchField: "title",
      filterFields: ["phoneNumberId"],
    }),

  // Salla OAuth Integration - stores tokens, fetches products on demand
  sallaIntegrations: defineTable({
    merchantId: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
    storeName: v.optional(v.string()),
    storeUrl: v.optional(v.string()),
    connectedAt: v.number(),
    tokenStatus: v.optional(v.union(
      v.literal("connected"),
      v.literal("token_invalid"),
      v.literal("refresh_failed")
    )),
    lastTokenErrorCode: v.optional(v.number()),
    lastTokenErrorMessage: v.optional(v.string()),
    lastTokenErrorAt: v.optional(v.number()),
  }).index("by_merchant", ["merchantId"]),

  // --- Scalable Campaigns Schema ---

  contacts: defineTable({
    name: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    stage: v.optional(v.string()),
    customFields: v.optional(v.any()), // JSON
    isSubscribed: v.boolean(),
    createdAt: v.number(),
    // Anti-spam tracking fields
    lastMessagedAt: v.optional(v.number()),        // Timestamp of last message sent
    lastMessagedTemplate: v.optional(v.string()),  // Last template name sent
  }).index("by_phone", ["phone"])
    .index("by_tag", ["tags"]), // Note: Convex doesn't support array indexing directly like this, but we'll filter

  segments: defineTable({
    name: v.string(),
    criteria: v.any(), // JSON criteria
    count: v.number(),
    lastCalculatedAt: v.number(),
  }),

  campaigns: defineTable({
    name: v.string(),
    templateId: v.id("templates"),
    templateName: v.string(),
    templateLanguage: v.optional(v.string()),
    phoneNumberId: v.optional(v.string()), // Meta phone_number_id; which number sends campaign messages
    isTestCampaign: v.optional(v.boolean()),
    testBypassRecentContact: v.optional(v.boolean()),
    testContactPhones: v.optional(v.array(v.string())),
    segmentId: v.optional(v.id("segments")), // Optional if sending to specific tags/list
    targetTags: v.optional(v.array(v.string())), // Alternative to segment
    targetContactIds: v.optional(v.array(v.id("contacts"))), // Specific list of contacts
    status: v.union(
      v.literal("DRAFT"),
      v.literal("SCHEDULED"),
      v.literal("PROCESSING"),
      v.literal("COMPLETED"),
      v.literal("FAILED"),
      v.literal("PAUSED")
    ),
    scheduledAt: v.number(),
    recurrenceCronSpec: v.optional(v.string()),
    stats: v.object({
      total: v.number(),
      sent: v.number(),
      delivered: v.number(),
      read: v.number(),
      failed: v.number(),
      skipped: v.optional(v.number()),  // Contacts skipped due to rate limiting
    }),
    // Anti-spam sending configuration
    sendingConfig: v.optional(v.object({
      messagesPerSecond: v.number(),      // Target rate (default: 10)
      delayBetweenMessages: v.number(),   // ms delay between each message
      maxRetries: v.number(),             // Max retries per contact
      skipRecentlyContacted: v.boolean(), // Skip if contacted in last N hours
      recentContactHours: v.number(),     // Hours to consider "recent"
    })),
    createdAt: v.number(),
  }).index("by_phone_number_id", ["phoneNumberId"]),

  // Workflows (Automation)
  workflows: defineTable({
    phoneNumberId: v.optional(v.string()), // Undefined means global fallback workflow
    name: v.string(),
    trigger: v.string(), // new_message, keyword, etc.
    triggerConfig: v.any(), // { keyword: "hello" }
    action: v.string(), // send_message, add_tag
    actionConfig: v.any(), // { templateId: "..." }
    enabled: v.boolean(),
    stats: v.object({
      runs: v.number(),
      lastRun: v.optional(v.number())
    }),
    createdAt: v.number(),
  }).index("by_phone_number_id_enabled", ["phoneNumberId", "enabled"]),

  campaign_logs: defineTable({
    campaignId: v.id("campaigns"),
    contactId: v.id("contacts"),
    status: v.union(
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("read"),
      v.literal("failed"),
      v.literal("skipped")  // Skipped due to rate limiting or recently contacted
    ),
    metaMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
    skipReason: v.optional(v.string()),  // "recently_contacted", "rate_limited", etc.
  }).index("by_campaign", ["campaignId"])
    .index("by_message_id", ["metaMessageId"]),

  notifications: defineTable({
    type: v.union(v.literal("info"), v.literal("warning"), v.literal("error"), v.literal("success")),
    title: v.string(),
    message: v.string(),
    read: v.boolean(),
    createdAt: v.number(),
    link: v.optional(v.string()),
  }).index("by_read", ["read"])
    .index("by_created_at", ["createdAt"]),

  // Single-row notification behavior settings (editable from dashboard)
  notification_preferences: defineTable({
    humanHandoffPushEnabled: v.boolean(),
    suppressPushWhenChatActive: v.boolean(),
    updatedAt: v.number(),
  }),

  webhook_events: defineTable({
    source: v.union(v.literal("whatsapp"), v.literal("salla")),
    body: v.any(),
    processingStatus: v.optional(v.union(
      v.literal("received"),
      v.literal("ignored_no_messages"),
      v.literal("saved"),
      v.literal("failed")
    )),
    eventType: v.optional(v.string()),
    resolvedPhoneNumberId: v.optional(v.string()),
    fallbackUsed: v.optional(v.boolean()),
    hasMessages: v.optional(v.boolean()),
    messagesCount: v.optional(v.number()),
    hasStatuses: v.optional(v.boolean()),
    statusesCount: v.optional(v.number()),
    metadataPhoneNumberId: v.optional(v.string()),
    metadataDisplayPhoneNumber: v.optional(v.string()),
    note: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_source_createdAt", ["source", "createdAt"]),

  mobile_runtime_events: defineTable({
    source: v.union(v.literal("mobile"), v.literal("synthetic")),
    platform: v.optional(v.string()),
    appVersion: v.optional(v.string()),
    buildId: v.optional(v.string()),
    jsEngine: v.optional(v.string()),
    eventName: v.string(),
    severity: v.union(
      v.literal("info"),
      v.literal("warning"),
      v.literal("error"),
      v.literal("fatal")
    ),
    message: v.optional(v.string()),
    stack: v.optional(v.string()),
    phase: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_severity_createdAt", ["severity", "createdAt"])
    .index("by_eventName_createdAt", ["eventName", "createdAt"]),

  // Single-row: WhatsApp webhook verify token, app access token, optional App ID (from DB, not env)
  webhook_settings: defineTable({
    verifyToken: v.optional(v.string()),
    accessToken: v.optional(v.string()),
    appId: v.optional(v.string()),
    defaultPhoneNumberId: v.optional(v.string()),
    updatedAt: v.number(),
  }),

  orders: defineTable({
    orderNumber: v.string(),
    customerName: v.string(),
    customerPhone: v.optional(v.string()),
    amount: v.number(),
    status: v.union(v.literal("pending"), v.literal("processing"), v.literal("completed"), v.literal("cancelled"), v.literal("refunded")),
    currency: v.string(),
    items: v.any(), // JSON array of items
    createdAt: v.number(),
  }).index("by_status", ["status"]),

  admin_seed_runs: defineTable({
    status: v.union(v.literal("success"), v.literal("failed"), v.literal("dry_run")),
    summary: v.any(),
    startedAt: v.number(),
    finishedAt: v.number(),
    durationMs: v.number(),
    error: v.optional(v.string()),
  }).index("by_started_at", ["startedAt"]),

  admin_users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    role: v.union(v.literal("admin"), v.literal("agent"), v.literal("user")),
    tokenIdentifier: v.optional(v.string()),
    password: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_email", ["email"])
    .index("by_phone", ["phone"])
    .index("by_token", ["tokenIdentifier"]),

  admin_whatsapp_numbers: defineTable({
    businessAccountId: v.string(),
    businessNumberId: v.string(),
    phone: v.string(),
    name: v.string(),
    accessToken: v.optional(v.string()),
    tokenStatus: v.optional(v.union(
      v.literal("connected"),
      v.literal("token_invalid"),
      v.literal("auth_failed")
    )),
    lastAuthErrorCode: v.optional(v.number()),
    lastAuthErrorMessage: v.optional(v.string()),
    lastAuthErrorAt: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_business_number_id", ["businessNumberId"])
    .index("by_phone", ["phone"]),

  admin_contacts: defineTable({
    name: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isSubscribed: v.boolean(),
    lastMessagedAt: v.optional(v.number()),
    lastMessagedTemplate: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_phone", ["phone"])
    .index("by_created_at", ["createdAt"]),

  admin_chats: defineTable({
    contactId: v.string(),
    contactName: v.string(),
    contactPhone: v.string(),
    phoneNumberId: v.optional(v.string()),
    lastMessage: v.optional(v.string()),
    lastMessageTime: v.number(),
    unreadCount: v.number(),
    status: v.union(v.literal("active"), v.literal("expired")),
    aiMode: v.optional(v.boolean()),
    assignedTo: v.optional(v.id("admin_users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_last_message", ["lastMessageTime"])
    .index("by_phone_last_message", ["phoneNumberId", "lastMessageTime"])
    .index("by_phone_contact", ["phoneNumberId", "contactPhone"]),

  admin_messages: defineTable({
    chatId: v.id("admin_chats"),
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    type: v.union(v.literal("text"), v.literal("image"), v.literal("video"), v.literal("audio"), v.literal("document"), v.literal("template"), v.literal("interactive")),
    content: v.optional(v.string()),
    mediaId: v.optional(v.string()),
    storageId: v.optional(v.string()),
    status: v.union(v.literal("sent"), v.literal("delivered"), v.literal("read"), v.literal("failed")),
    timestamp: v.number(),
    metaMessageId: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_chat", ["chatId"])
    .index("by_meta_message_id", ["metaMessageId"]),

  admin_templates: defineTable({
    phoneNumberId: v.optional(v.string()),
    name: v.string(),
    language: v.string(),
    category: v.string(),
    content: v.optional(v.string()),
    components: v.any(),
    status: v.union(v.literal("APPROVED"), v.literal("REJECTED"), v.literal("PENDING")),
    metaTemplateId: v.optional(v.string()),
    lastSyncedAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_phone", ["phoneNumberId"])
    .index("by_phone_name", ["phoneNumberId", "name"])
    .index("by_phone_name_language", ["phoneNumberId", "name", "language"]),

  admin_template_store: defineTable({
    name: v.string(),
    language: v.string(),
    category: v.string(),
    components: v.any(),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isDefault: v.optional(v.boolean()),
    formSnapshot: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_created_at", ["createdAt"])
    .index("by_category", ["category"]),

  admin_campaigns: defineTable({
    name: v.string(),
    templateId: v.id("admin_templates"),
    templateName: v.string(),
    templateLanguage: v.optional(v.string()),
    phoneNumberId: v.optional(v.string()),
    status: v.union(
      v.literal("DRAFT"),
      v.literal("SCHEDULED"),
      v.literal("PROCESSING"),
      v.literal("COMPLETED"),
      v.literal("FAILED"),
      v.literal("PAUSED")
    ),
    scheduledAt: v.number(),
    recurrenceCronSpec: v.optional(v.string()),
    segmentId: v.optional(v.string()),
    targetTags: v.optional(v.array(v.string())),
    targetContactIds: v.optional(v.array(v.id("admin_contacts"))),
    isTestCampaign: v.optional(v.boolean()),
    testBypassRecentContact: v.optional(v.boolean()),
    testContactPhones: v.optional(v.array(v.string())),
    stats: v.object({
      total: v.number(),
      sent: v.number(),
      delivered: v.number(),
      read: v.number(),
      failed: v.number(),
      skipped: v.optional(v.number()),
    }),
    sendingConfig: v.optional(v.object({
      messagesPerSecond: v.number(),
      delayBetweenMessages: v.number(),
      maxRetries: v.number(),
      skipRecentlyContacted: v.boolean(),
      recentContactHours: v.number(),
    })),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_phone_number_id", ["phoneNumberId"])
    .index("by_status", ["status"])
    .index("by_created_at", ["createdAt"]),

  admin_campaign_logs: defineTable({
    campaignId: v.id("admin_campaigns"),
    contactId: v.id("admin_contacts"),
    status: v.union(
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("read"),
      v.literal("failed"),
      v.literal("skipped")
    ),
    metaMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
    skipReason: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_campaign", ["campaignId"])
    .index("by_message_id", ["metaMessageId"])
    .index("by_created_at", ["createdAt"]),

  admin_workflows: defineTable({
    phoneNumberId: v.optional(v.string()),
    name: v.string(),
    trigger: v.string(),
    triggerConfig: v.any(),
    action: v.string(),
    actionConfig: v.any(),
    enabled: v.boolean(),
    stats: v.object({
      runs: v.number(),
      lastRun: v.optional(v.number()),
    }),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_phone_enabled", ["phoneNumberId", "enabled"])
    .index("by_updated_at", ["updatedAt"]),

  admin_notifications: defineTable({
    type: v.union(v.literal("info"), v.literal("warning"), v.literal("error"), v.literal("success")),
    title: v.string(),
    message: v.string(),
    read: v.boolean(),
    link: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_read", ["read"])
    .index("by_created_at", ["createdAt"]),

  admin_ai_configs: defineTable({
    phoneNumberId: v.optional(v.string()),
    systemPrompt: v.string(),
    model: v.string(),
    temperature: v.optional(v.number()),
    isActive: v.boolean(),
    agentName: v.optional(v.string()),
    toolsEnabled: v.optional(v.array(v.union(
      v.literal("send_text"),
      v.literal("send_image"),
      v.literal("send_link"),
      v.literal("send_audio"),
      v.literal("send_product"),
      v.literal("transfer_to_human")
    ))),
    recommendProducts: v.optional(v.boolean()),
    manualCatalogEnabled: v.optional(v.boolean()),
    fallbackMode: v.optional(v.union(
      v.literal("no_reply"),
      v.literal("text_only"),
      v.literal("human_handoff")
    )),
    updatedAt: v.number(),
  }).index("by_phone_number_id", ["phoneNumberId"]),

  admin_product_categories: defineTable({
    phoneNumberId: v.string(),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    source: v.union(v.literal("ai"), v.literal("manual")),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_phone_name", ["phoneNumberId", "name"])
    .index("by_phone_slug", ["phoneNumberId", "slug"])
    .index("by_phone_updated", ["phoneNumberId", "updatedAt"]),

  admin_manual_products: defineTable({
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
    categoryId: v.optional(v.id("admin_product_categories")),
    categoryNameSnapshot: v.optional(v.string()),
    aiAdvice: v.optional(v.string()),
    aiSummary: v.optional(v.string()),
    aiKeywords: v.optional(v.array(v.string())),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_phone_updated", ["phoneNumberId", "updatedAt"])
    .index("by_phone_category", ["phoneNumberId", "categoryId"])
    .searchIndex("search_admin_manual_products", {
      searchField: "title",
      filterFields: ["phoneNumberId"],
    }),

  admin_webhook_settings: defineTable({
    verifyToken: v.optional(v.string()),
    accessToken: v.optional(v.string()),
    appId: v.optional(v.string()),
    defaultPhoneNumberId: v.optional(v.string()),
    updatedAt: v.number(),
  }),

  admin_files: defineTable({
    storageId: v.string(),
    url: v.string(),
    name: v.string(),
    mimeType: v.string(),
    size: v.number(),
    uploadedBy: v.optional(v.id("admin_users")),
    category: v.optional(v.string()),
    whatsappMediaId: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_category", ["category"])
    .index("by_whatsapp_media_id", ["whatsappMediaId"]),

  userActiveChats: defineTable({
    userId: v.id("users"),
    chatId: v.id("chats"),
    lastActiveAt: v.number(), // Timestamp when user last viewed this chat
  }).index("by_user", ["userId"])
    .index("by_user_chat", ["userId", "chatId"])
    .index("by_chat", ["chatId"]),
});

import type { CampaignCard, CampaignLogRow, CategoryRow, ChatMessage, ChatThread, CustomerRow, ProductCard, TemplateItem, WorkflowRule } from "@/mock/types";

const now = Date.now();

type PhoneNumber = {
  _id: string;
  businessNumberId: string;
  phone: string;
  name: string;
  businessAccountId: string;
  isActive?: boolean;
  tokenStatus?: "connected" | "auth_failed";
};

type User = {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "agent" | "user";
};

type Notification = {
  _id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  link?: string;
  read: boolean;
  createdAt: number;
};

type AgentConfig = {
  _id: string;
  phoneNumberId: string;
  isActive: boolean;
  agentName: string;
  model: string;
  recommendProducts: boolean;
  toolsEnabled: boolean;
};

type TemplateStoreItem = {
  _id: string;
  name: string;
  description?: string;
  category: string;
  language: string;
  tags?: string[];
  components?: any[];
  formSnapshot?: Record<string, unknown>;
};

type WorkflowDoc = WorkflowRule & {
  triggerConfig?: Record<string, unknown>;
  actionConfig?: Record<string, unknown>;
};

type ContactDoc = CustomerRow & {
  isBlocked?: boolean;
};

type ChatDoc = ChatThread & {
  status?: "active" | "expired";
  lastMessageTime: number;
};

type MessageDoc = ChatMessage & {
  direction: "inbound" | "outbound";
  timestamp: number;
  status?: "sent" | "delivered" | "read" | "failed";
  mediaUrl?: string;
};

type ManualCategory = CategoryRow & {
  phoneNumberId: string;
};

type ManualProduct = ProductCard & {
  phoneNumberId: string;
  createdAt: number;
  categoryNameSnapshot?: string;
  aiAdvice?: string;
  aiSummary?: string;
  aiKeywords?: string[];
};

const phoneNumbers: PhoneNumber[] = [
  {
    _id: "pn_shift",
    businessNumberId: "1029453556909294",
    phone: "+966 57 358 5358",
    name: "شيفت",
    businessAccountId: "ba_001",
    isActive: true,
    tokenStatus: "connected",
  },
  {
    _id: "pn_test",
    businessNumberId: "826449430554914",
    phone: "+20 101 563 8178",
    name: "فرع مصر",
    businessAccountId: "ba_002",
    isActive: true,
    tokenStatus: "connected",
  },
];

const users: User[] = [
  {
    _id: "user_admin_demo",
    name: "Ahmed",
    email: "133324agh@gmail.com",
    role: "admin",
  },
  {
    _id: "user_agent_demo",
    name: "Support",
    email: "support@example.com",
    role: "agent",
  },
];

const contacts: ContactDoc[] = [
  { _id: "contact_201015638178", name: "Ahmed", phone: "201015638178", tags: ["VIP", "test"], createdAt: now - 9 * 86400000, lastInteractionAt: now - 3600000 },
  { _id: "contact_966500107002", name: "Mohammed", phone: "966500107002", tags: ["lead"], createdAt: now - 8 * 86400000, lastInteractionAt: now - 2 * 3600000 },
  { _id: "contact_966500220033", name: "Lina", phone: "966500220033", tags: ["new"], createdAt: now - 3 * 86400000, lastInteractionAt: now - 4 * 3600000 },
];

const chats: ChatDoc[] = [
  {
    _id: "chat_1",
    contactId: "contact_201015638178",
    contactName: "Ahmed",
    contactPhone: "201015638178",
    phoneNumberId: "1029453556909294",
    lastMessage: "متاح عندكم عروض؟",
    lastMessageAt: now - 12 * 60000,
    lastMessageTime: now - 12 * 60000,
    unreadCount: 2,
    aiMode: true,
    status: "active",
  },
  {
    _id: "chat_2",
    contactId: "contact_966500107002",
    contactName: "Mohammed",
    contactPhone: "966500107002",
    phoneNumberId: "1029453556909294",
    lastMessage: "شكرا لكم",
    lastMessageAt: now - 90 * 60000,
    lastMessageTime: now - 90 * 60000,
    unreadCount: 0,
    aiMode: false,
    status: "active",
  },
];

const messages: MessageDoc[] = [
  {
    _id: "msg_1",
    chatId: "chat_1",
    sender: "user",
    direction: "inbound",
    type: "text",
    content: "السلام عليكم",
    createdAt: now - 40 * 60000,
    timestamp: now - 40 * 60000,
  },
  {
    _id: "msg_2",
    chatId: "chat_1",
    sender: "business",
    direction: "outbound",
    type: "text",
    content: "وعليكم السلام، كيف نقدر نساعدك؟",
    createdAt: now - 39 * 60000,
    timestamp: now - 39 * 60000,
    status: "read",
  },
  {
    _id: "msg_3",
    chatId: "chat_1",
    sender: "user",
    direction: "inbound",
    type: "text",
    content: "متاح عندكم عروض؟",
    createdAt: now - 12 * 60000,
    timestamp: now - 12 * 60000,
  },
  {
    _id: "msg_4",
    chatId: "chat_2",
    sender: "business",
    direction: "outbound",
    type: "image",
    content: "صورة المنتج",
    mediaUrl: "https://images.unsplash.com/photo-1585386959984-a4155224a1ad?q=80&w=1200&auto=format&fit=crop",
    createdAt: now - 95 * 60000,
    timestamp: now - 95 * 60000,
    status: "delivered",
  },
];

const templates: TemplateItem[] = [
  {
    _id: "tpl_tasees_day2",
    name: "tasees_day2",
    language: "ar",
    status: "APPROVED",
    category: "MARKETING",
    phoneNumberId: "1029453556909294",
    lastSyncedAt: now - 3600000,
  },
  {
    _id: "tpl_tasees_day1",
    name: "tasees_day1",
    language: "ar",
    status: "APPROVED",
    category: "MARKETING",
    phoneNumberId: "1029453556909294",
    lastSyncedAt: now - 2 * 3600000,
  },
  {
    _id: "tpl_product_list",
    name: "product_offers_list_copy",
    language: "ar",
    status: "APPROVED",
    category: "MARKETING",
    phoneNumberId: "1029453556909294",
    lastSyncedAt: now - 3 * 3600000,
  },
  {
    _id: "tpl_hello_world",
    name: "hello_world",
    language: "en_US",
    status: "APPROVED",
    category: "UTILITY",
    phoneNumberId: "826449430554914",
    lastSyncedAt: now - 7 * 3600000,
  },
];

const templateStore: TemplateStoreItem[] = [
  {
    _id: "store_1",
    name: "product_offer",
    description: "عرض منتج مع زر رابط",
    category: "MARKETING",
    language: "ar",
    tags: ["product", "marketing", "offer"],
    components: [{ type: "BODY", text: "عرض خاص على المنتج {{1}} لفترة محدودة" }],
  },
  {
    _id: "store_2",
    name: "order_confirmation",
    description: "تأكيد الطلب",
    category: "UTILITY",
    language: "ar",
    tags: ["order", "utility"],
    components: [{ type: "BODY", text: "تم استلام طلبك رقم {{1}}" }],
  },
];

const campaigns: CampaignCard[] = [
  {
    _id: "camp_1",
    name: "حملة التأسيس يوم 2",
    status: "COMPLETED",
    templateName: "tasees_day2",
    templateLanguage: "ar",
    phoneNumberId: "1029453556909294",
    audienceCount: 2,
    sentCount: 0,
    failedCount: 2,
    skippedCount: 0,
    createdAt: now - 6 * 3600000,
    updatedAt: now - 5 * 3600000,
  },
  {
    _id: "camp_2",
    name: "Quick Campaign",
    status: "PROCESSING",
    templateName: "hello_world",
    templateLanguage: "en_US",
    phoneNumberId: "826449430554914",
    audienceCount: 3,
    sentCount: 1,
    failedCount: 0,
    skippedCount: 2,
    createdAt: now - 2 * 3600000,
    updatedAt: now - 30 * 60000,
  },
];

const campaignLogs: CampaignLogRow[] = [
  {
    _id: "log_1",
    campaignId: "camp_1",
    contactId: "contact_201015638178",
    phone: "201015638178",
    contactName: "Ahmed",
    status: "failed",
    error: "[132001] Template language mismatch",
    createdAt: now - 5 * 3600000,
  },
  {
    _id: "log_2",
    campaignId: "camp_1",
    contactId: "contact_966500107002",
    phone: "966500107002",
    contactName: "Mohammed",
    status: "failed",
    error: "[132001] Template language mismatch",
    createdAt: now - 5 * 3600000 + 120000,
  },
  {
    _id: "log_3",
    campaignId: "camp_2",
    contactId: "contact_201015638178",
    phone: "201015638178",
    contactName: "Ahmed",
    status: "skipped",
    skipReason: "recently_contacted",
    createdAt: now - 50 * 60000,
  },
];

const workflows: WorkflowDoc[] = [
  {
    _id: "wf_1",
    name: "ترحيب عملاء جدد",
    triggerType: "new_chat",
    actionType: "send_template",
    phoneNumberId: "1029453556909294",
    isActive: true,
    updatedAt: now - 2 * 86400000,
    triggerConfig: {},
    actionConfig: { template: "tasees_day1", language: "ar" },
  },
];

const categories: ManualCategory[] = [
  {
    _id: "cat_1",
    phoneNumberId: "1029453556909294",
    name: "عطور",
    slug: "fragrance",
    description: "منتجات العطور",
    source: "manual",
    isActive: true,
    productsCount: 1,
    updatedAt: now - 2 * 3600000,
  },
  {
    _id: "cat_2",
    phoneNumberId: "1029453556909294",
    name: "هدايا",
    slug: "gifts",
    description: "منتجات الهدايا",
    source: "ai",
    isActive: true,
    productsCount: 1,
    updatedAt: now - 5 * 3600000,
  },
];

const manualProducts: ManualProduct[] = [
  {
    _id: "mp_1",
    phoneNumberId: "1029453556909294",
    title: "عطر مسك",
    description: "عطر مسك فاخر بثبات عالٍ مناسب للهدايا والمناسبات.",
    images: [
      {
        url: "https://images.unsplash.com/photo-1541643600914-78b084683601?q=80&w=800&auto=format&fit=crop",
        order: 0,
      },
    ],
    categoryId: "cat_1",
    categoryNameSnapshot: "عطور",
    isActive: true,
    updatedAt: now - 2 * 3600000,
    createdAt: now - 7 * 86400000,
    aiAdvice: "اختيار ممتاز للهدايا الراقية.",
    aiSummary: "عطر عربي فاخر مناسب للمناسبات.",
    aiKeywords: ["عطر", "هدية"],
  },
  {
    _id: "mp_2",
    phoneNumberId: "1029453556909294",
    title: "باقة هدية",
    description: "باقة هدية متكاملة تشمل عطر وكرت معايدة وتغليف مميز.",
    images: [
      {
        url: "https://images.unsplash.com/photo-1512909006721-3d6018887383?q=80&w=800&auto=format&fit=crop",
        order: 0,
      },
    ],
    categoryId: "cat_2",
    categoryNameSnapshot: "هدايا",
    isActive: true,
    updatedAt: now - 5 * 3600000,
    createdAt: now - 6 * 86400000,
    aiAdvice: "مناسب للإهداء المباشر مع تسليم سريع.",
    aiSummary: "باقة مناسبة للمناسبات.",
    aiKeywords: ["باقة", "هدية"],
  },
];

const files = [
  {
    _id: "file_1",
    name: "hero.png",
    url: "https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=1200&auto=format&fit=crop",
    createdAt: now - 3 * 86400000,
  },
];

const notifications: Notification[] = [
  {
    _id: "notif_1",
    title: "تنبيه حملة",
    message: "فشل إرسال قالب لأحد العملاء",
    type: "warning",
    read: false,
    link: "/campaigns",
    createdAt: now - 15 * 60000,
  },
];

const agents: AgentConfig[] = [
  {
    _id: "agent_1",
    phoneNumberId: "1029453556909294",
    isActive: true,
    agentName: "Shift Agent",
    model: "openai/gpt-4o-mini",
    recommendProducts: true,
    toolsEnabled: true,
  },
];

const aiConfigs: Record<string, any> = {
  default: {
    systemPrompt: "أنت مساعد متجر عربي محترف.",
    model: "openai/gpt-4o-mini",
    temperature: 0.5,
    isActive: true,
    manualCatalogEnabled: true,
  },
  "1029453556909294": {
    systemPrompt: "مساعد خاص برقم شيفت",
    model: "openai/gpt-4o-mini",
    temperature: 0.4,
    isActive: true,
    manualCatalogEnabled: true,
  },
};

const webhookSettings = {
  enabled: true,
  verifyToken: "demo-verify-token",
};

const knowledgeBase = [
  { _id: "kb_1", title: "سياسة الشحن", content: "الشحن خلال 24-48 ساعة" },
  { _id: "kb_2", title: "سياسة الاسترجاع", content: "استرجاع خلال 14 يوم" },
];

let idCounter = 1000;
let version = 1;
const listeners = new Set<() => void>();

function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${idCounter}`;
}

function bump(): void {
  version += 1;
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getVersion(): number {
  return version;
}

function getPath(ref: any): string {
  if (!ref) return "";
  const path = ref.__path || ref.toString?.() || "";
  return String(path);
}

function withTemplateComponents(t: TemplateItem): any {
  const isMedia = t.name.includes("offers") || t.name.includes("day");
  return {
    ...t,
    content: `محتوى القالب ${t.name}`,
    components: [
      ...(isMedia ? [{ type: "HEADER", format: "TEXT", text: "عنوان" }] : []),
      { type: "BODY", text: `نص القالب ${t.name} ...` },
      {
        type: "BUTTONS",
        buttons: [
          { type: "URL", text: "عرض", url: "https://example.com" },
          { type: "QUICK_REPLY", text: "موافق" },
        ],
      },
    ],
  };
}

function getStats(): any {
  return {
    totalMessages: messages.length,
    totalContacts: contacts.length,
    totalCampaigns: campaigns.length,
    deliveryRate: 94.6,
    readRate: 83.2,
    chartData: [
      { day: "السبت", campaigns: 2 },
      { day: "الأحد", campaigns: 4 },
      { day: "الاثنين", campaigns: 3 },
      { day: "الثلاثاء", campaigns: 5 },
      { day: "الأربعاء", campaigns: 2 },
      { day: "الخميس", campaigns: 6 },
      { day: "الجمعة", campaigns: 1 },
    ],
    recentActivity: [
      { id: "a1", type: "message", action: "رسالة جديدة من Ahmed", time: now - 10 * 60000 },
      { id: "a2", type: "broadcast", action: "انتهت حملة ترويجية", time: now - 120 * 60000 },
      { id: "a3", type: "template", action: "تمت مزامنة القوالب", time: now - 5 * 3600000 },
    ],
  };
}

export function resolveQuery(ref: any, args?: any): any {
  if (args === "skip") return undefined;
  const path = getPath(ref);

  switch (path) {
    case "auth.getUser": {
      const userId = args?.userId ? String(args.userId) : users[0]._id;
      return users.find((u) => u._id === userId) ?? users[0];
    }
    case "stats.getDashboardStats":
      return getStats();
    case "whatsappNumbers.list":
      return [...phoneNumbers];
    case "users.list":
      return [...users];
    case "users.getCurrentUserRole":
      return { role: "admin" };
    case "contacts.list":
      return [...contacts].sort((a, b) => (b.lastInteractionAt ?? b.createdAt) - (a.lastInteractionAt ?? a.createdAt));
    case "contacts.getById":
      return contacts.find((c) => c._id === String(args?.id)) ?? null;
    case "chat.listChats": {
      const phoneId = args?.phoneNumberId;
      const data = phoneId ? chats.filter((c) => c.phoneNumberId === phoneId) : chats;
      return [...data].sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    }
    case "chat.getChat":
      return chats.find((c) => c._id === String(args?.chatId)) ?? null;
    case "chat.getLatestGlobalMessage": {
      const latest = [...messages].sort((a, b) => b.timestamp - a.timestamp)[0];
      if (!latest) return null;
      const chat = chats.find((c) => c._id === latest.chatId);
      return {
        messageId: latest._id,
        chatId: latest.chatId,
        contactName: chat?.contactName ?? "عميل",
        content: latest.content,
        type: latest.type,
        phoneNumberId: chat?.phoneNumberId,
        businessName: phoneNumbers.find((n) => n.businessNumberId === chat?.phoneNumberId)?.name,
      };
    }
    case "chat.getMessagesPage": {
      const chatId = String(args?.chatId ?? "");
      return [...messages]
        .filter((m) => m.chatId === chatId)
        .sort((a, b) => b.timestamp - a.timestamp)
        .map((m) => ({ ...m }));
    }
    case "notifications.list": {
      const limit = Number(args?.limit ?? 10);
      return [...notifications].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
    }
    case "campaigns.list": {
      const phoneId = args?.phoneNumberId;
      const data = phoneId ? campaigns.filter((c) => c.phoneNumberId === phoneId) : campaigns;
      return [...data].sort((a, b) => b.updatedAt - a.updatedAt);
    }
    case "campaigns.getCampaignLogs":
      return campaignLogs
        .filter((l) => l.campaignId === String(args?.campaignId))
        .sort((a, b) => b.createdAt - a.createdAt);
    case "campaigns.getSendReadiness": {
      const phoneId = String(args?.phoneNumberId ?? "");
      const pn = phoneNumbers.find((n) => n.businessNumberId === phoneId);
      const scopedApprovedCount = templates.filter((t) => t.phoneNumberId === phoneId && t.status === "APPROVED").length;
      const tokenStatus = pn?.tokenStatus ?? "connected";
      if (!pn) {
        return { ready: false, tokenStatus: "disconnected", scopedApprovedCount: 0, blockingReason: "MISSING_NUMBER", recommendedAction: "اختر رقماً للإرسال" };
      }
      if (tokenStatus === "auth_failed") {
        return { ready: false, tokenStatus, scopedApprovedCount, blockingReason: "AUTH_BLOCKED", recommendedAction: "أعد ربط الرقم من التكاملات" };
      }
      if (scopedApprovedCount === 0) {
        return { ready: false, tokenStatus, scopedApprovedCount, blockingReason: "NO_SCOPED_TEMPLATES", recommendedAction: "قم بمزامنة القوالب" };
      }
      return { ready: true, tokenStatus, scopedApprovedCount, blockingReason: null, recommendedAction: null };
    }
    case "campaigns.listRecentAuthBlocks":
      return [
        {
          _id: "auth_block_1",
          phoneNumberId: "1029453556909294",
          phoneName: "شيفت",
          code: 190,
          message: "Authentication token requires reconnect",
          createdAt: now - 3600000,
        },
      ];
    case "campaigns.validateTemplateSelection": {
      const templateName = String(args?.templateName ?? "");
      const phoneId = args?.phoneNumberId ? String(args.phoneNumberId) : undefined;
      const requestedLanguage = String(args?.languageCode ?? args?.language ?? "").toLowerCase();
      const found = templates.find(
        (t) =>
          t.name === templateName &&
          (!phoneId || t.phoneNumberId === phoneId) &&
          t.status === "APPROVED" &&
          (!requestedLanguage || t.language.toLowerCase() === requestedLanguage)
      );
      if (!found) {
        return {
          ok: false,
          reasonCode: "TEMPLATE_NOT_FOUND",
          message: `Template ${templateName} غير متاح لهذا الرقم/اللغة`,
          suggestedAction: "قم بمزامنة القوالب أو اختر قالباً آخر",
        };
      }
      return { ok: true, templateId: found._id, name: found.name, language: found.language };
    }
    case "ai_config.getConfig": {
      const key = args?.phoneNumberId ? String(args.phoneNumberId) : "default";
      return aiConfigs[key] ?? aiConfigs.default;
    }
    case "ai.listKnowledge":
      return [...knowledgeBase];
    case "agent.feedbackStats":
      return { average: 4.6, count: 12 };
    case "templates.list": {
      const phoneId = args?.phoneNumberId;
      const data = phoneId ? templates.filter((t) => t.phoneNumberId === phoneId) : templates;
      return data.map(withTemplateComponents);
    }
    case "templates.listScopedApproved": {
      const phoneId = String(args?.phoneNumberId ?? "");
      return templates
        .filter((t) => t.phoneNumberId === phoneId && t.status === "APPROVED")
        .map(withTemplateComponents);
    }
    case "templates.getScopedTemplateHealth": {
      const phoneId = String(args?.phoneNumberId ?? "");
      const scoped = templates.filter((t) => t.phoneNumberId === phoneId && t.status === "APPROVED");
      const pn = phoneNumbers.find((n) => n.businessNumberId === phoneId);
      return {
        scopedApprovedCount: scoped.length,
        hasAnyGlobalApproved: false,
        lastSyncAt: scoped.reduce((m, t) => Math.max(m, t.lastSyncedAt), 0),
        tokenStatus: pn?.tokenStatus ?? "connected",
        lastAuthErrorMessage: pn?.tokenStatus === "auth_failed" ? "Token requires reconnect" : undefined,
      };
    }
    case "templates.getByName": {
      const phoneId = args?.phoneNumberId;
      const tpl = templates.find((t) => t.name === args?.name && (!phoneId || t.phoneNumberId === phoneId));
      return tpl ? withTemplateComponents(tpl) : null;
    }
    case "templateStore.list": {
      const tag = args?.tag;
      const category = args?.category;
      return templateStore.filter((item) => {
        if (tag && !(item.tags || []).includes(tag)) return false;
        if (category && item.category !== category) return false;
        return true;
      });
    }
    case "templateStore.get":
      return templateStore.find((t) => t._id === String(args?.id)) ?? null;
    case "salla.getConnection":
      return {
        connected: true,
        status: "connected",
        tokenSource: "db",
        storeName: "Demo Store",
      };
    case "webhookSettings.get":
      return { ...webhookSettings };
    case "agents.list":
      return [...agents];
    case "agents.getByPhoneNumberId":
      return agents.find((a) => a.phoneNumberId === String(args?.phoneNumberId)) ?? null;
    case "workflows.list": {
      const phoneId = args?.phoneNumberId;
      const data = phoneId ? workflows.filter((w) => w.phoneNumberId === phoneId) : workflows;
      return [...data].sort((a, b) => b.updatedAt - a.updatedAt);
    }
    case "files.list":
      return [...files];
    case "manualCatalog.listCategories": {
      const phoneId = String(args?.phoneNumberId ?? "");
      const search = String(args?.search ?? "").trim();
      return categories
        .filter((c) => c.phoneNumberId === phoneId)
        .filter((c) => (args?.includeInactive ? true : c.isActive))
        .filter((c) => (search ? c.name.includes(search) : true))
        .map((c) => ({ ...c, productsCount: manualProducts.filter((p) => p.categoryId === c._id).length }));
    }
    case "manualCatalog.listManualProducts": {
      const phoneId = String(args?.phoneNumberId ?? "");
      const search = String(args?.search ?? "").trim().toLowerCase();
      const categoryId = args?.categoryId ? String(args.categoryId) : undefined;
      const page = Math.max(1, Number(args?.page ?? 1));
      const pageSize = Math.max(1, Number(args?.pageSize ?? 12));
      const filtered = manualProducts
        .filter((p) => p.phoneNumberId === phoneId)
        .filter((p) => (categoryId ? p.categoryId === categoryId : true))
        .filter((p) =>
          search
            ? `${p.title} ${p.description} ${p.categoryNameSnapshot ?? ""}`.toLowerCase().includes(search)
            : true
        )
        .sort((a, b) => b.updatedAt - a.updatedAt);
      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const start = (page - 1) * pageSize;
      return {
        items: filtered.slice(start, start + pageSize),
        page,
        pageSize,
        total,
        totalPages,
      };
    }
    case "system.getRuntimeDeploymentInfo":
      return {
        deploymentUrl: process.env.NEXT_PUBLIC_CONVEX_URL || "static-ui",
        deployment: "static-ui",
        buildMarker: "admin-dashboard-static",
      };
    default:
      if (path.endsWith(".list")) return [];
      return undefined;
  }
}

async function createTemplateFromPayload(args: any): Promise<string> {
  const id = nextId("tpl");
  const language = String(args?.language || "ar");
  const name = String(args?.name || `template_${id}`);
  templates.unshift({
    _id: id,
    name,
    language,
    status: "PENDING",
    category: String(args?.category || "MARKETING"),
    phoneNumberId: args?.phoneNumberId ?? phoneNumbers[0].businessNumberId,
    lastSyncedAt: Date.now(),
  });
  bump();
  return id;
}

function upsertAgentByPhoneNumberId(args: any): void {
  const phoneNumberId = String(args?.phoneNumberId ?? "");
  if (!phoneNumberId) return;
  const existing = agents.find((a) => a.phoneNumberId === phoneNumberId);
  if (existing) {
    Object.assign(existing, args);
  } else {
    agents.push({
      _id: nextId("agent"),
      phoneNumberId,
      isActive: args?.isActive ?? true,
      agentName: args?.agentName ?? "AI Agent",
      model: args?.model ?? "openai/gpt-4o-mini",
      recommendProducts: args?.recommendProducts ?? true,
      toolsEnabled: args?.toolsEnabled ?? true,
    });
  }
}

export async function resolveMutation(ref: any, args?: any): Promise<any> {
  const path = getPath(ref);

  switch (path) {
    case "auth.login":
    case "auth.register":
      return users[0]._id;

    case "campaigns.remove": {
      const id = String(args?._id || args?.id);
      const index = campaigns.findIndex((c) => c._id === id);
      if (index >= 0) campaigns.splice(index, 1);
      bump();
      return true;
    }
    case "campaigns.create": {
      const id = nextId("camp");
      const entry: CampaignCard = {
        _id: id,
        name: String(args?.name || "حملة جديدة"),
        status: "SCHEDULED",
        templateName: String(args?.template || args?.templateName || "hello_world"),
        templateLanguage: String(args?.templateLanguage || args?.language || "ar"),
        phoneNumberId: String(args?.phoneNumberId || phoneNumbers[0].businessNumberId),
        audienceCount: Array.isArray(args?.selectedContactIds) ? args.selectedContactIds.length : 1,
        sentCount: 0,
        failedCount: 0,
        skippedCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      campaigns.unshift(entry);
      bump();
      return id;
    }
    case "campaigns.createQuickScopedCampaign": {
      const phoneNumberId = String(args?.phoneNumberId || phoneNumbers[0].businessNumberId);
      const scoped = templates.find((t) => t.phoneNumberId === phoneNumberId && t.status === "APPROVED");
      if (!scoped) throw new Error("لا توجد قوالب معتمدة لهذا الرقم");
      return resolveMutation({ __path: "campaigns.create" }, {
        name: "Quick Campaign",
        templateName: scoped.name,
        templateLanguage: scoped.language,
        phoneNumberId,
        selectedContactIds: contacts.slice(0, 2).map((c) => c._id),
      });
    }

    case "notifications.markAsRead": {
      const n = notifications.find((x) => x._id === String(args?.id));
      if (n) n.read = true;
      bump();
      return true;
    }

    case "templateStore.seedDefaults":
      bump();
      return { seeded: templateStore.length, message: "تم تحميل القوالب الافتراضية" };

    case "templateStore.remove": {
      const id = String(args?.id);
      const idx = templateStore.findIndex((t) => t._id === id);
      if (idx >= 0) templateStore.splice(idx, 1);
      bump();
      return true;
    }

    case "templateStore.add": {
      const id = nextId("store");
      templateStore.unshift({
        _id: id,
        name: String(args?.name || "template"),
        description: String(args?.description || ""),
        category: String(args?.category || "MARKETING"),
        language: String(args?.language || "ar"),
        tags: Array.isArray(args?.tags) ? args.tags : [],
        components: args?.components || [{ type: "BODY", text: "Demo" }],
        formSnapshot: args?.formSnapshot,
      });
      bump();
      return id;
    }

    case "templates.syncFromMeta":
    case "templates.syncScopedFromMeta":
      bump();
      return { syncedCount: templates.length, scopedApprovedCount: templates.filter((t) => t.status === "APPROVED").length };

    case "templates.deleteTemplate": {
      const name = String(args?.name || "");
      const phoneId = args?.phoneNumberId ? String(args.phoneNumberId) : undefined;
      const idx = templates.findIndex((t) => t.name === name && (!phoneId || t.phoneNumberId === phoneId));
      if (idx >= 0) templates.splice(idx, 1);
      bump();
      return true;
    }

    case "templates.createTemplate":
      return createTemplateFromPayload(args);

    case "files.generateUploadUrl":
      return "/mock/upload";

    case "files.saveFile": {
      const id = nextId("file");
      const entry = {
        _id: id,
        name: String(args?.name || `file-${id}`),
        url: String(args?.url || "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?q=80&w=1200&auto=format&fit=crop"),
        createdAt: Date.now(),
      };
      files.unshift(entry);
      bump();
      return { storageId: id, url: entry.url };
    }

    case "files.saveExternalImage":
      return { storageId: nextId("file"), url: String(args?.url || "") };

    case "whatsapp.uploadTemplateMedia":
    case "whatsapp.uploadExternalTemplateMedia":
    case "whatsapp.uploadMedia":
      return `media_${Date.now()}`;

    case "whatsapp.testAccessToken":
      return { success: true, message: "Token valid" };

    case "salla.disconnect":
      return true;

    case "salla.fetchProducts":
      return {
        connected: true,
        tokenError: false,
        products: [
          {
            id: "salla_1",
            name: "ساعة ذكية",
            price: 299,
            currency: "SAR",
            inStock: true,
            image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=800&auto=format&fit=crop",
            url: "https://example.com/products/smart-watch",
          },
          {
            id: "salla_2",
            name: "سماعة لاسلكية",
            price: 199,
            currency: "SAR",
            inStock: true,
            image: "https://images.unsplash.com/photo-1545127398-14699f92334b?q=80&w=800&auto=format&fit=crop",
            url: "https://example.com/products/earbuds",
          },
        ],
        pagination: { page: 1, totalPages: 1 },
      };

    case "salla.getProduct":
      return {
        id: String(args?.id || "salla_1"),
        name: "ساعة ذكية",
        description: "ساعة ذكية ببطارية تدوم طويلاً",
        price: 299,
        currency: "SAR",
        inStock: true,
        image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=800&auto=format&fit=crop",
        images: [
          "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=800&auto=format&fit=crop",
          "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?q=80&w=800&auto=format&fit=crop",
        ],
      };

    case "contacts.create": {
      const id = nextId("contact");
      contacts.unshift({
        _id: id,
        name: String(args?.name || "عميل جديد"),
        phone: String(args?.phone || "0000000000"),
        tags: Array.isArray(args?.tags) ? args.tags : [],
        createdAt: Date.now(),
        lastInteractionAt: Date.now(),
      });
      bump();
      return id;
    }

    case "contacts.remove": {
      const id = String(args?.id || args?._id);
      const idx = contacts.findIndex((c) => c._id === id);
      if (idx >= 0) contacts.splice(idx, 1);
      bump();
      return true;
    }

    case "contacts.bulkCreate": {
      const rows = Array.isArray(args?.contacts) ? args.contacts : [];
      rows.forEach((row: any) => {
        contacts.push({
          _id: nextId("contact"),
          name: String(row?.name || "عميل"),
          phone: String(row?.phone || ""),
          tags: Array.isArray(row?.tags) ? row.tags : [],
          createdAt: Date.now(),
          lastInteractionAt: Date.now(),
        });
      });
      bump();
      return { inserted: rows.length };
    }

    case "workflows.create": {
      const id = nextId("wf");
      workflows.unshift({
        _id: id,
        name: String(args?.name || "Workflow"),
        triggerType: String(args?.triggerType || "new_chat"),
        actionType: String(args?.actionType || "send_template"),
        phoneNumberId: String(args?.phoneNumberId || phoneNumbers[0].businessNumberId),
        isActive: true,
        updatedAt: Date.now(),
        triggerConfig: args?.triggerConfig || {},
        actionConfig: args?.actionConfig || {},
      });
      bump();
      return id;
    }

    case "workflows.update": {
      const id = String(args?.id);
      const wf = workflows.find((w) => w._id === id);
      if (wf) Object.assign(wf, args, { updatedAt: Date.now() });
      bump();
      return true;
    }

    case "workflows.toggle": {
      const wf = workflows.find((w) => w._id === String(args?.id));
      if (wf) wf.isActive = Boolean(args?.isActive);
      bump();
      return true;
    }

    case "workflows.remove": {
      const idx = workflows.findIndex((w) => w._id === String(args?.id));
      if (idx >= 0) workflows.splice(idx, 1);
      bump();
      return true;
    }

    case "chat.sendMessage": {
      const id = nextId("msg");
      const chatId = String(args?.chatId || chats[0]._id);
      messages.push({
        _id: id,
        chatId,
        sender: "business",
        direction: "outbound",
        type: args?.type || "text",
        content: String(args?.content || "رسالة تجريبية"),
        createdAt: Date.now(),
        timestamp: Date.now(),
        status: "sent",
      });
      const chat = chats.find((c) => c._id === chatId);
      if (chat) {
        chat.lastMessage = String(args?.content || "رسالة تجريبية");
        chat.lastMessageAt = Date.now();
        chat.lastMessageTime = Date.now();
      }
      bump();
      return id;
    }

    case "chat.markAsRead": {
      const chat = chats.find((c) => c._id === String(args?.chatId));
      if (chat) chat.unreadCount = 0;
      bump();
      return true;
    }

    case "chat.setActiveChat":
    case "chat.clearActiveChat":
      return true;

    case "chat.toggleAiMode": {
      const chat = chats.find((c) => c._id === String(args?.chatId));
      if (chat) chat.aiMode = Boolean(args?.enabled);
      bump();
      return true;
    }

    case "ai_config.updateConfig": {
      const key = args?.phoneNumberId ? String(args.phoneNumberId) : "default";
      aiConfigs[key] = { ...(aiConfigs[key] ?? aiConfigs.default), ...args };
      bump();
      return true;
    }

    case "ai_config.setManualCatalogEnabled": {
      const key = String(args?.phoneNumberId || "default");
      aiConfigs[key] = { ...(aiConfigs[key] ?? aiConfigs.default), manualCatalogEnabled: Boolean(args?.enabled) };
      bump();
      return true;
    }

    case "agent.runTest":
      return "هذا رد تجريبي من وكيل الذكاء الاصطناعي في نسخة UI فقط.";

    case "agent.saveFeedback":
      return true;

    case "ai.saveKnowledge": {
      knowledgeBase.unshift({ _id: nextId("kb"), title: String(args?.title || "معرفة"), content: String(args?.content || "") });
      bump();
      return true;
    }

    case "webhookSettings.set":
      Object.assign(webhookSettings, args);
      bump();
      return true;

    case "whatsappNumbers.checkHealth":
      return { healthy: true, checked: phoneNumbers.length };

    case "whatsappNumbers.syncFromMeta":
      bump();
      return { added: 0, updated: phoneNumbers.length };

    case "whatsappNumbers.update": {
      const id = String(args?.id);
      const pn = phoneNumbers.find((n) => n._id === id);
      if (pn) Object.assign(pn, args);
      bump();
      return true;
    }

    case "whatsappNumbers.add": {
      phoneNumbers.push({
        _id: nextId("pn"),
        businessNumberId: String(args?.businessNumberId || `bn_${Date.now()}`),
        phone: String(args?.phone || ""),
        name: String(args?.name || "رقم جديد"),
        businessAccountId: String(args?.businessAccountId || "ba_new"),
        isActive: true,
        tokenStatus: "connected",
      });
      bump();
      return true;
    }

    case "agents.upsertByPhoneNumberId":
      upsertAgentByPhoneNumberId(args);
      bump();
      return true;

    case "agents.toggleByPhoneNumberId": {
      const agent = agents.find((a) => a.phoneNumberId === String(args?.phoneNumberId));
      if (agent) agent.isActive = Boolean(args?.isActive);
      bump();
      return true;
    }

    case "users.updateRole": {
      const user = users.find((u) => u._id === String(args?.userId));
      if (user) user.role = args?.role;
      bump();
      return true;
    }

    case "manualCatalog.createCategory": {
      const id = nextId("cat");
      categories.unshift({
        _id: id,
        phoneNumberId: String(args?.phoneNumberId),
        name: String(args?.name || "تصنيف"),
        slug: String(args?.name || "category").toLowerCase().replace(/\s+/g, "-"),
        description: args?.description ? String(args.description) : undefined,
        source: "manual",
        isActive: true,
        productsCount: 0,
        updatedAt: Date.now(),
      });
      bump();
      return id;
    }

    case "manualCatalog.updateCategory": {
      const c = categories.find((x) => x._id === String(args?.categoryId));
      if (c) {
        Object.assign(c, {
          name: args?.name ?? c.name,
          description: args?.description ?? c.description,
          isActive: args?.isActive ?? c.isActive,
          updatedAt: Date.now(),
        });
      }
      bump();
      return true;
    }

    case "manualCatalog.deleteCategory": {
      const id = String(args?.categoryId);
      const idx = categories.findIndex((c) => c._id === id);
      if (idx >= 0) categories.splice(idx, 1);
      manualProducts.forEach((p) => {
        if (p.categoryId === id) {
          p.categoryId = undefined;
          p.categoryNameSnapshot = "Uncategorized";
        }
      });
      bump();
      return true;
    }

    case "manualCatalog.createManualProduct": {
      const id = nextId("mp");
      const categoryId = args?.categoryId ? String(args.categoryId) : undefined;
      const category = categoryId ? categories.find((c) => c._id === categoryId) : undefined;
      manualProducts.unshift({
        _id: id,
        phoneNumberId: String(args?.phoneNumberId),
        title: String(args?.title || "منتج جديد"),
        description: String(args?.description || ""),
        images: Array.isArray(args?.images) ? args.images : [],
        categoryId,
        categoryNameSnapshot: category?.name,
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        aiAdvice: "نسخة UI فقط",
        aiSummary: "وصف مختصر",
        aiKeywords: ["demo"],
      });
      bump();
      return id;
    }

    case "manualCatalog.updateManualProduct": {
      const p = manualProducts.find((x) => x._id === String(args?.id));
      if (p) {
        Object.assign(p, {
          title: args?.title ?? p.title,
          description: args?.description ?? p.description,
          images: Array.isArray(args?.images) ? args.images : p.images,
          categoryId: args?.categoryId ?? p.categoryId,
          isActive: args?.isActive ?? p.isActive,
          updatedAt: Date.now(),
        });
        if (p.categoryId) {
          p.categoryNameSnapshot = categories.find((c) => c._id === p.categoryId)?.name;
        }
      }
      bump();
      return true;
    }

    case "manualCatalog.deleteManualProduct": {
      const idx = manualProducts.findIndex((p) => p._id === String(args?.id));
      if (idx >= 0) manualProducts.splice(idx, 1);
      bump();
      return true;
    }

    default:
      return true;
  }
}

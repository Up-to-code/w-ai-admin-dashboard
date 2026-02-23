export type CampaignCard = {
  _id: string;
  name: string;
  status: "DRAFT" | "SCHEDULED" | "PROCESSING" | "COMPLETED" | "FAILED";
  templateName: string;
  templateLanguage?: string;
  phoneNumberId: string;
  audienceCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  createdAt: number;
  updatedAt: number;
};

export type CampaignLogRow = {
  _id: string;
  campaignId: string;
  contactId: string;
  phone: string;
  contactName: string;
  status: "sent" | "failed" | "skipped";
  messageId?: string;
  error?: string;
  skipReason?: string;
  createdAt: number;
};

export type ChatThread = {
  _id: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  phoneNumberId: string;
  lastMessage: string;
  lastMessageAt: number;
  unreadCount: number;
  aiMode: boolean;
};

export type ChatMessage = {
  _id: string;
  chatId: string;
  sender: "user" | "business";
  type: "text" | "image" | "audio";
  content: string;
  createdAt: number;
};

export type CustomerRow = {
  _id: string;
  name: string;
  phone: string;
  tags: string[];
  createdAt: number;
  lastInteractionAt?: number;
};

export type ProductCard = {
  _id: string;
  title: string;
  description: string;
  categoryId?: string;
  categoryNameSnapshot?: string;
  images: Array<{ storageId?: string; url: string; alt?: string; order: number }>;
  isActive: boolean;
  updatedAt: number;
};

export type CategoryRow = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  source: "ai" | "manual";
  isActive: boolean;
  productsCount: number;
  updatedAt: number;
};

export type TemplateItem = {
  _id: string;
  name: string;
  language: string;
  status: "APPROVED" | "PENDING" | "REJECTED";
  category?: string;
  phoneNumberId?: string | null;
  lastSyncedAt: number;
};

export type WorkflowRule = {
  _id: string;
  name: string;
  triggerType: string;
  actionType: string;
  phoneNumberId: string;
  isActive: boolean;
  updatedAt: number;
};

export type IntegrationStatus = {
  connected: boolean;
  tokenError?: boolean;
  status?: "connected" | "disconnected" | "token_invalid" | "refresh_failed" | "auth_failed";
  errorMessage?: string;
};

export type SettingToggle = {
  key: string;
  label: string;
  enabled: boolean;
};

export type MockTokenStatus = "connected" | "auth_failed";

export interface MockPhoneNumber {
  _id: string;
  businessNumberId: string;
  phone: string;
  name: string;
  businessAccountId: string;
  isActive?: boolean;
  tokenStatus?: MockTokenStatus;
}

export interface MockTemplate {
  _id: string;
  name: string;
  language: string;
  status: "APPROVED" | "PENDING" | "REJECTED";
  category: string;
  phoneNumberId: string;
  lastSyncedAt: number;
}

export interface MockCampaign {
  _id: string;
  name: string;
  status: "DRAFT" | "SCHEDULED" | "PROCESSING" | "COMPLETED" | "FAILED";
  templateName: string;
  templateLanguage: string;
  phoneNumberId: string;
  audienceCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface MockManualCategory {
  _id: string;
  phoneNumberId: string;
  name: string;
  slug: string;
  description?: string;
  source: "manual" | "ai";
  isActive: boolean;
  productsCount: number;
  updatedAt: number;
}

export interface MockManualProductImage {
  url: string;
  order: number;
  alt?: string;
  storageId?: string;
}

export interface MockManualProduct {
  _id: string;
  phoneNumberId: string;
  title: string;
  description: string;
  images: MockManualProductImage[];
  categoryId?: string;
  categoryNameSnapshot?: string;
  aiAdvice?: string;
  aiSummary?: string;
  aiKeywords?: string[];
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MockSchema {
  phoneNumbers: MockPhoneNumber[];
  templates: MockTemplate[];
  campaigns: MockCampaign[];
  manualCategories: MockManualCategory[];
  manualProducts: MockManualProduct[];
}

import { anyApi } from "convex/server";

const rawApi: any = anyApi;
// Safety default: keep production on stable core namespace unless explicitly
// enabled with two flags to avoid accidental "function not found" crashes.
const useAdminNamespace =
  process.env.NEXT_PUBLIC_ADMIN_NAMESPACE === "1" &&
  process.env.NEXT_PUBLIC_ADMIN_NAMESPACE_STRICT === "1";

function pickModule(adminModule: string, coreModule: string): any {
  return useAdminNamespace ? rawApi[adminModule] : rawApi[coreModule];
}

export const api: any = {
  auth: pickModule("admin_auth", "auth"),
  stats: pickModule("admin_stats", "stats"),
  whatsappNumbers: pickModule("admin_whatsappNumbers", "whatsappNumbers"),
  users: pickModule("admin_users", "users"),
  contacts: pickModule("admin_contacts", "contacts"),
  chat: pickModule("admin_chat", "chat"),
  notifications: pickModule("admin_notifications", "notifications"),
  campaigns: pickModule("admin_campaigns", "campaigns"),
  templates: pickModule("admin_templates", "templates"),
  templateStore: pickModule("admin_templateStore", "templateStore"),
  ai_config: pickModule("admin_ai_config", "ai_config"),
  ai: pickModule("admin_ai", "ai"),
  agent: pickModule("admin_agent", "agent"),
  agents: pickModule("admin_agents", "agents"),
  workflows: pickModule("admin_workflows", "workflows"),
  files: pickModule("admin_files", "files"),
  salla: pickModule("admin_salla", "salla"),
  webhookSettings: pickModule("admin_webhookSettings", "webhookSettings"),
  manualCatalog: pickModule("admin_manualCatalog", "manualCatalog"),
  system: pickModule("admin_system", "system"),
  whatsapp: pickModule("admin_whatsapp", "whatsapp"),
  notificationPreferences: pickModule("admin_notificationPreferences", "notificationPreferences"),
  admin_seed: rawApi.admin_seed,
};

export const internal: any = rawApi;
export const internalApi: any = internal;

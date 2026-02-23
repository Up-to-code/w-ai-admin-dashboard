import { action, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { categorizeWhatsAppError, validateAndCleanPhoneNumber, createErrorReport } from "./errorUtils";
import { extractWebhookChanges, resolvePhoneNumberCandidate } from "./webhookUtils";
import { logDebug, logInfoSampled, logWarn, logError } from "./logging";

const WHATSAPP_API_URL = "https://graph.facebook.com/v21.0";

export type WhatsAppConfig = {
  accessToken: string;
  phoneId: string;
  wabaId?: string;
  source: "db_number" | "db_first_with_token" | "env_fallback" | "webhook_fallback";
};

type TypedWhatsAppError = Error & {
  code?: number;
  category?: string;
  retryable?: boolean;
};

async function withAppSecretProof(ctx: any, url: string, accessToken: string): Promise<string> {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret?.trim()) return url;
  const appsecret_proof = await ctx.runAction(internal.nodeUtils.createAppSecretProof, {
    accessToken,
    appSecret,
  });
  const parsed = new URL(url);
  parsed.searchParams.set("appsecret_proof", appsecret_proof);
  return parsed.toString();
}

function normalizeToken(token: string | null | undefined): string | null {
  const t = token?.trim();
  return t && t.length > 0 ? t : null;
}

function normalizeTemplateLanguageKey(value: unknown): string {
  if (typeof value === "string") {
    return value.trim().toLowerCase().replace("-", "_");
  }
  if (value && typeof value === "object" && typeof (value as { code?: unknown }).code === "string") {
    return ((value as { code: string }).code || "").trim().toLowerCase().replace("-", "_");
  }
  return "";
}

function extractTemplateBodyContent(components: unknown): string | undefined {
  if (!Array.isArray(components)) return undefined;
  const body = components.find((component) => (component as { type?: string })?.type === "BODY") as
    | { text?: string }
    | undefined;
  if (typeof body?.text === "string") {
    const text = body.text.trim();
    return text.length > 0 ? text : undefined;
  }
  return undefined;
}

function makeTypedWhatsAppError(
  message: string,
  code: number,
  category: string,
  retryable: boolean
): TypedWhatsAppError {
  const error = new Error(message) as TypedWhatsAppError;
  Object.defineProperty(error, "code", {
    value: code,
    enumerable: true,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(error, "category", {
    value: category,
    enumerable: true,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(error, "retryable", {
    value: retryable,
    enumerable: true,
    writable: true,
    configurable: true,
  });
  return error;
}

async function markNumberAuthFailureSafe(
  ctx: any,
  businessNumberId: string | undefined,
  code: number,
  message: string
): Promise<void> {
  if (!businessNumberId) return;
  try {
    await ctx.runMutation(internal.whatsappNumbers.markAuthFailure, {
      businessNumberId,
      code,
      message: message.slice(0, 1000),
    });
  } catch (error) {
    logWarn("[WhatsApp] Failed to persist auth failure status", {
      businessNumberId,
      code,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function markNumberAuthHealthySafe(ctx: any, businessNumberId: string | undefined): Promise<void> {
  if (!businessNumberId) return;
  try {
    await ctx.runMutation(internal.whatsappNumbers.markAuthHealthy, {
      businessNumberId,
    });
  } catch (error) {
    logWarn("[WhatsApp] Failed to clear auth failure status", {
      businessNumberId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function getWhatsAppConfig(ctx: any, phoneNumberId: string | undefined): Promise<WhatsAppConfig> {
  if (phoneNumberId) {
    const config = await ctx.runQuery(internal.whatsappNumbers.getByBusinessNumberId, { businessNumberId: phoneNumberId });
    if (config) {
      const accessToken = normalizeToken(config.accessToken);
      const phoneId = config.businessNumberId?.trim();
      if (!accessToken) {
        throw new Error(`Number "${config.name ?? phoneNumberId}" has no access token. Set it in Integrations (ربط المتجر).`);
      }
      if (!phoneId) {
        throw new Error(`Number ${phoneNumberId} has invalid configuration. Check Integrations (ربط المتجر).`);
      }
      if (config.tokenStatus === "auth_failed") {
        throw new Error(
          `Number "${config.name ?? phoneNumberId}" authentication is blocked (Meta OAuth error ${config.lastAuthErrorCode ?? 190}). Reconnect this number in Integrations before syncing or sending templates.`
        );
      }
      return { accessToken, phoneId, wabaId: config.businessAccountId, source: "db_number" };
    } else {
      throw new Error(`Number ${phoneNumberId} is not configured. Add it in Integrations (ربط المتجر) and set its access token.`);
    }
  }
  // Default: first number with token from DB, then env, then webhook settings
  const first = await ctx.runQuery(internal.whatsappNumbers.getFirstWithToken, {});
  const firstToken = normalizeToken(first?.accessToken);
  if (firstToken && first?.businessNumberId?.trim()) {
    if (first.tokenStatus === "auth_failed") {
      throw new Error(
        `Default number "${first.name ?? first.businessNumberId}" authentication is blocked (Meta OAuth error ${first.lastAuthErrorCode ?? 190}). Reconnect this number in Integrations.`
      );
    }
    logInfoSampled(`[WhatsApp Config] Using first number with token: ${first.name ?? first.businessNumberId}`);
    return {
      accessToken: firstToken,
      phoneId: first.businessNumberId,
      wabaId: first.businessAccountId,
      source: "db_first_with_token",
    };
  }
  const accessToken = normalizeToken(process.env.WHATSAPP_ACCESS_TOKEN);
  const phoneId = (process.env.WHATSAPP_PHONE_ID ?? "").trim();
  const wabaId = (process.env.WHATSAPP_WABA_ID ?? "").trim();
  if (accessToken && phoneId) {
    logInfoSampled(`[WhatsApp Config] Using env fallback: WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_ID`);
    return { accessToken, phoneId, wabaId, source: "env_fallback" };
  }
  const webhook = await ctx.runQuery(internal.webhookSettings.getForConfig, {});
  const fallbackToken = normalizeToken(webhook?.accessToken ?? undefined);
  const fallbackPhoneId = webhook?.defaultPhoneNumberId?.trim() || (process.env.WHATSAPP_PHONE_ID ?? "").trim();
  const fallbackWabaId = (process.env.WHATSAPP_WABA_ID ?? "").trim();
  if (fallbackToken && fallbackPhoneId) {
    logInfoSampled(`[WhatsApp Config] Using webhook settings fallback: defaultPhoneNumberId=${fallbackPhoneId}`);
    return { accessToken: fallbackToken, phoneId: fallbackPhoneId, wabaId: fallbackWabaId, source: "webhook_fallback" };
  }
  throw new Error(
    "Missing WhatsApp config. Add an access token: go to Integrations (ربط المتجر), add a number and set its Access Token, or set Access Token and Default Phone Number in Webhook settings, or set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_ID in the environment."
  );
}

async function resolveInboundPhoneNumberId(ctx: any, candidate?: string): Promise<{ phoneNumberId?: string; usedFallback: boolean }> {
  const webhook = await ctx.runQuery(internal.webhookSettings.getForConfig, {});
  const firstWithToken = await ctx.runQuery(internal.whatsappNumbers.getFirstWithToken, {});
  return resolvePhoneNumberCandidate(candidate, webhook?.defaultPhoneNumberId, firstWithToken?.businessNumberId);
}

// --- Actions (External API Calls) ---

export const sendMessage = action({
  args: {
    to: v.string(),
    type: v.string(), // text, image, template, etc.
    content: v.any(), // Structure depends on type
    messageId: v.optional(v.id("messages")), // internal DB ID
    phoneNumberId: v.optional(v.string()), // Meta phone_number_id; when set, use that number's config
  },
  handler: async (ctx, args) => {
    if (args.type === "template" && !args.phoneNumberId) {
      throw new Error("Template sends require an explicit phoneNumberId. Select a sending number for the campaign/chat/workflow.");
    }
    const { accessToken, phoneId, source } = await getWhatsAppConfig(ctx, args.phoneNumberId);

    // Validate and clean phone number
    let recipient: string;
    try {
      recipient = validateAndCleanPhoneNumber(args.to);
    } catch (err) {
      const error = err as Error;
      logError("[WhatsApp] Phone number validation failed:", error.message);
      throw error;
    }

    logInfoSampled(`[WhatsApp] Preparing to send to cleaned recipient: ${recipient} (original was ${args.to})`);
    logInfoSampled("[WhatsApp] Config resolved", {
      selectedPhoneNumberId: args.phoneNumberId ?? null,
      resolvedPhoneId: phoneId,
      source,
      type: args.type,
    });

    const payload: any = {
      messaging_product: "whatsapp",
      to: recipient,
      type: args.type,
      [args.type]: args.content,
    };

    logInfoSampled(`[WhatsApp] Sending payload to ${recipient} via ${WHATSAPP_API_URL}/${phoneId}/messages`);
    if (process.env.NODE_ENV !== "production") {
      logDebug(`[WhatsApp] Payload:`, JSON.stringify(payload, null, 2));
    }

    try {
      const sendUrl = await withAppSecretProof(ctx, `${WHATSAPP_API_URL}/${phoneId}/messages`, accessToken);
      const response = await fetch(sendUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      logInfoSampled(`[WhatsApp] Meta API Response Status: ${response.status} ${response.statusText}`);
      const data = await response.json();

      if (!response.ok) {
        const errorCode = data.error?.code ?? response.status;
        const errorMessage = data.error?.message ?? "Unknown error";

        const errorCategory = categorizeWhatsAppError(errorCode, errorMessage);
        if (errorCategory.category === "AUTH_ERROR" || errorCode === 190 || response.status === 401 || response.status === 403) {
          await markNumberAuthFailureSafe(ctx, args.phoneNumberId ?? phoneId, errorCode, errorMessage);
        }
        const suggestedAction = errorCategory.suggestedAction ?? "Review error message and retry";
        const userMessage =
          suggestedAction && !errorMessage.includes(suggestedAction)
            ? `${errorMessage} — ${suggestedAction}`
            : errorMessage;

        logError(
          `[WhatsApp] API Error (${errorCategory.category}):`,
          JSON.stringify(data),
          `Retryable: ${errorCategory.retryable}`
        );

        // Create structured error report with preserved classification fields.
        const reportError = new Error(errorMessage) as Error & {
          code?: number;
          category?: string;
          retryable?: boolean;
        };
        reportError.code = errorCode;
        reportError.category = errorCategory.category;
        reportError.retryable = errorCategory.retryable;
        const errorReport = createErrorReport(reportError, {
          contact: args.to,
          phone: recipient,
          details: data.error?.error_data?.details,
          fbtraceId: data.error?.fbtrace_id,
          templateName: (args.content as any)?.name,
          languageCode: (args.content as any)?.language?.code,
        });
        logError("[WhatsApp] Error Report:", JSON.stringify(errorReport, null, 2));

        throw makeTypedWhatsAppError(
          userMessage,
          errorCode,
          errorCategory.category,
          errorCategory.retryable
        );
      }

      await markNumberAuthHealthySafe(ctx, args.phoneNumberId ?? phoneId);
      logInfoSampled("[WhatsApp] Send Success:", JSON.stringify(data));

      // Link Meta ID to Internal Message
      if (args.messageId && data.messages?.[0]?.id) {
        const wamid = data.messages[0].id;
        await ctx.runMutation((internal as any).chat.updateMessageMetaId, {
          messageId: args.messageId,
          metaMessageId: wamid,
        });
        logInfoSampled(`[WhatsApp] Linked local msg ${args.messageId} to wamid ${wamid}`);
      }

      return data;
    } catch (error) {
      // Log structured error info
      const err = error as Error & { code?: number; category?: string; retryable?: boolean };
      logError("[WhatsApp] Exception during send:", {
        message: err.message,
        code: err.code,
        category: err.category,
        retryable: err.retryable,
        stack: err.stack,
      });
      throw error;
    }
  },
});

export const createTemplate = action({
  args: {
    name: v.string(),
    language: v.string(),
    category: v.string(),
    components: v.any(), // Array of components
    phoneNumberId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const config = await getWhatsAppConfig(ctx, args.phoneNumberId);
    const { accessToken, wabaId } = config;
    if (!wabaId) {
      throw new Error(
        "Missing WABA ID. Set a number with access token in Integrations, or set WHATSAPP_WABA_ID in the environment."
      );
    }

    const payload = {
      name: args.name,
      category: args.category,
      allow_category_change: true,
      language: args.language,
      components: args.components,
    };

    logDebug("Creating Template Payload:", JSON.stringify(payload, null, 2));

    const createTemplateUrl = await withAppSecretProof(ctx, `${WHATSAPP_API_URL}/${wabaId}/message_templates`, accessToken);
    const response = await fetch(createTemplateUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      logError("WhatsApp Template Creation Error:", data);
      const err = data?.error;
      const msg = err?.message ?? "Unknown error";
      const code = err?.code;
      // Meta template creation errors: 100 = duplicate, 131047 = invalid param/format, etc.
      if (code === 100 || (typeof msg === "string" && (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("already exists")))) {
        throw new Error(`Template name "${args.name}" with language "${args.language}" already exists in your WABA. Use a different name or language, or sync templates to see existing ones.`);
      }
      if (code === 131047 || (typeof msg === "string" && msg.toLowerCase().includes("parameter") && msg.toLowerCase().includes("format"))) {
        throw new Error(`Invalid template format: ${msg}. Check header, body, and button components.`);
      }
      if (typeof msg === "string" && msg.toLowerCase().includes("permission")) {
        throw new Error(`Permission denied. Ensure the number is connected in Integrations and has WhatsApp Business Management permission. ${msg}`);
      }
      throw new Error(`WhatsApp API Error: ${msg}`);
    }

    // Upsert into local DB
    await ctx.runMutation((internal as any).templates.upsert, {
      phoneNumberId: args.phoneNumberId,
      name: args.name,
      language: args.language,
      category: args.category,
      status: "PENDING", // Initial status from Meta is usually PENDING or APPROVED depending on cat
      content: extractTemplateBodyContent(args.components),
      components: args.components,
      metaTemplateId: data.id,
    });

    return data;
  },
});

export const fetchTemplates = action({
  args: {
    phoneNumberId: v.optional(v.string()), // When set, use this number's token and WABA from DB; else first number with token or env
  },
  handler: async (ctx, args) => {
    const config = await getWhatsAppConfig(ctx, args.phoneNumberId);
    const { accessToken, wabaId, phoneId } = config;
    if (!wabaId) {
      throw new Error(
        "Missing WhatsApp config: set a number with access token in Integrations, or set WHATSAPP_ACCESS_TOKEN and WHATSAPP_WABA_ID in the environment."
      );
    }

    const fetchTemplatesUrl = await withAppSecretProof(
      ctx,
      `${WHATSAPP_API_URL}/${wabaId}/message_templates?limit=100`,
      accessToken
    );
    const response = await fetch(fetchTemplatesUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      logError("WhatsApp Fetch Templates Error:", data);
      const err = data.error;
      const code = err?.code;
      const message = err?.message ?? "Unknown error";
      const subcode = err?.error_subcode;
      const normalizedCode = code ?? response.status;
      const categorized = categorizeWhatsAppError(normalizedCode, message);
      if (categorized.category === "AUTH_ERROR" || normalizedCode === 190 || response.status === 401 || response.status === 403) {
        await markNumberAuthFailureSafe(ctx, args.phoneNumberId ?? phoneId, normalizedCode, message);
      }

      const suggestedAction = categorized.suggestedAction ?? "Review error message and retry";
      const fallbackMessage =
        suggestedAction && !message.includes(suggestedAction)
          ? `${message} — ${suggestedAction}`
          : message;
      if (code === 100 || subcode === 33) {
        throw makeTypedWhatsAppError(
          "Cannot load templates: the WhatsApp Business Account ID may be wrong or the access token does not have permission. In Integrations, ensure the number's Business Account ID is the WABA ID (from Meta Business Suite), not the Phone Number ID. Also check your Meta app has the whatsapp_business_management permission."
          ,
          normalizedCode,
          categorized.category,
          categorized.retryable
        );
      }
      throw makeTypedWhatsAppError(
        fallbackMessage,
        normalizedCode,
        categorized.category,
        categorized.retryable
      );
    }

    await markNumberAuthHealthySafe(ctx, args.phoneNumberId ?? phoneId);
    const templatesList = (data.data || []) as Array<{ name: string; language?: string; components?: any[] }>;

    // Enrich each template with full component structure from single-template fetch.
    // The list endpoint may return empty or truncated components; fetching by name returns full structure.
    const uniqueNames: string[] = [...new Set(templatesList.map((t) => t.name))];
    const componentsByKey = new Map<string, any[]>(); // key: "name|language" -> components

    for (const name of uniqueNames) {
      try {
        const url = await withAppSecretProof(
          ctx,
          `${WHATSAPP_API_URL}/${wabaId}/message_templates?name=${encodeURIComponent(String(name))}`,
          accessToken
        );
        const detailRes = await fetch(url, {
          method: "GET",
          headers: { "Authorization": `Bearer ${accessToken}` },
        });
        const detailData = await detailRes.json();
        const fullTemplates = detailData.data || [];
        for (const ft of fullTemplates) {
          if (ft.name && ft.components && Array.isArray(ft.components) && ft.components.length > 0) {
            const key = `${ft.name}|${normalizeTemplateLanguageKey(ft.language)}`;
            componentsByKey.set(key, ft.components);
          }
        }
      } catch (err) {
        logWarn(`[WhatsApp] Failed to fetch full components for template "${name}":`, err);
      }
    }

    // Merge full components into list items when available
    const enriched = templatesList.map((t) => {
      const key = `${t.name}|${normalizeTemplateLanguageKey(t.language)}`;
      const fullComponents = componentsByKey.get(key);
      if (fullComponents) {
        return { ...t, components: fullComponents };
      }
      return t;
    });

    return enriched;
  },
});

export const markAsRead = action({
  args: {
    messageId: v.string(),
    phoneNumberId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { accessToken, phoneId } = await getWhatsAppConfig(ctx, args.phoneNumberId);

    try {
      const markReadUrl = await withAppSecretProof(ctx, `https://graph.facebook.com/v21.0/${phoneId}/messages`, accessToken);
      await fetch(markReadUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          status: "read",
          message_id: args.messageId,
        }),
      });
    } catch (error) {
      logError("Failed to mark message as read:", error);
    }
  },
});

export const getTemplate = action({
  args: {
    name: v.string(),
    phoneNumberId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const config = await getWhatsAppConfig(ctx, args.phoneNumberId);
    const { accessToken, wabaId } = config;
    if (!wabaId) {
      throw new Error(
        "Missing WABA ID. Set a number with access token in Integrations, or set WHATSAPP_WABA_ID in the environment."
      );
    }

    const getTemplateUrl = await withAppSecretProof(
      ctx,
      `${WHATSAPP_API_URL}/${wabaId}/message_templates?name=${args.name}`,
      accessToken
    );
    const response = await fetch(getTemplateUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      logError("WhatsApp Get Template Error:", data);
      throw new Error(`WhatsApp API Error: ${data.error?.message || "Unknown error"}`);
    }

    return data.data?.[0] || null;
  },
});

export const deleteTemplate = action({
  args: {
    name: v.string(),
    phoneNumberId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const config = await getWhatsAppConfig(ctx, args.phoneNumberId);
    const { accessToken, wabaId } = config;
    if (!wabaId) {
      throw new Error(
        "Missing WABA ID. Set a number with access token in Integrations, or set WHATSAPP_WABA_ID in the environment."
      );
    }

    const deleteTemplateUrl = await withAppSecretProof(
      ctx,
      `${WHATSAPP_API_URL}/${wabaId}/message_templates?name=${args.name}`,
      accessToken
    );
    const response = await fetch(deleteTemplateUrl, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      logError("WhatsApp Delete Template Error:", data);
      throw new Error(`WhatsApp API Error: ${data.error?.message || "Unknown error"}`);
    }

    return data;
  },
});


export const uploadMedia = action({
  args: {
    storageId: v.string(),
    type: v.string(), // image/jpeg, etc.
    phoneNumberId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { accessToken, phoneId } = await getWhatsAppConfig(ctx, args.phoneNumberId);

    // 1. Get File URL from Convex
    const fileUrl = await ctx.storage.getUrl(args.storageId);
    if (!fileUrl) throw new Error("File not found");

    // 2. Fetch the file content
    const fileRes = await fetch(fileUrl);
    const blob = await fileRes.blob();

    // 3. Prepare Form Data
    const formData = new FormData();
    formData.append("file", blob);
    formData.append("type", args.type);
    formData.append("messaging_product", "whatsapp");

    // 4. Upload to Meta
    const uploadUrl = await withAppSecretProof(ctx, `${WHATSAPP_API_URL}/${phoneId}/media`, accessToken);
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Authorization": `Bearer ${accessToken}` },
      body: formData
    });

    const data = await response.json();
    if (!response.ok) {
      logError("Media Upload Error:", data);

      // Handle specific error codes
      const errorCode = data.error?.code;
      const errorMessage = data.error?.message || "Upload failed";

      if (errorCode === 190) {
        await markNumberAuthFailureSafe(
          ctx,
          args.phoneNumberId ?? phoneId,
          190,
          errorMessage
        );
        // Authentication Error (OAuthException)
        const error = new Error(
          "WhatsApp API Authentication Error: Invalid or expired access token. Update the access token on the number in Integrations (ربط المتجر), or set WHATSAPP_ACCESS_TOKEN in the environment."
        ) as Error & { code?: number; category?: string };
        error.code = 190;
        error.category = "AUTH_ERROR";
        logError("[WhatsApp] Authentication failed - check access token (Integrations or env)");
        throw error;
      } else if (errorCode === 131047) {
        // Media type not supported
        const error = new Error(`Media type not supported: ${args.type}`) as Error & { code?: number; category?: string };
        error.code = 131047;
        error.category = "MEDIA_TYPE_ERROR";
        throw error;
      } else if (errorCode === 131026) {
        // File too large
        const error = new Error("File size exceeds WhatsApp limits (16MB for images, 16MB for videos)") as Error & { code?: number; category?: string };
        error.code = 131026;
        error.category = "FILE_SIZE_ERROR";
        throw error;
      }

      // Generic error with code
      const error = new Error(errorMessage) as Error & { code?: number; category?: string };
      if (errorCode) {
        error.code = errorCode;
        error.category = "UPLOAD_ERROR";
      }
      throw error;
    }

    await markNumberAuthHealthySafe(ctx, args.phoneNumberId ?? phoneId);
    return data.id; // Meta Media ID
  }
});

/**
 * Upload media from an external URL and get a WhatsApp Media ID.
 * This is used for sending carousel templates where we need fresh media IDs.
 * The returned media ID is valid for 30 days and can be used in send requests.
 */
export const uploadMediaFromUrl = action({
  args: {
    url: v.string(),      // External URL to the image/video
    type: v.string(),     // "image" or "video"
    mimeType: v.optional(v.string()), // Optional: specific mime type like "image/jpeg"
    phoneNumberId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { accessToken, phoneId } = await getWhatsAppConfig(ctx, args.phoneNumberId);

    logDebug(`[uploadMediaFromUrl] Fetching media from: ${args.url.substring(0, 80)}...`);

    // 1. Fetch the file from external URL
    const fileRes = await fetch(args.url);
    if (!fileRes.ok) {
      logError(`[uploadMediaFromUrl] Failed to fetch: ${fileRes.status} ${fileRes.statusText}`);
      throw new Error(`Failed to fetch media from URL: ${fileRes.status} ${fileRes.statusText}`);
    }

    const blob = await fileRes.blob();
    const contentType = args.mimeType ||
      fileRes.headers.get("content-type") ||
      (args.type === "video" ? "video/mp4" : "image/jpeg");

    logDebug(`[uploadMediaFromUrl] Uploading ${contentType}, size: ${blob.size} bytes`);

    // 2. Prepare Form Data for WhatsApp Media API
    const formData = new FormData();
    formData.append("file", blob, `media.${args.type === "video" ? "mp4" : "jpg"}`);
    formData.append("type", contentType);
    formData.append("messaging_product", "whatsapp");

    // 3. Upload to WhatsApp Media API
    const uploadUrl = await withAppSecretProof(ctx, `${WHATSAPP_API_URL}/${phoneId}/media`, accessToken);
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Authorization": `Bearer ${accessToken}` },
      body: formData
    });

    const data = await response.json();
    if (!response.ok) {
      logError("[uploadMediaFromUrl] Upload Error:", data);
      throw new Error(data.error?.message || "Failed to upload media to WhatsApp");
    }

    logDebug(`[uploadMediaFromUrl] Success! Media ID: ${data.id}`);
    return data.id; // WhatsApp Media ID to use in send requests
  }
});

export const uploadTemplateMedia = action({
  args: {
    storageId: v.string(),
    type: v.string(), // image/jpeg, video/mp4, etc.
    phoneNumberId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    const config = await getWhatsAppConfig(ctx, args.phoneNumberId);
    const settings = (await ctx.runQuery(api.webhookSettings.get, {})) as { appId?: string | null };
    const appId: string | undefined = settings.appId ?? process.env.WHATSAPP_APP_ID ?? undefined;
    const accessToken = config.accessToken;

    if (!appId) {
      throw new Error(
        "Missing Meta App ID. Set it in Integrations (ربط المتجر) under webhook settings, or set WHATSAPP_APP_ID in the environment."
      );
    }

    // 1. Get File URL and Content
    const fileUrl = await ctx.storage.getUrl(args.storageId);
    if (!fileUrl) throw new Error("File not found");

    const fileRes = await fetch(fileUrl);
    const blob = await fileRes.blob();
    const fileLength = blob.size;

    logDebug(`[UploadTemplateMedia] Starting upload for ${args.type}, size: ${fileLength}`);

    // 2. Start Upload Session
    const sessionUrl = `https://graph.facebook.com/v21.0/${appId}/uploads?file_length=${fileLength}&file_type=${args.type}`;

    const proofSessionUrl = await withAppSecretProof(ctx, sessionUrl, accessToken);
    const sessionRes = await fetch(proofSessionUrl, {
      method: "POST",
      headers: {
        "Authorization": `OAuth ${accessToken}` // Note: OAuth prefix sometimes required for this specific endpoint, or Bearer
      }
    });

    const sessionData = await sessionRes.json();

    if (!sessionRes.ok) {
      logError("Failed to create upload session:", sessionData);
      throw new Error(sessionData.error?.message || "Failed to create upload session");
    }

    const uploadId = sessionData.id;
    logDebug(`[UploadTemplateMedia] Session created: ${uploadId}`);

    // 3. Upload File Content
    const uploadUrl = `https://graph.facebook.com/v21.0/${uploadId}`;

    const proofUploadUrl = await withAppSecretProof(ctx, uploadUrl, accessToken);
    const uploadRes = await fetch(proofUploadUrl, {
      method: "POST",
      headers: {
        "Authorization": `OAuth ${accessToken}`,
        "file_offset": "0"
      },
      body: blob
    });

    const uploadData = await uploadRes.json();

    if (!uploadRes.ok) {
      logError("Failed to upload file content:", uploadData);
      throw new Error(uploadData.error?.message || "Failed to upload file content");
    }

    logDebug(`[UploadTemplateMedia] Upload complete, handle: ${uploadData.h}`);

    // Return the handle
    return uploadData.h;
  }
});

export const uploadExternalTemplateMedia = action({
  args: {
    url: v.string(),
    type: v.string(), // image/jpeg, video/mp4, etc.
    phoneNumberId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    const config = await getWhatsAppConfig(ctx, args.phoneNumberId);
    const settings = (await ctx.runQuery(api.webhookSettings.get, {})) as { appId?: string | null };
    const appId: string | undefined = settings.appId ?? process.env.WHATSAPP_APP_ID ?? undefined;
    const accessToken = config.accessToken;

    if (!appId) {
      throw new Error(
        "Missing Meta App ID. Set it in Integrations (ربط المتجر) under webhook settings, or set WHATSAPP_APP_ID in the environment."
      );
    }

    // 1. Fetch File Content from External URL
    logDebug(`[UploadExternal] Fetching from ${args.url}`);
    const fileRes = await fetch(args.url);
    if (!fileRes.ok) throw new Error(`Failed to fetch external media: ${fileRes.statusText}`);

    const blob = await fileRes.blob();
    const fileLength = blob.size;
    const fileType = args.type || fileRes.headers.get("content-type") || "image/jpeg";

    logDebug(`[UploadExternal] Starting upload for ${fileType}, size: ${fileLength}`);

    // 2. Start Upload Session
    const sessionUrl = `https://graph.facebook.com/v21.0/${appId}/uploads?file_length=${fileLength}&file_type=${fileType}`;

    const proofSessionUrl = await withAppSecretProof(ctx, sessionUrl, accessToken);
    const sessionRes = await fetch(proofSessionUrl, {
      method: "POST",
      headers: {
        "Authorization": `OAuth ${accessToken}`
      }
    });

    const sessionData = await sessionRes.json();

    if (!sessionRes.ok) {
      logError("Failed to create upload session:", sessionData);
      throw new Error(sessionData.error?.message || "Failed to create upload session");
    }

    const uploadId = sessionData.id;

    // 3. Upload File Content
    const uploadUrl = `https://graph.facebook.com/v21.0/${uploadId}`;

    const proofUploadUrl = await withAppSecretProof(ctx, uploadUrl, accessToken);
    const uploadRes = await fetch(proofUploadUrl, {
      method: "POST",
      headers: {
        "Authorization": `OAuth ${accessToken}`,
        "file_offset": "0"
      },
      body: blob
    });

    const uploadData = await uploadRes.json();

    if (!uploadRes.ok) {
      logError("Failed to upload file content:", uploadData);
      throw new Error(uploadData.error?.message || "Failed to upload file content");
    }

    logDebug(`[UploadExternal] Upload complete, handle: ${uploadData.h}`);

    return uploadData.h;
  }
});

export const getMediaUrl = action({
  args: {
    mediaId: v.string(),
    phoneNumberId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { accessToken } = await getWhatsAppConfig(ctx, args.phoneNumberId);

    const mediaUrl = await withAppSecretProof(ctx, `${WHATSAPP_API_URL}/${args.mediaId}`, accessToken);
    const response = await fetch(mediaUrl, {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });

    const data = await response.json();
    if (!response.ok) throw new Error("Failed to get media URL");

    return data.url; // The temporary download URL
  }
});

export const hydrateIncomingMedia = internalAction({
  args: {
    messageId: v.id("messages"),
    mediaId: v.string(),
    phoneNumberId: v.optional(v.string()),
    attempt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const attempt = args.attempt ?? 1;
    try {
      const { accessToken } = await getWhatsAppConfig(ctx, args.phoneNumberId);
      logDebug(`[WhatsApp] hydrateIncomingMedia start mediaId=${args.mediaId} phoneNumberId=${args.phoneNumberId ?? "none"} attempt=${attempt}`);
      const downloadUrl = await ctx.runAction(api.whatsapp.getMediaUrl, {
        mediaId: args.mediaId,
        phoneNumberId: args.phoneNumberId,
      });
      const response = await fetch(downloadUrl, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        throw new Error(`Failed to download media: ${response.status}`);
      }
      const blob = await response.blob();
      const storageId = await ctx.storage.store(blob);
      await ctx.runMutation((internal as any).messages.updateMessageStorageId, {
        messageId: args.messageId,
        storageId,
      });
      logDebug(`[WhatsApp] hydrateIncomingMedia success mediaId=${args.mediaId} attempt=${attempt}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logError(`[WhatsApp] hydrateIncomingMedia failed mediaId=${args.mediaId} attempt=${attempt}:`, errorMessage);
      if (attempt < 3) {
        const delayMs = attempt * 2000;
        await ctx.scheduler.runAfter(delayMs, internal.whatsapp.hydrateIncomingMedia, {
          messageId: args.messageId,
          mediaId: args.mediaId,
          phoneNumberId: args.phoneNumberId,
          attempt: attempt + 1,
        });
        return;
      }
      await ctx.runMutation((internal as any).messages.updateMediaHydrationFailure, {
        messageId: args.messageId,
        error: errorMessage,
      });
      await ctx.runMutation(internal.webhookEvents.logWhatsappProcessing, {
        body: { mediaId: args.mediaId, messageId: args.messageId, phoneNumberId: args.phoneNumberId },
        processingStatus: "failed",
        eventType: "media_hydration",
        resolvedPhoneNumberId: args.phoneNumberId,
        fallbackUsed: false,
        note: errorMessage,
      });
    }
  },
});

// --- Webhook Verification ---

export const verifyWebhook = internalAction({
  args: {
    mode: v.optional(v.string()),
    verify_token: v.optional(v.string()),
    challenge: v.optional(v.string()),
    expected_verify_token: v.optional(v.string()), // from DB (webhook settings form); fallback to env in http handler
  },
  handler: async (ctx, args) => {
    const verifyToken = args.expected_verify_token ?? process.env.WHATSAPP_VERIFY_TOKEN;
    logDebug("[VerifyWebhook] Expected token from:", args.expected_verify_token != null ? "DB" : "env");
    logDebug("[VerifyWebhook] Received:", { mode: args.mode, token: args.verify_token });

    if (args.mode === "subscribe" && verifyToken && args.verify_token === verifyToken) {
      logDebug("Webhook Verified!");
      return { success: true, challenge: args.challenge };
    } else {
      logError("Webhook Verification Failed");
      return { success: false };
    }
  }
});

// --- Webhook Processing ---

// --- Async Webhook Processing ---

export const dispatchWebhook = internalMutation({
  args: { body: v.any() },
  handler: async (ctx, args) => {
    // Fire and forget via scheduler
    await ctx.scheduler.runAfter(0, internal.whatsapp.processWebhookAction, {
      body: args.body,
      attempt: 1
    });
  }
});

export const processWebhookAction = internalAction({
  args: {
    body: v.any(),
    attempt: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const changes = extractWebhookChanges(args.body);
    logDebug(`[Webhook Action] Processing payload changes=${changes.length}`);
    if (changes.length === 0) {
      logWarn("[Webhook Action] No entries found in payload");
      await ctx.runMutation(internal.webhookEvents.logWhatsappProcessing, {
        body: args.body,
        processingStatus: "ignored_no_messages",
        eventType: "empty_payload",
        note: "No entry/changes found",
      });
      return;
    }

    for (const change of changes) {
        const value = change.value;
        const field = change.field;
        if (!value) {
          logWarn(`[Webhook Action] Skipping change with empty value. field=${field ?? "unknown"}`);
          await ctx.runMutation(internal.webhookEvents.logWhatsappProcessing, {
            body: change,
            processingStatus: "failed",
            eventType: field ?? "unknown",
            note: "Change has no value",
          });
          continue;
        }

        const resolvedNumber = await resolveInboundPhoneNumberId(ctx, value?.metadata?.phone_number_id);
        const resolvedPhoneNumberId = resolvedNumber.phoneNumberId;
        const businessPhoneId = resolvedPhoneNumberId ?? "unknown";
        const messages = Array.isArray(value.messages) ? value.messages : [];
        const statuses = Array.isArray(value.statuses) ? value.statuses : [];
        const hasMessages = messages.length > 0;
        const hasStatuses = statuses.length > 0;
        const metadataPhoneNumberId =
          typeof value?.metadata?.phone_number_id === "string" ? value.metadata.phone_number_id : undefined;
        const metadataDisplayPhoneNumber =
          typeof value?.metadata?.display_phone_number === "string" ? value.metadata.display_phone_number : undefined;
        const metadataBusinessAccountId =
          typeof change?.entryId === "string" ? change.entryId : undefined;

        if (metadataPhoneNumberId) {
          await ctx.runMutation(internal.whatsappNumbers.upsertFromWebhookMetadata, {
            businessNumberId: metadataPhoneNumberId,
            displayPhoneNumber: metadataDisplayPhoneNumber,
            businessAccountId: metadataBusinessAccountId,
          });
        }

        // Validate: when using metadata.phone_number_id (not fallback), number must be in whatsapp_numbers
        if (resolvedPhoneNumberId && !resolvedNumber.usedFallback) {
          const numberInDb = await ctx.runQuery(internal.whatsappNumbers.getByBusinessNumberId, {
            businessNumberId: resolvedPhoneNumberId,
          });
          if (!numberInDb) {
            logWarn(
              `[Webhook Action] Number ${resolvedPhoneNumberId} (${metadataDisplayPhoneNumber ?? "unknown"}) is not configured. Add it in Integrations and set access token. Sending replies will fail until configured.`
            );
          }
        }

        logDebug(
          `[Webhook Action] field="${field}" businessId="${businessPhoneId}" fallback=${resolvedNumber.usedFallback} hasMessages=${hasMessages} messagesCount=${messages.length} hasStatuses=${hasStatuses} statusesCount=${statuses.length} metadataPhoneNumberId=${metadataPhoneNumberId ?? "none"}`
        );
        await ctx.runMutation(internal.webhookEvents.logWhatsappProcessing, {
          body: change,
          processingStatus: "received",
          eventType: field ?? "unknown",
          resolvedPhoneNumberId: resolvedPhoneNumberId,
          fallbackUsed: resolvedNumber.usedFallback,
          hasMessages,
          messagesCount: messages.length,
          hasStatuses,
          statusesCount: statuses.length,
          metadataPhoneNumberId,
          metadataDisplayPhoneNumber,
        });

        if (hasMessages) {
          logDebug(`[Webhook Action] Processing ${messages.length} messages`);
          for (const message of messages) {
            let content = message.text?.body || "";
            let mediaId = undefined;

            if (["image", "video", "audio", "document", "voice"].includes(message.type)) {
              const mediaData = message[message.type];
              mediaId = mediaData?.id;
              content = mediaData?.caption || "";
            }

            const contactPhone = message.from || value.contacts?.[0]?.wa_id || "unknown_contact";
            const contactName = value.contacts?.[0]?.profile?.name || contactPhone;
            const messageTimestamp = Number.parseInt(message.timestamp, 10);
            let messageId;
            try {
              messageId = await ctx.runMutation(internal.messages.saveMessage, {
                contactId: contactPhone,
                contactName,
                contactPhone,
                phoneNumberId: resolvedPhoneNumberId,
                direction: "inbound",
                type: message.type,
                content,
                metaMessageId: message.id,
                timestamp: Number.isFinite(messageTimestamp) ? messageTimestamp * 1000 : Date.now(),
                status: "delivered",
                mediaId,
              });
              await ctx.runMutation(internal.webhookEvents.logWhatsappProcessing, {
                body: message,
                processingStatus: "saved",
                eventType: "message",
                resolvedPhoneNumberId: resolvedPhoneNumberId,
                fallbackUsed: resolvedNumber.usedFallback,
                hasMessages: true,
                messagesCount: 1,
                hasStatuses,
                statusesCount: statuses.length,
                metadataPhoneNumberId,
                metadataDisplayPhoneNumber,
                note: `Saved message ${message.id}`,
              });
            } catch (saveError) {
              const errText = saveError instanceof Error ? saveError.message : String(saveError);
              await ctx.runMutation(internal.webhookEvents.logWhatsappProcessing, {
                body: message,
                processingStatus: "failed",
                eventType: "message",
                resolvedPhoneNumberId: resolvedPhoneNumberId,
                fallbackUsed: resolvedNumber.usedFallback,
                hasMessages: true,
                messagesCount: 1,
                hasStatuses,
                statusesCount: statuses.length,
                metadataPhoneNumberId,
                metadataDisplayPhoneNumber,
                note: errText,
              });
              throw saveError;
            }

            if (mediaId) {
              await ctx.scheduler.runAfter(0, internal.whatsapp.hydrateIncomingMedia, {
                messageId,
                mediaId,
                phoneNumberId: resolvedPhoneNumberId,
                attempt: 1,
              });
            }

            const chat = await ctx.runQuery(internal.chat.getChatByPhone, {
              phone: contactPhone,
              phoneNumberId: resolvedPhoneNumberId,
            });
            if (chat?.aiMode) {
              const aiConfig = await ctx.runQuery(internal.ai_config.getInternalConfig, {
                phoneNumberId: resolvedPhoneNumberId,
              });
              if (aiConfig?.isActive) {
                await ctx.runMutation(internal.webhookEvents.logWhatsappProcessing, {
                  body: { chatId: chat._id, contactPhone, userMessage: content },
                  processingStatus: "received",
                  eventType: "agent_dispatch",
                  resolvedPhoneNumberId,
                  fallbackUsed: false,
                  note: "Agent scheduled for reply",
                });
                await ctx.scheduler.runAfter(0, internal.agent.generateResponse, {
                  chatId: chat._id,
                  contactPhone,
                  userMessage: content,
                });
              } else {
                await ctx.runMutation(internal.webhookEvents.logWhatsappProcessing, {
                  body: { chatId: chat._id, contactPhone, userMessage: content },
                  processingStatus: "received",
                  eventType: "agent_dispatch_skipped",
                  resolvedPhoneNumberId,
                  fallbackUsed: false,
                  note: "chat.aiMode=true but per-number agent disabled",
                });
              }
            }
          }
        } else {
          logDebug(
            `[Webhook Action] Status-only or non-message payload for field=${field ?? "unknown"} messagesCount=${messages.length} statusesCount=${statuses.length}`
          );
          const statusNote = hasStatuses
            ? "Status-only payload; processing status updates"
            : "Change has no value.messages (metadata-only or empty)";
          await ctx.runMutation(internal.webhookEvents.logWhatsappProcessing, {
            body: change,
            processingStatus: hasStatuses ? "received" : "ignored_no_messages",
            eventType: field ?? "unknown",
            resolvedPhoneNumberId: resolvedPhoneNumberId,
            fallbackUsed: resolvedNumber.usedFallback,
            hasMessages,
            messagesCount: messages.length,
            hasStatuses,
            statusesCount: statuses.length,
            metadataPhoneNumberId,
            metadataDisplayPhoneNumber,
            note: statusNote,
          });
        }

        if (hasStatuses) {
          logDebug(`[Webhook Action] Processing ${statuses.length} status updates`);
          for (const status of statuses) {
            const msgSuccess = await ctx.runMutation(internal.messages.updateMessageStatus, {
              metaMessageId: status.id,
              status: status.status,
            });
            const campaignSuccess = await ctx.runMutation(internal.campaigns.updateMessageStatus, {
              metaMessageId: status.id,
              status: status.status,
            });

            if (!msgSuccess && !campaignSuccess) {
              const attempt = args.attempt || 1;
              if (attempt < 3) {
                logDebug(
                  `[Webhook] Message ${status.id} not found. Scheduling targeted status retry #${attempt + 1}`
                );
                const retryBody = {
                  object: (args.body as any)?.object,
                  entry: [
                    {
                      changes: [
                        {
                          field: field ?? "messages",
                          value: {
                            metadata: value?.metadata,
                            statuses: [status],
                          },
                        },
                      ],
                    },
                  ],
                };
                await ctx.scheduler.runAfter(2000, internal.whatsapp.processWebhookAction, {
                  body: retryBody,
                  attempt: attempt + 1,
                });
                continue;
              }
              logWarn(`[Webhook] Message ${status.id} not found after 3 attempts`);
            } else {
              logDebug(`[Webhook Action] Status updated for message ${status.id} -> ${status.status}`);
            }
          }
        }

        if (field === "message_template_status_update") {
          const templateUpdate = value;
          if (templateUpdate?.message_template_name && templateUpdate?.event) {
            await ctx.runMutation((internal as any).templates.updateStatus, {
              name: templateUpdate.message_template_name,
              status: templateUpdate.event.toUpperCase(),
              phoneNumberId: resolvedPhoneNumberId,
            });
          }
        }
    }
  }
});

/** Test access token in DB: validates token by calling Meta Graph API. Use from dashboard or Integrations page. */
export const testAccessToken = action({
  args: {
    phoneNumberId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const config = await getWhatsAppConfig(ctx, args.phoneNumberId ?? undefined);
      const url = await withAppSecretProof(
        ctx,
        `${WHATSAPP_API_URL}/${config.phoneId}?fields=id,display_phone_number`,
        config.accessToken
      );
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${config.accessToken}` },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const code = data.error?.code ?? response.status;
        const msg = data.error?.message ?? data.error?.error_user_msg ?? response.statusText ?? "Unknown error";
        if (response.status === 401 || response.status === 403) {
          return {
            success: false,
            error: "Access token is invalid or expired. Update the token in Integrations or Webhook settings.",
            details: msg,
          };
        }
        return {
          success: false,
          error: `API error (${code}): ${msg}`,
          details: data,
        };
      }

      return {
        success: true,
        phoneId: config.phoneId,
        displayPhoneNumber: data.display_phone_number ?? null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: message,
        details: null,
      };
    }
  },
});

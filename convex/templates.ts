import { query, mutation, action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

function normalizeLanguageCode(lang: string | undefined): string {
  return (lang || "").trim().toLowerCase().replace("-", "_");
}

function extractLanguageCode(value: any): string | null {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }
  if (value && typeof value === "object" && typeof value.code === "string") {
    const normalized = value.code.trim();
    return normalized.length > 0 ? normalized : null;
  }
  return null;
}

function normalizeTemplateStatus(value: any): "APPROVED" | "REJECTED" | "PENDING" {
  const raw = String(value || "").trim().toUpperCase();
  if (raw === "APPROVED") return "APPROVED";
  if (raw === "REJECTED") return "REJECTED";
  return "PENDING";
}

function extractTemplateContentFromComponents(components: any): string | undefined {
  if (!Array.isArray(components)) return undefined;
  const body = components.find((component) => component?.type === "BODY");
  if (!body) return undefined;
  if (typeof body.text === "string") {
    const content = body.text.trim();
    return content.length > 0 ? content : undefined;
  }
  if (Array.isArray(body.example?.body_text) && body.example.body_text.length > 0) {
    const sample = body.example.body_text[0];
    if (Array.isArray(sample)) {
      const text = sample.find((entry) => typeof entry === "string");
      if (typeof text === "string" && text.trim().length > 0) return text.trim();
    } else if (typeof sample === "string" && sample.trim().length > 0) {
      return sample.trim();
    }
  }
  return undefined;
}

function normalizeMetaTemplateRecord(template: any): {
  name: string;
  language: string;
  category: string;
  status: "APPROVED" | "REJECTED" | "PENDING";
  components: any[];
  content?: string;
  metaTemplateId?: string;
} | null {
  const name = typeof template?.name === "string" ? template.name.trim() : "";
  const language = extractLanguageCode(template?.language);
  if (!name || !language) return null;

  const components = Array.isArray(template?.components) ? template.components : [];
  const content = extractTemplateContentFromComponents(components);
  const category =
    typeof template?.category === "string" && template.category.trim().length > 0
      ? template.category.trim()
      : "MARKETING";
  const status = normalizeTemplateStatus(template?.status);
  const metaTemplateId =
    typeof template?.id === "string" && template.id.trim().length > 0 ? template.id.trim() : undefined;

  return {
    name,
    language,
    category,
    status,
    components,
    content,
    metaTemplateId,
  };
}

function pickMostRecentTemplate<T extends { _creationTime: number; lastSyncedAt?: number }>(rows: T[]): T | null {
  if (rows.length === 0) return null;
  return rows
    .slice()
    .sort((a, b) => (b.lastSyncedAt ?? b._creationTime) - (a.lastSyncedAt ?? a._creationTime))[0];
}

export const list = query({
  args: { phoneNumberId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.phoneNumberId) {
      return await ctx.db
        .query("templates")
        .withIndex("by_phone_number_id", (q) => q.eq("phoneNumberId", args.phoneNumberId!))
        .order("desc")
        .collect();
    }
    return await ctx.db.query("templates").order("desc").collect();
  },
});

export const listScopedApproved = query({
  args: { phoneNumberId: v.string() },
  handler: async (ctx, args) => {
    const scoped = await ctx.db
      .query("templates")
      .withIndex("by_phone_number_id", (q) => q.eq("phoneNumberId", args.phoneNumberId))
      .order("desc")
      .collect();
    return scoped.filter((template) => template.status === "APPROVED");
  },
});

export const getScopedTemplateHealth = query({
  args: { phoneNumberId: v.string() },
  handler: async (ctx, args) => {
    const scoped = await ctx.db
      .query("templates")
      .withIndex("by_phone_number_id", (q) => q.eq("phoneNumberId", args.phoneNumberId))
      .collect();
    const scopedApproved = scoped.filter((template) => template.status === "APPROVED");
    const lastSyncAt =
      scoped.length > 0
        ? Math.max(...scoped.map((template) => template.lastSyncedAt ?? template._creationTime))
        : null;
    const hasAnyGlobalApproved = (await ctx.db.query("templates").take(5000)).some(
      (template) => !template.phoneNumberId && template.status === "APPROVED"
    );
    const number = await ctx.db
      .query("whatsapp_numbers")
      .withIndex("by_business_number_id", (q) => q.eq("businessNumberId", args.phoneNumberId))
      .first();
    const tokenStatus = number?.tokenStatus ?? (number?.accessToken?.trim() ? "connected" : "missing");

    return {
      scopedApprovedCount: scopedApproved.length,
      lastSyncAt,
      hasAnyGlobalApproved,
      tokenStatus,
      lastAuthErrorCode: number?.lastAuthErrorCode ?? null,
      lastAuthErrorMessage: number?.lastAuthErrorMessage ?? null,
      lastAuthErrorAt: number?.lastAuthErrorAt ?? null,
    };
  },
});

export const getScopedApprovedCountInternal = internalQuery({
  args: { phoneNumberId: v.string() },
  handler: async (ctx, args) => {
    const scoped = await ctx.db
      .query("templates")
      .withIndex("by_phone_number_id", (q) => q.eq("phoneNumberId", args.phoneNumberId))
      .collect();
    return scoped.filter((template) => template.status === "APPROVED").length;
  },
});

export const getByName = query({
  args: { name: v.string(), phoneNumberId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.phoneNumberId) {
      return await ctx.db
        .query("templates")
        .withIndex("by_phone_number_id_name", (q) =>
          q.eq("phoneNumberId", args.phoneNumberId!).eq("name", args.name)
        )
        .first();
    }
    return await ctx.db
      .query("templates")
      .filter((q: any) => q.eq(q.field("name"), args.name))
      .first();
  },
});

export const getById = query({
  args: { id: v.id("templates") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getTemplateByName = internalQuery({
  args: { name: v.string(), phoneNumberId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.phoneNumberId) {
      return await ctx.db
        .query("templates")
        .withIndex("by_phone_number_id_name", (q) =>
          q.eq("phoneNumberId", args.phoneNumberId!).eq("name", args.name)
        )
        .first();
    }
    return await ctx.db
      .query("templates")
      .filter((q: any) => q.eq(q.field("name"), args.name))
      .first();
  },
});

export const resolveTemplateForSend = internalQuery({
  args: {
    templateName: v.string(),
    phoneNumberId: v.optional(v.string()),
    requestedLanguage: v.optional(v.string()),
    allowFallback: v.optional(v.boolean()),
    requireScoped: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const allowFallback = args.allowFallback ?? true;
    const requireScoped = args.requireScoped ?? false;
    const requestedLanguage = normalizeLanguageCode(args.requestedLanguage);
    const attempted: Array<{ step: string; matched: boolean; note?: string }> = [];

    const scopedByName = args.phoneNumberId
      ? await ctx.db
          .query("templates")
          .withIndex("by_phone_number_id_name", (q) =>
            q.eq("phoneNumberId", args.phoneNumberId!).eq("name", args.templateName)
          )
          .collect()
      : [];
    const scopedApproved = scopedByName.filter((t) => t.status === "APPROVED");

    if (args.phoneNumberId) {
      if (requestedLanguage) {
        const scopedExact = scopedApproved.find(
          (t) => normalizeLanguageCode(t.language) === requestedLanguage
        );
        attempted.push({
          step: "scoped_exact",
          matched: !!scopedExact,
          note: `candidates=${scopedApproved.length}`,
        });
        if (scopedExact) {
          return {
            ok: true as const,
            selected: {
              templateId: scopedExact._id,
              name: scopedExact.name,
              language: scopedExact.language,
              phoneNumberId: scopedExact.phoneNumberId ?? null,
            },
            resolutionMode: "scoped_exact" as const,
            attempted,
          };
        }
      } else {
        attempted.push({
          step: "scoped_exact",
          matched: false,
          note: "requestedLanguage missing",
        });
      }
    } else {
      attempted.push({
        step: "scoped_exact",
        matched: false,
        note: "phoneNumberId missing",
      });
    }

    if (allowFallback && scopedApproved.length > 0) {
      const scopedAny = pickMostRecentTemplate(scopedApproved);
      if (scopedAny) {
        attempted.push({
          step: "scoped_same_name_any_lang",
          matched: true,
          note: `selectedLanguage=${scopedAny.language}`,
        });
        return {
          ok: true as const,
          selected: {
            templateId: scopedAny._id,
            name: scopedAny.name,
            language: scopedAny.language,
            phoneNumberId: scopedAny.phoneNumberId ?? null,
          },
          resolutionMode: "scoped_same_name_any_lang" as const,
          attempted,
        };
      }
    } else {
      attempted.push({
        step: "scoped_same_name_any_lang",
        matched: false,
        note: allowFallback ? "no scoped approved templates" : "fallback disabled",
      });
    }

    if (requireScoped) {
      attempted.push({
        step: "global_exact",
        matched: false,
        note: "requireScoped enabled",
      });

      if (!args.phoneNumberId) {
        return {
          ok: false as const,
          reasonCode: "PHONE_NUMBER_REQUIRED",
          message: `Template "${args.templateName}" requires a scoped phone number for sending.`,
          attempted,
        };
      }

      const hasAnyScopedByName = scopedByName.length > 0;
      const hasApprovedScopedByName = scopedApproved.length > 0;
      if (!hasAnyScopedByName) {
        return {
          ok: false as const,
          reasonCode: "TEMPLATE_NOT_FOUND",
          message: `Template "${args.templateName}" is not available for this sending number.`,
          attempted,
        };
      }
      if (!hasApprovedScopedByName) {
        return {
          ok: false as const,
          reasonCode: "TEMPLATE_NOT_APPROVED",
          message: `Template "${args.templateName}" is not approved for this sending number.`,
          attempted,
        };
      }
      if (!requestedLanguage) {
        return {
          ok: false as const,
          reasonCode: "LANGUAGE_MISSING",
          message: `Template "${args.templateName}" cannot be resolved because requested language is missing.`,
          attempted,
        };
      }
      return {
        ok: false as const,
        reasonCode: "LANGUAGE_MISMATCH",
        message: `Template "${args.templateName}" is not available in requested language "${requestedLanguage}" for this number.`,
        attempted,
      };
    }

    const templatesByName = await ctx.db
      .query("templates")
      .filter((q: any) => q.eq(q.field("name"), args.templateName))
      .collect();
    const globalApproved = templatesByName.filter((t) => !t.phoneNumberId && t.status === "APPROVED");

    if (!requestedLanguage) {
      attempted.push({
        step: "global_exact",
        matched: false,
        note: "requestedLanguage missing",
      });
      return {
        ok: false as const,
        reasonCode: "LANGUAGE_MISSING",
        message: `Template "${args.templateName}" cannot be resolved because requested language is missing.`,
        attempted,
      };
    }

    const globalExact = globalApproved.find(
      (t) => normalizeLanguageCode(t.language) === requestedLanguage
    );
    attempted.push({
      step: "global_exact",
      matched: !!globalExact,
      note: `candidates=${globalApproved.length}`,
    });
    if (allowFallback && globalExact) {
      return {
        ok: true as const,
        selected: {
          templateId: globalExact._id,
          name: globalExact.name,
          language: globalExact.language,
          phoneNumberId: globalExact.phoneNumberId ?? null,
        },
        resolutionMode: "global_exact" as const,
        attempted,
      };
    }

    const hasAnyByName = templatesByName.length > 0;
    const hasApprovedByName = templatesByName.some((t) => t.status === "APPROVED");
    if (!hasAnyByName) {
      return {
        ok: false as const,
        reasonCode: "TEMPLATE_NOT_FOUND",
        message: `Template "${args.templateName}" was not found.`,
        attempted,
      };
    }
    if (!hasApprovedByName) {
      return {
        ok: false as const,
        reasonCode: "TEMPLATE_NOT_APPROVED",
        message: `Template "${args.templateName}" is not approved in any available scope.`,
        attempted,
      };
    }

    return {
      ok: false as const,
      reasonCode: "LANGUAGE_MISMATCH",
      message: `Template "${args.templateName}" is not available in requested language "${requestedLanguage}".`,
      attempted,
    };
  },
});

export const resolveTemplateForSendWithSync = internalAction({
  args: {
    templateName: v.string(),
    phoneNumberId: v.optional(v.string()),
    requestedLanguage: v.optional(v.string()),
    allowFallback: v.optional(v.boolean()),
    requireScoped: v.optional(v.boolean()),
    failOnSyncError: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const resolveArgs = {
      templateName: args.templateName,
      phoneNumberId: args.phoneNumberId,
      requestedLanguage: args.requestedLanguage,
      allowFallback: args.allowFallback,
      requireScoped: args.requireScoped,
    };
    const before: any = await ctx.runQuery(internal.templates.resolveTemplateForSend, resolveArgs);
    let syncError: string | null = null;
    try {
      await ctx.runAction(api.templates.syncFromMeta, {
        phoneNumberId: args.phoneNumberId ?? undefined,
      });
    } catch (error) {
      syncError = error instanceof Error ? error.message : String(error);
    }

    const after: any = await ctx.runQuery(internal.templates.resolveTemplateForSend, resolveArgs);
    const attempted = [
      ...(after?.attempted || []),
      {
        step: "sync_from_meta",
        matched: syncError === null,
        note: syncError ? `sync failed: ${syncError}` : "sync succeeded",
      },
    ];
    const failOnSyncError = args.failOnSyncError ?? false;

    if (syncError && failOnSyncError && !after?.ok) {
      return {
        ok: false as const,
        reasonCode: "SYNC_FAILED",
        message:
          "Template sync failed for this number. Reconnect the WhatsApp token in Integrations and sync templates again before sending.",
        attempted,
      };
    }

    if (!after?.ok) {
      return {
        ...after,
        attempted,
      };
    }

    const changedSelection =
      !before?.ok ||
      before?.selected?.templateId !== after?.selected?.templateId ||
      before?.selected?.language !== after?.selected?.language ||
      before?.selected?.phoneNumberId !== after?.selected?.phoneNumberId;
    const resolutionMode = syncError
      ? `cached_${after.resolutionMode}`
      : changedSelection
        ? `synced_${after.resolutionMode}`
        : after.resolutionMode;

    return {
      ...after,
      resolutionMode,
      attempted,
    };
  },
});

export const syncScopedFromMeta = action({
  args: {
    phoneNumberId: v.string(),
  },
  handler: async (ctx, args): Promise<{ syncedCount: number; scopedApprovedCount: number }> => {
    const syncedCount: number = await ctx.runAction(api.templates.syncFromMeta, {
      phoneNumberId: args.phoneNumberId,
    });
    const scopedApprovedCount: number = await ctx.runQuery(
      internal.templates.getScopedApprovedCountInternal,
      { phoneNumberId: args.phoneNumberId }
    );
    return {
      syncedCount,
      scopedApprovedCount,
    };
  },
});

export const upsert = internalMutation({
  args: {
    phoneNumberId: v.optional(v.string()),
    name: v.string(),
    language: v.string(),
    category: v.string(),
    status: v.string(),
    content: v.optional(v.string()),
    components: v.any(),
    metaTemplateId: v.optional(v.string()),
  },
    handler: async (ctx, args) => {
    const existing = args.phoneNumberId
      ? await ctx.db
          .query("templates")
          .withIndex("by_phone_number_id_name_language", (q) =>
            q.eq("phoneNumberId", args.phoneNumberId!).eq("name", args.name).eq("language", args.language)
          )
          .first()
      : await ctx.db
          .query("templates")
          .filter((q: any) => q.and(q.eq(q.field("name"), args.name), q.eq(q.field("language"), args.language)))
          .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        category: args.category,
        status: args.status as any,
        content: args.content,
        components: args.components,
        metaTemplateId: args.metaTemplateId,
        lastSyncedAt: Date.now(),
      });
      return existing._id;
    } else {
      return await ctx.db.insert("templates", {
        phoneNumberId: args.phoneNumberId,
        name: args.name,
        language: args.language,
        category: args.category,
        status: args.status as any,
        content: args.content,
        components: args.components,
        metaTemplateId: args.metaTemplateId,
        lastSyncedAt: Date.now(),
      });
    }
  },
});

export const updateStatus = mutation({
  args: {
    name: v.string(),
    status: v.string(),
    phoneNumberId: v.optional(v.string()),
    language: v.optional(v.string()), // When set, update only this (name, language); otherwise all variants
  },
  handler: async (ctx, args) => {
    const templates = args.phoneNumberId
      ? await ctx.db
          .query("templates")
          .withIndex("by_phone_number_id_name", (q) =>
            q.eq("phoneNumberId", args.phoneNumberId!).eq("name", args.name)
          )
          .collect()
      : await ctx.db
          .query("templates")
          .filter((q: any) => q.eq(q.field("name"), args.name))
          .collect();

    const toUpdate = args.language
      ? templates.filter((t) => (t.language || "").toLowerCase() === (args.language || "").toLowerCase())
      : templates;

    for (const template of toUpdate) {
      await ctx.db.patch(template._id, {
        status: args.status as any,
        lastSyncedAt: Date.now(),
      });
    }
  },
});

export const updateStatusById = internalMutation({
  args: {
    id: v.id("templates"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.id);
    if (!template) return false;
    await ctx.db.patch(args.id, {
      status: args.status as any,
      lastSyncedAt: Date.now(),
    });
    return true;
  },
});

export const deleteInternal = internalMutation({
  args: { name: v.string(), phoneNumberId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const templates = args.phoneNumberId
      ? await ctx.db
          .query("templates")
          .withIndex("by_phone_number_id_name", (q) =>
            q.eq("phoneNumberId", args.phoneNumberId!).eq("name", args.name)
          )
          .collect()
      : await ctx.db
          .query("templates")
          .filter((q: any) => q.eq(q.field("name"), args.name))
          .collect();

    for (const template of templates) {
      await ctx.db.delete(template._id);
    }
  },
});

export const deleteTemplate = action({
  args: {
    name: v.string(),
    phoneNumberId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    // 1. Delete from Meta
    try {
      await ctx.runAction(api.whatsapp.deleteTemplate, {
        name: args.name,
        phoneNumberId: args.phoneNumberId,
      });
    } catch (e: any) {
      const errorMessage = e.message || String(e);
      console.error("Failed to delete from Meta:", errorMessage);

      // If it's a permission error, we MUST fail and tell the user
      if (errorMessage.includes("permission") || errorMessage.includes("OAuthException") || errorMessage.includes("(#100)")) {
        throw new Error("Meta Permission Error: Check WhatsApp Manager permissions. " + errorMessage);
      }

      // If it's "does not exist" or other non-critical errors, we might want to proceed.
      // But since we can't be sure if it's "not found" vs "other error", 
      // and we want strict sync, it's better to throw unless we are sure.
      // For now, we will throw for everything to ensure the user sees the issue.
      // The only exception is if we KNEW it was "not found".

      // Attempting to detect "Not Found" - this is a guess at the error string, 
      // if we can't confirm, we throw.
      if (!errorMessage.toLowerCase().includes("not found") && !errorMessage.toLowerCase().includes("does not exist")) {
        throw e;
      }

      console.log("Template might already be deleted from Meta, proceeding to sync local DB.");
    }

    // 2. Delete locally
    await ctx.runMutation(internal.templates.deleteInternal, {
      name: args.name,
      phoneNumberId: args.phoneNumberId,
    });
  },
});

export const createTemplate = action({
  args: {
    name: v.string(),
    language: v.string(),
    category: v.string(),
    components: v.any(),
    phoneNumberId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<any> => {
    try {
      const res = await ctx.runAction(api.whatsapp.createTemplate, {
        name: args.name,
        language: args.language,
        category: args.category,
        components: args.components,
        phoneNumberId: args.phoneNumberId,
      });
      return res;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes("Missing WhatsApp config") || message.includes("Missing WABA") || message.includes("access token") || message.includes("Integrations")) {
        throw new Error("لا يمكن إنشاء القالب: اختر رقماً نشطاً من القائمة وربطه في التكاملات (التكاملات ← رقم WhatsApp ← رمز الوصول). " + message);
      }
      throw e;
    }
  },
});

export const syncFromMeta = action({
  args: {
    phoneNumberId: v.optional(v.string()), // When set, use this number's token and WABA from DB for Meta API
  },
  handler: async (ctx, args): Promise<number> => {
    // 1. Fetch templates from Meta API (use DB token when phoneNumberId provided)
    const metaTemplates: any[] = await ctx.runAction(api.whatsapp.fetchTemplates, {
      phoneNumberId: args.phoneNumberId ?? undefined,
    });
    const normalizedTemplates = metaTemplates
      .map((template) => normalizeMetaTemplateRecord(template))
      .filter((template): template is NonNullable<typeof template> => template !== null);

    // 2. Upsert each template into local DB
    for (const t of normalizedTemplates) {
      await ctx.runMutation(internal.templates.upsert, {
        phoneNumberId: args.phoneNumberId,
        name: t.name,
        language: t.language,
        category: t.category,
        status: t.status,
        content: t.content,
        components: t.components,
        metaTemplateId: t.metaTemplateId,
      });
    }

    // 3. Remove local templates whose (name, language) is not in Meta
    await ctx.runMutation(internal.templates.pruneLocal, {
      metaNameLangPairs: normalizedTemplates.map((t) => ({ name: t.name, language: t.language })),
      phoneNumberId: args.phoneNumberId,
    });

    return normalizedTemplates.length;
  },
});

export const pruneLocal = internalMutation({
  args: {
    metaNameLangPairs: v.array(v.object({ name: v.string(), language: v.string() })),
    phoneNumberId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const metaSet = new Set(args.metaNameLangPairs.map((p) => `${p.name}\0${p.language}`));
    const localTemplates = args.phoneNumberId
      ? await ctx.db
          .query("templates")
          .withIndex("by_phone_number_id", (q) => q.eq("phoneNumberId", args.phoneNumberId!))
          .collect()
      : await ctx.db.query("templates").collect();

    for (const local of localTemplates) {
      const key = `${local.name}\0${local.language}`;
      if (!metaSet.has(key)) {
        await ctx.db.delete(local._id);
      }
    }
  },
});

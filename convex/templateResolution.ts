export type ScopedTemplateCandidate = {
  _id: string;
  name: string;
  language?: string | null;
  phoneNumberId?: string | null;
  status?: string;
  lastSyncedAt?: number | null;
  _creationTime?: number;
};

export type ScopedResolutionMode =
  | "scoped_exact"
  | "scoped_language_family"
  | "scoped_latest";

export type ScopedTemplateExclude = {
  templateId?: string | null;
  language?: string | null;
};

export function normalizeTemplateLanguageCode(lang: string | undefined | null): string {
  return String(lang ?? "").trim().toLowerCase().replace("-", "_");
}

function languageFamily(lang: string | undefined | null): string {
  const normalized = normalizeTemplateLanguageCode(lang);
  return normalized.split("_")[0] ?? "";
}

function templateRecency(template: ScopedTemplateCandidate): number {
  return Number(template.lastSyncedAt ?? template._creationTime ?? 0);
}

function latestTemplate(templates: readonly ScopedTemplateCandidate[]): ScopedTemplateCandidate | null {
  if (!templates.length) return null;
  return templates
    .slice()
    .sort((a, b) => templateRecency(b) - templateRecency(a))[0] ?? null;
}

function isExcludedTemplate(
  template: ScopedTemplateCandidate,
  excluded?: ScopedTemplateExclude
): boolean {
  if (!excluded) return false;
  if (excluded.templateId && String(template._id) === String(excluded.templateId)) {
    return true;
  }
  if (excluded.language) {
    const excludedLanguage = normalizeTemplateLanguageCode(excluded.language);
    if (excludedLanguage && normalizeTemplateLanguageCode(template.language) === excludedLanguage) {
      return true;
    }
  }
  return false;
}

export function resolveScopedTemplateCandidate(
  scopedApproved: readonly ScopedTemplateCandidate[],
  requestedLanguage: string | undefined | null,
  allowFallback: boolean,
  excluded?: ScopedTemplateExclude
): { selected: ScopedTemplateCandidate | null; mode: ScopedResolutionMode | null } {
  const requested = normalizeTemplateLanguageCode(requestedLanguage);
  const available = scopedApproved.filter((template) => !isExcludedTemplate(template, excluded));

  if (requested) {
    const exact = latestTemplate(
      available.filter((template) => normalizeTemplateLanguageCode(template.language) === requested)
    );
    if (exact) {
      return { selected: exact, mode: "scoped_exact" };
    }

    if (!allowFallback) return { selected: null, mode: null };

    const requestedFamily = languageFamily(requested);
    const familyMatch = requestedFamily
      ? latestTemplate(
          available.filter((template) => languageFamily(template.language) === requestedFamily)
        )
      : null;
    if (familyMatch) {
      return { selected: familyMatch, mode: "scoped_language_family" };
    }

    return { selected: latestTemplate(available), mode: available.length ? "scoped_latest" : null };
  }

  if (!allowFallback) return { selected: null, mode: null };
  return { selected: latestTemplate(available), mode: available.length ? "scoped_latest" : null };
}

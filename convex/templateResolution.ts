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

export function resolveScopedTemplateCandidate(
  scopedApproved: readonly ScopedTemplateCandidate[],
  requestedLanguage: string | undefined | null,
  allowFallback: boolean
): { selected: ScopedTemplateCandidate | null; mode: ScopedResolutionMode | null } {
  const requested = normalizeTemplateLanguageCode(requestedLanguage);

  if (requested) {
    const exact = latestTemplate(
      scopedApproved.filter((template) => normalizeTemplateLanguageCode(template.language) === requested)
    );
    if (exact) {
      return { selected: exact, mode: "scoped_exact" };
    }

    if (!allowFallback) return { selected: null, mode: null };

    const requestedFamily = languageFamily(requested);
    const familyMatch = requestedFamily
      ? latestTemplate(
          scopedApproved.filter((template) => languageFamily(template.language) === requestedFamily)
        )
      : null;
    if (familyMatch) {
      return { selected: familyMatch, mode: "scoped_language_family" };
    }

    return { selected: latestTemplate(scopedApproved), mode: scopedApproved.length ? "scoped_latest" : null };
  }

  if (!allowFallback) return { selected: null, mode: null };
  return { selected: latestTemplate(scopedApproved), mode: scopedApproved.length ? "scoped_latest" : null };
}

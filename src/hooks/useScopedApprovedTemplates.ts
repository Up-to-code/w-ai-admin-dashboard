"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/mock/convex-api";
import { useOptionalConvexQuery } from "@/hooks/useOptionalConvexQuery";

type ScopedTemplateSource = "scopedApproved" | "listFallback";

export function useScopedApprovedTemplates(phoneNumberId?: string | null): {
  templates: any[];
  loading: boolean;
  unavailable: boolean;
  source: ScopedTemplateSource;
  error?: string;
} {
  const scopedApprovedQuery = useOptionalConvexQuery<any[]>(
    (api as any).templates.listScopedApproved,
    phoneNumberId ? { phoneNumberId } : "skip",
    !!phoneNumberId
  );

  const listFallbackQuery = useQuery(
    api.templates.list as any,
    phoneNumberId ? { phoneNumberId } : "skip"
  ) as any[] | undefined;

  const useFallback = !!phoneNumberId && scopedApprovedQuery.unavailable;

  const templates = useMemo(() => {
    if (!phoneNumberId) return [];
    const sourceRows = useFallback ? listFallbackQuery ?? [] : scopedApprovedQuery.data ?? [];
    return sourceRows.filter((template: any) => {
      const sameNumber = template?.phoneNumberId === phoneNumberId;
      if (!sameNumber) return false;
      if (!useFallback) return true;
      return template?.status === "APPROVED";
    });
  }, [listFallbackQuery, phoneNumberId, scopedApprovedQuery.data, useFallback]);

  const loading = !!phoneNumberId && (useFallback ? listFallbackQuery === undefined : scopedApprovedQuery.loading);

  return {
    templates,
    loading,
    unavailable: useFallback,
    source: useFallback ? "listFallback" : "scopedApproved",
    error: !scopedApprovedQuery.unavailable ? scopedApprovedQuery.error ?? undefined : undefined,
  };
}

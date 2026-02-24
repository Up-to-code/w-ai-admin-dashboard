import { describe, expect, it } from "vitest";
import {
  normalizeTemplateLanguageCode,
  resolveScopedTemplateCandidate,
  type ScopedTemplateCandidate,
} from "./templateResolution";

function candidate(
  id: string,
  language: string,
  lastSyncedAt: number
): ScopedTemplateCandidate {
  return {
    _id: id,
    name: "product_offers_list_copy",
    language,
    status: "APPROVED",
    phoneNumberId: "1234567890",
    lastSyncedAt,
    _creationTime: lastSyncedAt - 1000,
  };
}

describe("template resolution helpers", () => {
  it("normalizes language tags", () => {
    expect(normalizeTemplateLanguageCode("AR-eg")).toBe("ar_eg");
  });

  it("selects exact language match when available", () => {
    const templates = [candidate("a", "en", 10), candidate("b", "ar", 20)];
    const result = resolveScopedTemplateCandidate(templates, "ar", false);
    expect(result.mode).toBe("scoped_exact");
    expect(result.selected?._id).toBe("b");
  });

  it("falls back to same language family for 132001-style locale mismatch", () => {
    const templates = [candidate("a", "ar_EG", 10), candidate("b", "en_US", 20)];
    const result = resolveScopedTemplateCandidate(templates, "ar", true);
    expect(result.mode).toBe("scoped_language_family");
    expect(result.selected?.language).toBe("ar_EG");
  });

  it("falls back to latest approved template when requested language is missing", () => {
    const templates = [candidate("old", "en", 10), candidate("new", "ar", 30)];
    const result = resolveScopedTemplateCandidate(templates, undefined, true);
    expect(result.mode).toBe("scoped_latest");
    expect(result.selected?._id).toBe("new");
  });

  it("returns null without fallback", () => {
    const templates = [candidate("a", "en", 10)];
    const result = resolveScopedTemplateCandidate(templates, "ar", false);
    expect(result.mode).toBeNull();
    expect(result.selected).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { buildIdentityLockPrompt } from "./agent";

describe("buildIdentityLockPrompt", () => {
  it("includes strict business lock with provided business data", () => {
    const prompt = buildIdentityLockPrompt({
      phoneNumberId: "1029453556909294",
      businessName: "CRAFT",
      businessPhone: "+966 57 370 7300",
    });

    expect(prompt).toContain('ONLY "CRAFT"');
    expect(prompt).toContain('+966 57 370 7300');
    expect(prompt).toContain("1029453556909294");
    expect(prompt).toContain("Never claim to be another company");
  });

  it("falls back safely when business metadata is missing", () => {
    const prompt = buildIdentityLockPrompt({});
    expect(prompt).toContain("this business");
    expect(prompt).toContain("unknown");
  });
});


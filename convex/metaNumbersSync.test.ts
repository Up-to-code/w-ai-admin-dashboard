import { describe, expect, it } from "vitest";
import { buildMetaSyncPlan, normalizeNumericId } from "./metaNumbersSync";

describe("normalizeNumericId", () => {
  it("removes leading plus and trims spaces", () => {
    expect(normalizeNumericId(" +12345 ")).toBe("12345");
  });

  it("returns empty string for missing values", () => {
    expect(normalizeNumericId(undefined)).toBe("");
    expect(normalizeNumericId("")).toBe("");
  });
});

describe("buildMetaSyncPlan", () => {
  it("creates inserts for discovered numbers missing in db", () => {
    const plan = buildMetaSyncPlan(
      [],
      [
        {
          id: "1029453556909294",
          display_phone_number: "+966 57 370 7300",
          verified_name: "Shift 1",
          businessAccountId: "25677081465246302",
        },
        {
          id: "986472521212984",
          display_phone_number: "+966 57 358 5358",
          verified_name: "Shift 2",
          businessAccountId: "25677081465246302",
        },
      ]
    );

    expect(plan.inserts).toHaveLength(2);
    expect(plan.patches).toHaveLength(0);
    expect(plan.inserts.map((n) => n.businessNumberId)).toEqual([
      "1029453556909294",
      "986472521212984",
    ]);
  });

  it("creates patch when existing row has placeholder values", () => {
    const plan = buildMetaSyncPlan(
      [
        {
          businessNumberId: "986472521212984",
          businessAccountId: "25677081465246302",
          phone: "+986472521212984",
          name: "WhatsApp 2984",
        },
      ],
      [
        {
          id: "986472521212984",
          display_phone_number: "+966 57 358 5358",
          verified_name: "Shift 2",
          businessAccountId: "25677081465246302",
        },
      ]
    );

    expect(plan.inserts).toHaveLength(0);
    expect(plan.patches).toHaveLength(1);
    expect(plan.patches[0]).toEqual({
      businessNumberId: "986472521212984",
      patch: {
        phone: "+966 57 358 5358",
        name: "Shift 2",
      },
    });
  });

  it("de-duplicates discovered ids", () => {
    const plan = buildMetaSyncPlan(
      [],
      [
        {
          id: "986472521212984",
          display_phone_number: "+966 57 358 5358",
          verified_name: "Shift 2",
          businessAccountId: "25677081465246302",
        },
        {
          id: "986472521212984",
          display_phone_number: "+966 57 358 5358",
          verified_name: "Shift 2",
          businessAccountId: "25677081465246302",
        },
      ]
    );

    expect(plan.inserts).toHaveLength(1);
    expect(plan.patches).toHaveLength(0);
  });
});

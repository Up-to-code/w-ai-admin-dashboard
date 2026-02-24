import { describe, expect, it } from "vitest";
import { normalizePhoneForComparison } from "./phoneNormalization";

describe("normalizePhoneForComparison", () => {
  it("normalizes 201015638178 in both plain and + formats", () => {
    expect(normalizePhoneForComparison("201015638178")).toBe("201015638178");
    expect(normalizePhoneForComparison("+201015638178")).toBe("201015638178");
  });

  it("normalizes 20145638178 in both plain and + formats", () => {
    expect(normalizePhoneForComparison("20145638178")).toBe("20145638178");
    expect(normalizePhoneForComparison("+20145638178")).toBe("20145638178");
  });

  it("strips separators consistently", () => {
    expect(normalizePhoneForComparison("+20 145-638-178")).toBe("20145638178");
  });
});

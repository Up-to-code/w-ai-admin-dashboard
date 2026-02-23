import { describe, expect, it } from "vitest";
import {
  categorizeWhatsAppError,
  validateAndCleanPhoneNumber,
  shouldRetry,
} from "./errorUtils";

describe("categorizeWhatsAppError", () => {
  it("returns known error for 131030 (test mode phone not allowed)", () => {
    const result = categorizeWhatsAppError(
      131030,
      "Recipient phone number not in allowed list"
    );
    expect(result.code).toBe(131030);
    expect(result.category).toBe("PHONE_NOT_ALLOWED");
    expect(result.retryable).toBe(false);
  });

  it("returns known error for 132012 (template parameter mismatch)", () => {
    const result = categorizeWhatsAppError(132012, "Parameter format mismatch");
    expect(result.code).toBe(132012);
    expect(result.category).toBe("TEMPLATE_FORMAT");
  });

  it("returns known error for 401 (auth)", () => {
    const result = categorizeWhatsAppError(401, "Invalid access token");
    expect(result.code).toBe(401);
    expect(result.category).toBe("AUTH_ERROR");
  });

  it("returns known retryable error for 500", () => {
    const result = categorizeWhatsAppError(500, "Internal server error");
    expect(result.retryable).toBe(true);
    expect(result.category).toBe("NETWORK_ERROR");
  });

  it("returns unknown error with OTHER category for unmapped codes", () => {
    const result = categorizeWhatsAppError(999999, "Custom error");
    expect(result.code).toBe(999999);
    expect(result.category).toBe("OTHER");
    expect(result.name).toBe("Unknown error");
    expect(result.retryable).toBe(true);
  });
});

describe("validateAndCleanPhoneNumber", () => {
  it("strips non-digits and returns clean number", () => {
    expect(validateAndCleanPhoneNumber("+20 123 456 7890")).toBe("201234567890");
    expect(validateAndCleanPhoneNumber("(555) 123-4567")).toBe("5551234567");
  });

  it("accepts valid 7-digit minimum", () => {
    expect(validateAndCleanPhoneNumber("1234567")).toBe("1234567");
  });

  it("accepts valid 15-digit maximum", () => {
    expect(validateAndCleanPhoneNumber("123456789012345")).toBe("123456789012345");
  });

  it("throws for too few digits", () => {
    expect(() => validateAndCleanPhoneNumber("123456")).toThrow(/Minimum 7 digits/);
    expect(() => validateAndCleanPhoneNumber("")).toThrow(/Minimum 7 digits/);
  });

  it("throws for too many digits", () => {
    expect(() => validateAndCleanPhoneNumber("1234567890123456")).toThrow(/Maximum 15 digits/);
  });

  it("throws when only non-digits remain", () => {
    expect(() => validateAndCleanPhoneNumber("abc-def-ghij")).toThrow(/Minimum 7 digits/);
  });
});

describe("shouldRetry", () => {
  it("uses error.retryable when present", () => {
    expect(shouldRetry(Object.assign(new Error("x"), { retryable: true }))).toBe(true);
    expect(shouldRetry(Object.assign(new Error("x"), { retryable: false }))).toBe(false);
  });

  it("falls back to categorizeWhatsAppError when retryable not set", () => {
    expect(shouldRetry(Object.assign(new Error("x"), { code: 500 }))).toBe(true);
    expect(shouldRetry(Object.assign(new Error("x"), { code: 131030 }))).toBe(false);
  });
});

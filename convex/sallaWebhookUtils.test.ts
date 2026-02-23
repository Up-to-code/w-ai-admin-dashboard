import { describe, expect, it } from "vitest";
import { extractBearerToken, extractSallaEventType, resolveSallaWebhookToken } from "./sallaWebhookUtils";

describe("extractBearerToken", () => {
  it("extracts bearer token case-insensitively", () => {
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
    expect(extractBearerToken("bearer xyz")).toBe("xyz");
  });

  it("returns null for invalid authorization format", () => {
    expect(extractBearerToken("Token abc123")).toBeNull();
    expect(extractBearerToken(null)).toBeNull();
  });
});

describe("resolveSallaWebhookToken", () => {
  it("prefers bearer token over other token locations", () => {
    expect(
      resolveSallaWebhookToken({
        authorizationHeader: "Bearer from-auth",
        xSallaTokenHeader: "from-header",
        queryToken: "from-query",
      })
    ).toBe("from-auth");
  });

  it("falls back to x-salla-token then query token", () => {
    expect(
      resolveSallaWebhookToken({
        authorizationHeader: null,
        xSallaTokenHeader: "from-header",
        queryToken: "from-query",
      })
    ).toBe("from-header");

    expect(
      resolveSallaWebhookToken({
        authorizationHeader: null,
        xSallaTokenHeader: null,
        queryToken: "from-query",
      })
    ).toBe("from-query");
  });
});

describe("extractSallaEventType", () => {
  it("extracts event type from known keys", () => {
    expect(extractSallaEventType({ event: "order.created" })).toBe("order.created");
    expect(extractSallaEventType({ type: "order.updated" })).toBe("order.updated");
    expect(extractSallaEventType({ name: "shipment.created" })).toBe("shipment.created");
  });

  it("returns undefined for unknown payload", () => {
    expect(extractSallaEventType({})).toBeUndefined();
    expect(extractSallaEventType(null)).toBeUndefined();
  });
});

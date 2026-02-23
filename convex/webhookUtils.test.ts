import { describe, expect, it } from "vitest";
import { extractWebhookChanges, resolvePhoneNumberCandidate } from "./webhookUtils";

describe("extractWebhookChanges", () => {
  it("extracts all changes across all entries", () => {
    const body = {
      entry: [
        { id: "entry-1", changes: [{ field: "messages", value: { id: "a" } }] },
        { id: "entry-2", changes: [{ field: "messages", value: { id: "b" } }, { field: "statuses", value: { id: "c" } }] },
      ],
    };

    const changes = extractWebhookChanges(body);
    expect(changes).toHaveLength(3);
    expect(changes.map((c) => c.field)).toEqual(["messages", "messages", "statuses"]);
    expect(changes.map((c) => c.entryId)).toEqual(["entry-1", "entry-2", "entry-2"]);
  });

  it("returns empty array for malformed payloads", () => {
    expect(extractWebhookChanges({})).toEqual([]);
    expect(extractWebhookChanges({ entry: null })).toEqual([]);
  });

  it("extracts status-only payloads so they are auditable", () => {
    const body = {
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                statuses: [{ id: "wamid.1", status: "delivered" }],
              },
            },
          ],
        },
      ],
    };
    const changes = extractWebhookChanges(body);
    expect(changes).toHaveLength(1);
    expect(changes[0].field).toBe("messages");
    expect(changes[0].value?.statuses?.[0]?.id).toBe("wamid.1");
  });

  it("keeps change when entry id is missing", () => {
    const changes = extractWebhookChanges({
      entry: [{ changes: [{ field: "messages", value: { id: "a" } }] }],
    });
    expect(changes).toHaveLength(1);
    expect(changes[0].entryId).toBeUndefined();
  });
});

describe("resolvePhoneNumberCandidate", () => {
  it("prefers incoming phone_number_id", () => {
    expect(resolvePhoneNumberCandidate("inbound-id", "default-id", "first-id")).toEqual({
      phoneNumberId: "inbound-id",
      usedFallback: false,
    });
  });

  it("falls back to configured default number", () => {
    expect(resolvePhoneNumberCandidate(undefined, "default-id", "first-id")).toEqual({
      phoneNumberId: "default-id",
      usedFallback: true,
    });
  });

  it("falls back to first available number when default missing", () => {
    expect(resolvePhoneNumberCandidate(undefined, undefined, "first-id")).toEqual({
      phoneNumberId: "first-id",
      usedFallback: true,
    });
  });

  it("returns undefined when no candidates exist", () => {
    expect(resolvePhoneNumberCandidate(undefined, undefined, undefined)).toEqual({
      phoneNumberId: undefined,
      usedFallback: true,
    });
  });

  it("treats empty string as missing", () => {
    expect(resolvePhoneNumberCandidate("", "default-id", "first-id")).toEqual({
      phoneNumberId: "default-id",
      usedFallback: true,
    });
  });

  it("treats whitespace-only as missing", () => {
    expect(resolvePhoneNumberCandidate("   ", undefined, "first-id")).toEqual({
      phoneNumberId: "first-id",
      usedFallback: true,
    });
  });

  it("accepts incoming number with extra whitespace", () => {
    expect(resolvePhoneNumberCandidate("  inbound-id  ", "default-id", "first-id")).toEqual({
      phoneNumberId: "inbound-id",
      usedFallback: false,
    });
  });
});

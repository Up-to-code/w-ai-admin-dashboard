import { describe, expect, it } from "vitest";
import {
  isBypassedTestContact,
  normalizeTestContactPhones,
} from "./campaignTestContacts";

describe("campaign test contacts", () => {
  it("normalizes test phones for campaign creation", () => {
    expect(normalizeTestContactPhones(["+201015638178", "201015638178"])).toEqual([
      "201015638178",
      "201015638178",
    ]);
  });

  it("matches bypass contact in both formats for 201015638178", () => {
    expect(
      isBypassedTestContact(true, ["+201015638178"], "201015638178")
    ).toBe(true);
    expect(
      isBypassedTestContact(true, ["201015638178"], "+201015638178")
    ).toBe(true);
  });

  it("does not bypass when not in allow list or bypass disabled", () => {
    expect(
      isBypassedTestContact(false, ["201015638178"], "201015638178")
    ).toBe(false);
    expect(
      isBypassedTestContact(true, ["201015638178"], "201011111111")
    ).toBe(false);
  });
});

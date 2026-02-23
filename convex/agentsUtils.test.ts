import { describe, expect, test } from "vitest";
import { DEFAULT_TOOLS_ENABLED, isToolAllowed, normalizeToolsEnabled } from "./agentsUtils";

describe("agentsUtils", () => {
  test("normalizeToolsEnabled falls back to defaults when empty", () => {
    expect(normalizeToolsEnabled(undefined)).toEqual(DEFAULT_TOOLS_ENABLED);
    expect(normalizeToolsEnabled([])).toEqual(DEFAULT_TOOLS_ENABLED);
  });

  test("normalizeToolsEnabled filters unknown values", () => {
    expect(normalizeToolsEnabled(["send_text", "invalid_tool", "send_product"])).toEqual([
      "send_text",
      "send_product",
    ]);
  });

  test("isToolAllowed respects enabled tool list", () => {
    expect(isToolAllowed(["send_text", "send_link"], "send_text")).toBe(true);
    expect(isToolAllowed(["send_text", "send_link"], "send_product")).toBe(false);
  });
});

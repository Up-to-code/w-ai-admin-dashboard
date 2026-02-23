import { describe, expect, it } from "vitest";
import { normalizeRuntimeEventInput } from "./mobileRuntimeEvents";

describe("normalizeRuntimeEventInput", () => {
  it("applies defaults for missing fields", () => {
    const normalized = normalizeRuntimeEventInput({});
    expect(normalized.source).toBe("mobile");
    expect(normalized.severity).toBe("error");
    expect(normalized.eventName).toBe("unknown_event");
  });

  it("trims and truncates long fields", () => {
    const normalized = normalizeRuntimeEventInput({
      eventName: "  startup_crash  ",
      message: "a".repeat(6000),
      stack: "b".repeat(15000),
      phase: " ".repeat(2) + "boot_phase",
    });

    expect(normalized.eventName).toBe("startup_crash");
    expect(normalized.message?.length).toBe(5000);
    expect(normalized.stack?.length).toBe(12000);
    expect(normalized.phase).toBe("boot_phase");
  });

  it("falls back to unknown_event when eventName is blank", () => {
    const normalized = normalizeRuntimeEventInput({
      eventName: "   ",
      severity: "fatal",
    });

    expect(normalized.eventName).toBe("unknown_event");
    expect(normalized.severity).toBe("fatal");
  });
});

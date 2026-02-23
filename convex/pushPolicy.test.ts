import { describe, expect, it } from "vitest";
import { shouldSendHumanEscalationPush } from "./pushPolicy";

describe("shouldSendHumanEscalationPush", () => {
  it("returns false when no human attention is needed", () => {
    expect(
      shouldSendHumanEscalationPush({
        needsHumanAttention: false,
        hasActiveHumanViewer: false,
        settings: {
          humanHandoffPushEnabled: true,
          suppressPushWhenChatActive: true,
        },
      })
    ).toBe(false);
  });

  it("returns false when human handoff push is disabled", () => {
    expect(
      shouldSendHumanEscalationPush({
        needsHumanAttention: true,
        hasActiveHumanViewer: false,
        settings: {
          humanHandoffPushEnabled: false,
          suppressPushWhenChatActive: true,
        },
      })
    ).toBe(false);
  });

  it("returns false when chat is actively viewed and suppression is enabled", () => {
    expect(
      shouldSendHumanEscalationPush({
        needsHumanAttention: true,
        hasActiveHumanViewer: true,
        settings: {
          humanHandoffPushEnabled: true,
          suppressPushWhenChatActive: true,
        },
      })
    ).toBe(false);
  });

  it("returns true when human attention is needed and no active viewer exists", () => {
    expect(
      shouldSendHumanEscalationPush({
        needsHumanAttention: true,
        hasActiveHumanViewer: false,
        settings: {
          humanHandoffPushEnabled: true,
          suppressPushWhenChatActive: true,
        },
      })
    ).toBe(true);
  });

  it("returns true when suppression is disabled even if a viewer is active", () => {
    expect(
      shouldSendHumanEscalationPush({
        needsHumanAttention: true,
        hasActiveHumanViewer: true,
        settings: {
          humanHandoffPushEnabled: true,
          suppressPushWhenChatActive: false,
        },
      })
    ).toBe(true);
  });
});

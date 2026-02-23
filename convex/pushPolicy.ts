export type HumanEscalationPushSettings = {
  humanHandoffPushEnabled: boolean;
  suppressPushWhenChatActive: boolean;
};

export type HumanEscalationPushInput = {
  needsHumanAttention: boolean;
  hasActiveHumanViewer: boolean;
  settings: HumanEscalationPushSettings;
};

export function shouldSendHumanEscalationPush(input: HumanEscalationPushInput): boolean {
  if (!input.needsHumanAttention) return false;
  if (!input.settings.humanHandoffPushEnabled) return false;
  if (input.settings.suppressPushWhenChatActive && input.hasActiveHumanViewer) return false;
  return true;
}

const MAX_MESSAGE_LEN = 5000;
const MAX_STACK_LEN = 12000;
const MAX_EVENT_NAME_LEN = 120;
const MAX_PHASE_LEN = 120;

type RuntimeSeverity = "info" | "warning" | "error" | "fatal";

export function normalizeRuntimeEventInput(input: {
  source?: "mobile" | "synthetic";
  platform?: string;
  appVersion?: string;
  buildId?: string;
  jsEngine?: string;
  eventName?: string;
  severity?: RuntimeSeverity;
  message?: string;
  stack?: string;
  phase?: string;
  metadata?: unknown;
}) {
  const asTrimmed = (value?: string, max = 200): string | undefined => {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return trimmed.slice(0, max);
  };

  return {
    source: input.source ?? "mobile",
    platform: asTrimmed(input.platform, 64),
    appVersion: asTrimmed(input.appVersion, 64),
    buildId: asTrimmed(input.buildId, 128),
    jsEngine: asTrimmed(input.jsEngine, 32),
    eventName: asTrimmed(input.eventName, MAX_EVENT_NAME_LEN) ?? "unknown_event",
    severity: (input.severity ?? "error") as RuntimeSeverity,
    message: asTrimmed(input.message, MAX_MESSAGE_LEN),
    stack: asTrimmed(input.stack, MAX_STACK_LEN),
    phase: asTrimmed(input.phase, MAX_PHASE_LEN),
    metadata: input.metadata ?? undefined,
  };
}

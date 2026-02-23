export const TOOL_NAMES = [
  "send_text",
  "send_image",
  "send_link",
  "send_audio",
  "send_product",
  "transfer_to_human",
] as const;

export type AgentToolName = (typeof TOOL_NAMES)[number];

export const DEFAULT_TOOLS_ENABLED: AgentToolName[] = [...TOOL_NAMES];

export type AgentFallbackMode = "no_reply" | "text_only" | "human_handoff";

export function normalizeToolsEnabled(value: string[] | undefined): AgentToolName[] {
  if (!value || value.length === 0) return [...DEFAULT_TOOLS_ENABLED];
  const valid = value.filter((tool): tool is AgentToolName =>
    (TOOL_NAMES as readonly string[]).includes(tool)
  );
  return valid.length > 0 ? valid : [...DEFAULT_TOOLS_ENABLED];
}

export function isToolAllowed(enabledTools: string[] | undefined, tool: AgentToolName): boolean {
  return normalizeToolsEnabled(enabledTools).includes(tool);
}

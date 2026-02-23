export type ContextMessage = {
  direction: "inbound" | "outbound";
  type: string;
  content?: string;
};

export type KnowledgeSnippet = {
  title: string;
  content: string;
};

export type BuiltConversationContext = {
  recentMessages: Array<{ role: "user" | "assistant"; content: string }>;
  summaryBlock: string;
  knowledgeBlock: string;
  finalSystemContext: string;
  diagnostics: {
    recentMessagesCount: number;
    summaryChars: number;
    knowledgeSnippetsCount: number;
    knowledgeChars: number;
  };
};

const MAX_MESSAGE_CHARS = 320;
const MAX_SUMMARY_CHARS = 900;
const MAX_KNOWLEDGE_CHARS = 2200;

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}...`;
}

function mediaPlaceholder(type: string): string {
  if (type === "image") return "[Image]";
  if (type === "video") return "[Video]";
  if (type === "audio") return "[Audio]";
  if (type === "document") return "[Document]";
  return "[Message]";
}

function normalizeRecentMessages(messages: ContextMessage[]): Array<{ role: "user" | "assistant"; content: string }> {
  // messages are expected newest-first; we enforce last-5 and oldest->newest order.
  const latest = messages.slice(0, 5).reverse();
  return latest.map((msg) => {
    const raw = (msg.content ?? "").trim();
    const safe = raw.length > 0 ? raw : mediaPlaceholder(msg.type);
    return {
      role: msg.direction === "inbound" ? "user" : "assistant",
      content: truncate(safe, MAX_MESSAGE_CHARS),
    };
  });
}

function normalizeSummary(summary: string | undefined): string {
  const s = (summary ?? "").trim();
  if (!s) return "";
  return truncate(s, MAX_SUMMARY_CHARS);
}

function normalizeKnowledge(snippets: KnowledgeSnippet[]): { block: string; usedCount: number; usedChars: number } {
  const seen = new Set<string>();
  const compact: string[] = [];
  let usedChars = 0;
  let usedCount = 0;

  for (const snippet of snippets) {
    const title = (snippet.title ?? "").trim() || "Untitled";
    const content = (snippet.content ?? "").replace(/\s+/g, " ").trim();
    if (!content) continue;
    const fingerprint = `${title.toLowerCase()}::${content.slice(0, 120).toLowerCase()}`;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    const line = `- [${title}] ${truncate(content, 380)}`;
    if (usedChars + line.length > MAX_KNOWLEDGE_CHARS) break;
    compact.push(line);
    usedChars += line.length;
    usedCount += 1;
  }

  return {
    block: compact.length > 0 ? compact.join("\n") : "",
    usedCount,
    usedChars,
  };
}

export function buildConversationContext(input: {
  systemPrompt: string;
  messages: ContextMessage[];
  existingSummary?: string;
  knowledgeSnippets: KnowledgeSnippet[];
}): BuiltConversationContext {
  const recentMessages = normalizeRecentMessages(input.messages);
  const summary = normalizeSummary(input.existingSummary);
  const normalizedKnowledge = normalizeKnowledge(input.knowledgeSnippets);

  const summaryBlock = summary
    ? `ConversationMemory:\n${summary}`
    : "ConversationMemory:\n(No prior summary)";
  const knowledgeBlock = normalizedKnowledge.block
    ? `KnowledgeGrounding:\n${normalizedKnowledge.block}`
    : "KnowledgeGrounding:\n(No relevant knowledge snippets)";

  const finalSystemContext = `${input.systemPrompt}

ResponseRules:
- Prioritize customer intent and most recent conversation turns.
- Use ConversationMemory for continuity, but do not repeat it verbatim.
- Use KnowledgeGrounding only when relevant to the user request.
- Keep responses concise and actionable for chat.

CustomerRecentContext:
${recentMessages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n")}

${summaryBlock}

${knowledgeBlock}`;

  return {
    recentMessages,
    summaryBlock,
    knowledgeBlock,
    finalSystemContext,
    diagnostics: {
      recentMessagesCount: recentMessages.length,
      summaryChars: summary.length,
      knowledgeSnippetsCount: normalizedKnowledge.usedCount,
      knowledgeChars: normalizedKnowledge.usedChars,
    },
  };
}

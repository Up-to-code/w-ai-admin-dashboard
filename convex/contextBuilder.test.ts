import { describe, expect, it } from "vitest";
import { buildConversationContext } from "./contextBuilder";

describe("buildConversationContext", () => {
  it("keeps exactly last 5 messages and orders oldest to newest", () => {
    const messages = [
      { direction: "inbound" as const, type: "text", content: "m6" },
      { direction: "outbound" as const, type: "text", content: "m5" },
      { direction: "inbound" as const, type: "text", content: "m4" },
      { direction: "outbound" as const, type: "text", content: "m3" },
      { direction: "inbound" as const, type: "text", content: "m2" },
      { direction: "outbound" as const, type: "text", content: "m1" },
    ];
    const ctx = buildConversationContext({
      systemPrompt: "sys",
      messages,
      existingSummary: "",
      knowledgeSnippets: [],
    });
    expect(ctx.recentMessages).toHaveLength(5);
    expect(ctx.recentMessages[0].content).toBe("m2");
    expect(ctx.recentMessages[4].content).toBe("m6");
  });

  it("uses media placeholders when message content is empty", () => {
    const ctx = buildConversationContext({
      systemPrompt: "sys",
      messages: [{ direction: "inbound", type: "image", content: "" }],
      existingSummary: "",
      knowledgeSnippets: [],
    });
    expect(ctx.recentMessages[0].content).toBe("[Image]");
  });

  it("deduplicates and budgets knowledge snippets", () => {
    const repeated = "A".repeat(500);
    const ctx = buildConversationContext({
      systemPrompt: "sys",
      messages: [],
      existingSummary: "",
      knowledgeSnippets: [
        { title: "Policy", content: repeated },
        { title: "Policy", content: repeated },
        { title: "Shipping", content: "Fast shipping in 24h." },
      ],
    });
    expect(ctx.diagnostics.knowledgeSnippetsCount).toBe(2);
    expect(ctx.knowledgeBlock).toContain("[Policy]");
    expect(ctx.knowledgeBlock).toContain("[Shipping]");
  });
});

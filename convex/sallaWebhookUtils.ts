export function extractBearerToken(authorizationHeader: string | null): string | null {
  const raw = authorizationHeader?.trim();
  if (!raw) return null;
  const match = raw.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1]?.trim();
  return token && token.length > 0 ? token : null;
}

export function resolveSallaWebhookToken(args: {
  authorizationHeader: string | null;
  xSallaTokenHeader: string | null;
  queryToken: string | null;
}): string | null {
  const bearer = extractBearerToken(args.authorizationHeader);
  if (bearer) return bearer;

  const headerToken = args.xSallaTokenHeader?.trim();
  if (headerToken) return headerToken;

  const queryToken = args.queryToken?.trim();
  if (queryToken) return queryToken;

  return null;
}

export function extractSallaEventType(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const rec = body as Record<string, unknown>;
  if (typeof rec.event === "string" && rec.event.trim()) return rec.event.trim();
  if (typeof rec.type === "string" && rec.type.trim()) return rec.type.trim();
  if (typeof rec.name === "string" && rec.name.trim()) return rec.name.trim();
  return undefined;
}

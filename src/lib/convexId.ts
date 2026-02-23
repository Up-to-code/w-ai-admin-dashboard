export function isLikelyConvexId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9]{8,}$/i.test(value);
}

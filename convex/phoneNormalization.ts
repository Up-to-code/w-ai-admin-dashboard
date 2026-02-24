function toAsciiDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776));
}

/**
 * Normalizes phone input for matching/comparison across import, UI, and send logic.
 * Keeps digits only so +country and plain-digit forms compare equally.
 */
export function normalizePhoneForComparison(raw: string | null | undefined): string {
  return toAsciiDigits(String(raw ?? "")).replace(/\D/g, "");
}

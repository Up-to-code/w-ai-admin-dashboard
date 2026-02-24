import { normalizePhoneForComparison } from "./phoneNormalization";

export function normalizeTestContactPhones(phones: string[] | undefined | null): string[] {
  return Array.from(
    new Set(
      (phones ?? [])
        .map((phone) => normalizePhoneForComparison(phone))
        .filter((phone) => phone.length > 0)
    )
  );
}

function phonesLikelyMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 8 || b.length < 8) return false;
  if (Math.abs(a.length - b.length) > 3) return false;
  return a.endsWith(b) || b.endsWith(a);
}

export function isBypassedTestContact(
  campaignAllowsBypass: boolean,
  testContactPhones: string[] | undefined | null,
  contactPhone: string | undefined | null
): boolean {
  if (!campaignAllowsBypass) return false;
  const normalizedContactPhone = normalizePhoneForComparison(contactPhone);
  if (!normalizedContactPhone) return false;
  return normalizeTestContactPhones(testContactPhones).some(
    (phone) => phonesLikelyMatch(phone, normalizedContactPhone)
  );
}

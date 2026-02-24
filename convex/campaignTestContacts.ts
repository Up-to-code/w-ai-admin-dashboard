import { normalizePhoneForComparison } from "./phoneNormalization";

export function normalizeTestContactPhones(phones: string[] | undefined | null): string[] {
  return (phones ?? [])
    .map((phone) => normalizePhoneForComparison(phone))
    .filter((phone) => phone.length > 0);
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
    (phone) => phone === normalizedContactPhone
  );
}

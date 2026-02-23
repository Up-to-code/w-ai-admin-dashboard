export type ExistingNumberRow = {
  businessNumberId: string;
  businessAccountId: string;
  phone: string;
  name: string;
};

export type DiscoveredMetaNumber = {
  id: string;
  display_phone_number?: string | null;
  verified_name?: string | null;
  businessAccountId: string;
};

export type InsertCandidate = {
  businessNumberId: string;
  businessAccountId: string;
  phone: string;
  name: string;
};

export type PatchCandidate = {
  businessNumberId: string;
  patch: Partial<Pick<ExistingNumberRow, "businessAccountId" | "phone" | "name">>;
};

function trim(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function normalizeNumericId(value: string | null | undefined): string {
  return trim(value).replace(/^\+/, "");
}

function defaultPhoneFromId(id: string): string {
  return `+${id}`;
}

function defaultNameFromId(id: string): string {
  return `WhatsApp ${id.slice(-4)}`;
}

function normalizePhoneDisplay(value: string | null | undefined, id: string): string {
  const v = trim(value);
  return v.length > 0 ? v : defaultPhoneFromId(id);
}

function normalizeName(value: string | null | undefined, id: string): string {
  const v = trim(value);
  return v.length > 0 ? v : defaultNameFromId(id);
}

export function buildMetaSyncPlan(
  existingRows: ExistingNumberRow[],
  discoveredRows: DiscoveredMetaNumber[]
): { inserts: InsertCandidate[]; patches: PatchCandidate[] } {
  const existingById = new Map<string, ExistingNumberRow>();
  for (const row of existingRows) {
    const id = normalizeNumericId(row.businessNumberId);
    if (!id) continue;
    existingById.set(id, row);
  }

  const discoveredById = new Map<string, DiscoveredMetaNumber>();
  for (const row of discoveredRows) {
    const id = normalizeNumericId(row.id);
    if (!id) continue;
    if (!discoveredById.has(id)) {
      discoveredById.set(id, row);
    }
  }

  const inserts: InsertCandidate[] = [];
  const patches: PatchCandidate[] = [];

  for (const [businessNumberId, discovered] of discoveredById.entries()) {
    const phone = normalizePhoneDisplay(discovered.display_phone_number, businessNumberId);
    const name = normalizeName(discovered.verified_name, businessNumberId);
    const existing = existingById.get(businessNumberId);

    if (!existing) {
      inserts.push({
        businessNumberId,
        businessAccountId: normalizeNumericId(discovered.businessAccountId),
        phone,
        name,
      });
      continue;
    }

    const patch: PatchCandidate["patch"] = {};
    const existingWaba = normalizeNumericId(existing.businessAccountId);
    const nextWaba = normalizeNumericId(discovered.businessAccountId);
    if (nextWaba && existingWaba !== nextWaba) patch.businessAccountId = nextWaba;

    const existingPhone = trim(existing.phone);
    if (phone && phone !== existingPhone) patch.phone = phone;

    const existingName = trim(existing.name);
    const existingIsPlaceholder =
      existingName.length === 0 || existingName.toLowerCase().startsWith("whatsapp ");
    if (name && (existingIsPlaceholder || existingName !== name)) patch.name = name;

    if (Object.keys(patch).length > 0) {
      patches.push({ businessNumberId, patch });
    }
  }

  return { inserts, patches };
}

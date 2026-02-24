import { describe, expect, it } from "vitest";
import { resolveMutation, resolveQuery } from "./backend";

type PhoneNumberRow = {
  businessNumberId: string;
  name: string;
};

type ContactRow = {
  _id: string;
  phone: string;
};

describe("mock campaign create across numbers for test contact 201015638178", () => {
  it("creates campaigns for each sending number targeting the test contact", async () => {
    const numbers = (resolveQuery({ __path: "whatsappNumbers.list" }, {}) ?? []) as PhoneNumberRow[];
    expect(numbers.length).toBeGreaterThan(0);

    const contacts = (resolveQuery({ __path: "contacts.list" }, {}) ?? []) as ContactRow[];
    const testContact = contacts.find((contact) => contact.phone === "201015638178");
    expect(testContact?._id).toBeTruthy();

    for (let index = 0; index < numbers.length; index += 1) {
      const number = numbers[index];
      const format = index % 2 === 0 ? "201015638178" : "+201015638178";

      const createdId = await resolveMutation(
        { __path: "campaigns.create" },
        {
          name: `Test campaign ${number.name}`,
          templateName: "product_offers_list_copy",
          templateLanguage: "ar",
          phoneNumberId: number.businessNumberId,
          selectedContactIds: [testContact!._id],
          isTestCampaign: true,
          testBypassRecentContact: true,
          testContactPhones: [format],
          scheduledAt: Date.now(),
        }
      );

      expect(typeof createdId).toBe("string");
    }

    const createdByNumber = (resolveQuery({ __path: "campaigns.list" }, {}) ?? []) as Array<{
      _id: string;
      phoneNumberId: string;
      audienceCount?: number;
      name?: string;
    }>;

    for (const number of numbers) {
      const createdForNumber = createdByNumber.find(
        (campaign) =>
          campaign.phoneNumberId === number.businessNumberId &&
          String(campaign.name ?? "").startsWith("Test campaign ")
      );
      expect(createdForNumber?._id).toBeTruthy();
      expect(createdForNumber?.audienceCount).toBe(1);
    }
  });
});

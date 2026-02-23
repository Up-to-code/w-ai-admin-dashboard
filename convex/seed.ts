import { mutation } from "./_generated/server";

/** One-time backfill: set phoneNumberId on all chats that don't have it (to current WHATSAPP_PHONE_ID). Run from Convex dashboard. */
export const backfillChatPhoneNumberIds = mutation({
  handler: async (ctx) => {
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    if (!phoneId) throw new Error("WHATSAPP_PHONE_ID not set.");
    const chats = await ctx.db.query("chats").collect();
    let updated = 0;
    for (const chat of chats) {
      if (chat.phoneNumberId === undefined || chat.phoneNumberId === null || chat.phoneNumberId === "") {
        await ctx.db.patch(chat._id, { phoneNumberId: phoneId });
        updated++;
      }
    }
    return { updated, total: chats.length };
  },
});

export const seedContacts = mutation({
  handler: async (ctx) => {
    const contacts = [];
    for (let i = 0; i < 1000; i++) {
      const isVip = Math.random() > 0.8;
      contacts.push({
        name: `Test User ${i}`,
        phone: `201${String(i).padStart(9, '0')}`, // Dummy numbers
        email: `user${i}@example.com`,
        tags: isVip ? ["vip", "test"] : ["test"],
      });
    }

    // Insert in batches of 100
    for (let i = 0; i < contacts.length; i += 100) {
      const batch = contacts.slice(i, i + 100);
      await Promise.all(batch.map(c => ctx.db.insert("contacts", {
        ...c,
        isSubscribed: true,
        createdAt: Date.now()
      })));
    }

    return "Seeded 1000 contacts";
  }
});

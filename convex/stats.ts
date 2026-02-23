import { query } from "./_generated/server";
import { v } from "convex/values";

export const getDashboardStats = query({
    args: { phoneNumberId: v.optional(v.union(v.string(), v.null())) },
    handler: async (ctx, args) => {
        const phoneNumberId = args.phoneNumberId ?? undefined;
        // Get chats for this phone number to filter messages
        let chatIds: Set<string> | null = null;
        if (phoneNumberId) {
            const chats = await ctx.db
                .query("chats")
                .withIndex("by_phoneNumberId_last_message", (q) => q.eq("phoneNumberId", phoneNumberId))
                .collect();
            chatIds = new Set(chats.map(c => c._id));
        }

        // Parallel Fetching for Best Performance
        const [
            allContacts,
            allMessages,
            allCampaigns,
            allChats
        ] = await Promise.all([
            ctx.db.query("contacts").collect(),
            ctx.db.query("messages").collect(),
            phoneNumberId
                ? ctx.db.query("campaigns").withIndex("by_phone_number_id", (q) => q.eq("phoneNumberId", phoneNumberId)).collect()
                : ctx.db.query("campaigns").collect(),
            phoneNumberId
                ? ctx.db.query("chats").withIndex("by_phoneNumberId_last_message", (q) => q.eq("phoneNumberId", phoneNumberId)).collect()
                : ctx.db.query("chats").collect()
        ]);

        // Filter messages by chatIds if phoneNumberId is specified
        const filteredMessages = chatIds
            ? allMessages.filter(m => chatIds!.has(m.chatId))
            : allMessages;

        // Filter contacts to those with chats for this number
        const contactPhones = new Set(allChats.map(c => c.contactPhone));
        const filteredContacts = phoneNumberId
            ? allContacts.filter(c => contactPhones.has(c.phone))
            : allContacts;

        // Get recent messages (filtered)
        const recentMessages = filteredMessages
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 5);

        // Format Recent Activity from Messages
        const recentActivity = await Promise.all(recentMessages.map(async (msg) => {
            const chat = await ctx.db.get(msg.chatId);
            return {
                id: msg._id,
                type: "message",
                user: chat?.contactName || "Unknown",
                action: msg.direction === "inbound" ? "أرسل رسالة جديدة" : "تم إرسال رسالة",
                time: msg._creationTime,
                icon: "MessageSquare",
                color: "primary"
            };
        }));

        // Real Chart Data (Last 7 Days)
        const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
        const today = new Date();
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(today.getDate() - (6 - i));
            return d;
        });

        const chartData = last7Days.map(date => {
            const dayStart = new Date(date.setHours(0, 0, 0, 0)).getTime();
            const dayEnd = new Date(date.setHours(23, 59, 59, 999)).getTime();

            return {
                day: dayNames[date.getDay()],
                messages: filteredMessages.filter(m => m.timestamp >= dayStart && m.timestamp <= dayEnd).length,
                campaigns: allCampaigns.filter(c => c.createdAt >= dayStart && c.createdAt <= dayEnd).length
            };
        });

        // Calculate Rates (using filtered messages)
        const sentMessages = filteredMessages.filter(m => m.direction === "outbound" && m.status !== "failed").length;
        const totalOutbound = filteredMessages.filter(m => m.direction === "outbound").length;
        const deliveryRate = totalOutbound > 0 ? (sentMessages / totalOutbound) * 100 : 0;

        const readMessages = filteredMessages.filter(m => m.status === "read").length;
        const readRate = totalOutbound > 0 ? (readMessages / totalOutbound) * 100 : 0;

        return {
            totalContacts: filteredContacts.length,
            totalMessages: filteredMessages.length,
            totalCampaigns: allCampaigns.length,
            deliveryRate,
            readRate,
            recentActivity,
            chartData
        };
    },
});

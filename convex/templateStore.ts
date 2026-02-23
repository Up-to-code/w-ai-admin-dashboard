import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// E-commerce default templates (Arabic only; components + formSnapshot for pre-fill)
const DEFAULT_TEMPLATES = [
  {
    name: "product_offer",
    language: "ar",
    category: "MARKETING",
    description: "عرض منتج أو ترويجي مع متغير وزر رابط.",
    tags: ["product", "marketing", "offer"],
    isDefault: true,
    components: [
      {
        type: "BODY",
        text: "اطّلع على عرضنا: {{1}}. المزيد عبر الرابط أدناه.",
      },
      { type: "FOOTER", text: "عرض لفترة محدودة." },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "عرض المنتج",
            url: "https://example.com/product",
            example: ["https://example.com/product"],
          },
        ],
      },
    ],
    formSnapshot: {
      templateType: "STANDARD",
      headerType: "NONE",
      bodyText: "اطّلع على عرضنا: {{1}}. المزيد عبر الرابط أدناه.",
      footerText: "عرض لفترة محدودة.",
      buttons: [
        {
          type: "URL",
          text: "عرض المنتج",
          url: "https://example.com/product",
          example: "https://example.com/product",
        },
      ],
    },
  },
  {
    name: "product_offers_list",
    language: "ar",
    category: "MARKETING",
    description: "قائمة عروض المنتجات مع زر عرض كل العروض.",
    tags: ["product", "list", "marketing"],
    isDefault: true,
    components: [
      {
        type: "BODY",
        text: "عروضنا هذا الأسبوع:\n• عرض 1\n• عرض 2\n• عرض 3\nلا تفوّت الفرصة!",
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "عرض كل العروض",
            url: "https://example.com/offers",
            example: ["https://example.com/offers"],
          },
        ],
      },
    ],
    formSnapshot: {
      templateType: "STANDARD",
      headerType: "NONE",
      bodyText: "عروضنا هذا الأسبوع:\n• عرض 1\n• عرض 2\n• عرض 3\nلا تفوّت الفرصة!",
      footerText: "",
      buttons: [
        {
          type: "URL",
          text: "عرض كل العروض",
          url: "https://example.com/offers",
          example: "https://example.com/offers",
        },
      ],
    },
  },
  {
    name: "order_confirmation",
    language: "ar",
    category: "UTILITY",
    description: "تأكيد استلام الطلب مع أزرار تتبع والتواصل.",
    tags: ["order", "utility"],
    isDefault: true,
    components: [
      {
        type: "BODY",
        text: "تم استلام طلبك رقم {{1}}. سنتصل بك قريباً.",
      },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "تتبع الطلب" },
          { type: "QUICK_REPLY", text: "التواصل معنا" },
        ],
      },
    ],
    formSnapshot: {
      templateType: "STANDARD",
      headerType: "NONE",
      bodyText: "تم استلام طلبك رقم {{1}}. سنتصل بك قريباً.",
      footerText: "",
      buttons: [
        { type: "QUICK_REPLY", text: "تتبع الطلب" },
        { type: "QUICK_REPLY", text: "التواصل معنا" },
      ],
    },
  },
  {
    name: "catalog_link",
    language: "ar",
    category: "MARKETING",
    description: "رابط لتصفح الكتالوج واختيار المنتجات.",
    tags: ["catalog", "product"],
    isDefault: true,
    components: [
      {
        type: "BODY",
        text: "تصفّح كتالوجنا واختر ما يناسبك.",
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "عرض الكتالوج",
            url: "https://example.com/catalog",
            example: ["https://example.com/catalog"],
          },
        ],
      },
    ],
    formSnapshot: {
      templateType: "STANDARD",
      headerType: "NONE",
      bodyText: "تصفّح كتالوجنا واختر ما يناسبك.",
      footerText: "",
      buttons: [
        {
          type: "URL",
          text: "عرض الكتالوج",
          url: "https://example.com/catalog",
          example: "https://example.com/catalog",
        },
      ],
    },
  },
  {
    name: "thank_you",
    language: "ar",
    category: "UTILITY",
    description: "رسالة شكر بعد الشراء مع زر تقييم الخدمة.",
    tags: ["thanks", "feedback", "order"],
    isDefault: true,
    components: [
      { type: "BODY", text: "شكراً لثقتك بنا! نتمنى لك تجربة رائعة. تقييمك يهمنا." },
      { type: "FOOTER", text: "فريق الخدمة" },
      {
        type: "BUTTONS",
        buttons: [{ type: "QUICK_REPLY", text: "تقييم الخدمة" }],
      },
    ],
    formSnapshot: {
      templateType: "STANDARD",
      headerType: "NONE",
      bodyText: "شكراً لثقتك بنا! نتمنى لك تجربة رائعة. تقييمك يهمنا.",
      footerText: "فريق الخدمة",
      buttons: [{ type: "QUICK_REPLY", text: "تقييم الخدمة" }],
    },
  },
  {
    name: "discount_code",
    language: "ar",
    category: "MARKETING",
    description: "إرسال كود خصم للعميل مع تاريخ الصلاحية.",
    tags: ["discount", "marketing", "offer"],
    isDefault: true,
    components: [
      {
        type: "BODY",
        text: "كود خصمك الحصري: {{1}}\nصالح حتى {{2}}. استخدمه عند الدفع!",
      },
      { type: "FOOTER", text: "عرض لفترة محدودة" },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "تسوق الآن",
            url: "https://example.com/shop",
            example: ["https://example.com/shop"],
          },
        ],
      },
    ],
    formSnapshot: {
      templateType: "STANDARD",
      headerType: "NONE",
      bodyText: "كود خصمك الحصري: {{1}}\nصالح حتى {{2}}. استخدمه عند الدفع!",
      footerText: "عرض لفترة محدودة",
      buttons: [
        { type: "URL", text: "تسوق الآن", url: "https://example.com/shop", example: "https://example.com/shop" },
      ],
    },
  },
  {
    name: "shipping_update",
    language: "ar",
    category: "UTILITY",
    description: "تحديث حالة الشحن مع تاريخ التوصيل المتوقع.",
    tags: ["shipping", "order", "utility"],
    isDefault: true,
    components: [
      {
        type: "BODY",
        text: "طلبك رقم {{1}} في الطريق إليك! التوصيل المتوقع: {{2}}.",
      },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "تتبع الشحن" },
          {
            type: "URL",
            text: "رابط التتبع",
            url: "https://example.com/track",
            example: ["https://example.com/track"],
          },
        ],
      },
    ],
    formSnapshot: {
      templateType: "STANDARD",
      headerType: "NONE",
      bodyText: "طلبك رقم {{1}} في الطريق إليك! التوصيل المتوقع: {{2}}.",
      footerText: "",
      buttons: [
        { type: "QUICK_REPLY", text: "تتبع الشحن" },
        { type: "URL", text: "رابط التتبع", url: "https://example.com/track", example: "https://example.com/track" },
      ],
    },
  },
  {
    name: "feedback_request",
    language: "ar",
    category: "UTILITY",
    description: "طلب تقييم التجربة مع أزرار رد سريع.",
    tags: ["feedback", "survey", "utility"],
    isDefault: true,
    components: [
      { type: "BODY", text: "كيف كانت تجربتك معنا؟ نقدّر رأيك لتحسين خدماتنا." },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "ممتاز" },
          { type: "QUICK_REPLY", text: "جيد" },
          { type: "QUICK_REPLY", text: "يحتاج تحسين" },
        ],
      },
    ],
    formSnapshot: {
      templateType: "STANDARD",
      headerType: "NONE",
      bodyText: "كيف كانت تجربتك معنا؟ نقدّر رأيك لتحسين خدماتنا.",
      footerText: "",
      buttons: [
        { type: "QUICK_REPLY", text: "ممتاز" },
        { type: "QUICK_REPLY", text: "جيد" },
        { type: "QUICK_REPLY", text: "يحتاج تحسين" },
      ],
    },
  },
  {
    name: "customer_welcome",
    language: "ar",
    category: "MARKETING",
    description: "ترحيب بالعميل الجديد مع عرض منتجات أو عروض.",
    tags: ["customer", "welcome", "marketing"],
    isDefault: true,
    components: [
      { type: "BODY", text: "مرحباً {{1}}! نحن سعداء بانضمامك. لدينا خصم ترحيبي خاص بك." },
      { type: "FOOTER", text: "شكراً لاختيارك متجرنا" },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "تسوق الآن",
            url: "https://example.com/shop",
            example: ["https://example.com/shop"],
          },
        ],
      },
    ],
    formSnapshot: {
      templateType: "STANDARD",
      headerType: "NONE",
      bodyText: "مرحباً {{1}}! نحن سعداء بانضمامك. لدينا خصم ترحيبي خاص بك.",
      footerText: "شكراً لاختيارك متجرنا",
      buttons: [
        { type: "URL", text: "تسوق الآن", url: "https://example.com/shop", example: "https://example.com/shop" },
      ],
    },
  },
  {
    name: "new_arrivals",
    language: "ar",
    category: "MARKETING",
    description: "إعلان وصول منتجات جديدة مع زر العرض.",
    tags: ["product", "marketing", "new"],
    isDefault: true,
    components: [
      { type: "BODY", text: "وصلت تشكيلة جديدة! اطلع على أحدث المنتجات قبل نفاد الكمية." },
      { type: "FOOTER", text: "عروض حصرية" },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "عرض المنتجات",
            url: "https://example.com/new",
            example: ["https://example.com/new"],
          },
        ],
      },
    ],
    formSnapshot: {
      templateType: "STANDARD",
      headerType: "NONE",
      bodyText: "وصلت تشكيلة جديدة! اطلع على أحدث المنتجات قبل نفاد الكمية.",
      footerText: "عروض حصرية",
      buttons: [
        { type: "URL", text: "عرض المنتجات", url: "https://example.com/new", example: "https://example.com/new" },
      ],
    },
  },
  {
    name: "flash_sale",
    language: "ar",
    category: "MARKETING",
    description: "تخفيضات خاطفة مع كود أو رابط.",
    tags: ["sale", "marketing", "offer"],
    isDefault: true,
    components: [
      {
        type: "BODY",
        text: "تخفيضات خاطفة! لمدة محدودة فقط.\nاستخدم كود {{1}} للحصول على خصم إضافي.",
      },
      { type: "FOOTER", text: "العرض ينتهي قريباً" },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "تسوق الآن",
            url: "https://example.com/sale",
            example: ["https://example.com/sale"],
          },
        ],
      },
    ],
    formSnapshot: {
      templateType: "STANDARD",
      headerType: "NONE",
      bodyText: "تخفيضات خاطفة! لمدة محدودة فقط.\nاستخدم كود {{1}} للحصول على خصم إضافي.",
      footerText: "العرض ينتهي قريباً",
      buttons: [
        { type: "URL", text: "تسوق الآن", url: "https://example.com/sale", example: "https://example.com/sale" },
      ],
    },
  },
  {
    name: "payment_reminder",
    language: "ar",
    category: "UTILITY",
    description: "تذكير بالدفع للطلب المعلق.",
    tags: ["order", "payment", "reminder"],
    isDefault: true,
    components: [
      {
        type: "BODY",
        text: "تذكير: لم نستلم بعد دفعتك لطلب رقم {{1}}. يمكنك إتمام الدفع عبر الرابط أدناه.",
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "الدفع الآن",
            url: "https://example.com/pay",
            example: ["https://example.com/pay"],
          },
        ],
      },
    ],
    formSnapshot: {
      templateType: "STANDARD",
      headerType: "NONE",
      bodyText: "تذكير: لم نستلم بعد دفعتك لطلب رقم {{1}}. يمكنك إتمام الدفع عبر الرابط أدناه.",
      footerText: "",
      buttons: [
        { type: "URL", text: "الدفع الآن", url: "https://example.com/pay", example: "https://example.com/pay" },
      ],
    },
  },
  {
    name: "welcome_back",
    language: "ar",
    category: "MARKETING",
    description: "ترحيب بعودة العميل مع عروض خاصة.",
    tags: ["welcome", "marketing", "loyalty", "customer"],
    isDefault: true,
    components: [
      { type: "BODY", text: "أهلاً بعودتك! كعميل مميز لدينا عروض حصرية تناسبك. تصفّحها الآن." },
      { type: "FOOTER", text: "شكراً لولائك" },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "عرض العروض",
            url: "https://example.com/offers",
            example: ["https://example.com/offers"],
          },
        ],
      },
    ],
    formSnapshot: {
      templateType: "STANDARD",
      headerType: "NONE",
      bodyText: "أهلاً بعودتك! كعميل مميز لدينا عروض حصرية تناسبك. تصفّحها الآن.",
      footerText: "شكراً لولائك",
      buttons: [
        { type: "URL", text: "عرض العروض", url: "https://example.com/offers", example: "https://example.com/offers" },
      ],
    },
  },
  {
    name: "product_recommendation",
    language: "ar",
    category: "MARKETING",
    description: "توصية منتج للعميل حسب اهتماماته.",
    tags: ["product", "customer", "marketing"],
    isDefault: true,
    components: [
      {
        type: "BODY",
        text: "اقتراح لك: {{1}}\nخصم {{2}} لفترة محدودة.",
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "عرض المنتج",
            url: "https://example.com/product",
            example: ["https://example.com/product"],
          },
        ],
      },
    ],
    formSnapshot: {
      templateType: "STANDARD",
      headerType: "NONE",
      bodyText: "اقتراح لك: {{1}}\nخصم {{2}} لفترة محدودة.",
      footerText: "",
      buttons: [
        { type: "URL", text: "عرض المنتج", url: "https://example.com/product", example: "https://example.com/product" },
      ],
    },
  },
  {
    name: "gift_card",
    language: "ar",
    category: "MARKETING",
    description: "إرسال بطاقة هدية أو كود هدية للعميل.",
    tags: ["gift", "customer", "marketing"],
    isDefault: true,
    components: [
      {
        type: "BODY",
        text: "هديتك جاهزة! كود الهدية: {{1}}\nالقيمة: {{2}}\nصالح حتى {{3}}.",
      },
      { type: "FOOTER", text: "مع تمنياتنا بالسعادة" },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "استخدم الهدية",
            url: "https://example.com/redeem",
            example: ["https://example.com/redeem"],
          },
        ],
      },
    ],
    formSnapshot: {
      templateType: "STANDARD",
      headerType: "NONE",
      bodyText: "هديتك جاهزة! كود الهدية: {{1}}\nالقيمة: {{2}}\nصالح حتى {{3}}.",
      footerText: "مع تمنياتنا بالسعادة",
      buttons: [
        { type: "URL", text: "استخدم الهدية", url: "https://example.com/redeem", example: "https://example.com/redeem" },
      ],
    },
  },
  {
    name: "abandoned_cart",
    language: "ar",
    category: "MARKETING",
    description: "تذكير العميل بالسلة المهجورة مع رابط الإكمال.",
    tags: ["customer", "cart", "marketing"],
    isDefault: true,
    components: [
      {
        type: "BODY",
        text: "نسيت شيئاً؟ لديك {{1}} في سلة التسوق. أكمله الآن قبل نفاد الكمية!",
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "إكمال الطلب",
            url: "https://example.com/cart",
            example: ["https://example.com/cart"],
          },
        ],
      },
    ],
    formSnapshot: {
      templateType: "STANDARD",
      headerType: "NONE",
      bodyText: "نسيت شيئاً؟ لديك {{1}} في سلة التسوق. أكمله الآن قبل نفاد الكمية!",
      footerText: "",
      buttons: [
        { type: "URL", text: "إكمال الطلب", url: "https://example.com/cart", example: "https://example.com/cart" },
      ],
    },
  },
  {
    name: "product_back_in_stock",
    language: "ar",
    category: "MARKETING",
    description: "إبلاغ العميل بتوفر منتج كان نفد.",
    tags: ["product", "customer", "marketing"],
    isDefault: true,
    components: [
      {
        type: "BODY",
        text: "أخبار سارة! المنتج {{1}} متوفر مجدداً. اطلبه الآن قبل نفاد الكمية.",
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "اطلب الآن",
            url: "https://example.com/product",
            example: ["https://example.com/product"],
          },
        ],
      },
    ],
    formSnapshot: {
      templateType: "STANDARD",
      headerType: "NONE",
      bodyText: "أخبار سارة! المنتج {{1}} متوفر مجدداً. اطلبه الآن قبل نفاد الكمية.",
      footerText: "",
      buttons: [
        { type: "URL", text: "اطلب الآن", url: "https://example.com/product", example: "https://example.com/product" },
      ],
    },
  },
  {
    name: "customer_birthday",
    language: "ar",
    category: "MARKETING",
    description: "تهنئة العميل بعيد ميلاده مع خصم أو هدية.",
    tags: ["customer", "gift", "marketing"],
    isDefault: true,
    components: [
      {
        type: "BODY",
        text: "عيد ميلاد سعيد {{1}}!🎂 هديتك: خصم {{2}} على طلبك القادم.",
      },
      { type: "FOOTER", text: "كل عام وأنت بخير" },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "URL",
            text: "استخدم الهدية",
            url: "https://example.com/shop",
            example: ["https://example.com/shop"],
          },
        ],
      },
    ],
    formSnapshot: {
      templateType: "STANDARD",
      headerType: "NONE",
      bodyText: "عيد ميلاد سعيد {{1}}!🎂 هديتك: خصم {{2}} على طلبك القادم.",
      footerText: "كل عام وأنت بخير",
      buttons: [
        { type: "URL", text: "استخدم الهدية", url: "https://example.com/shop", example: "https://example.com/shop" },
      ],
    },
  },
];

export const list = query({
  args: {
    tag: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let items = await ctx.db.query("template_store").collect();
    const tag = args.tag;
    if (tag) {
      items = items.filter((t) => t.tags && t.tags.includes(tag));
    }
    const category = args.category;
    if (category) {
      items = items.filter((t) => t.category === category);
    }
    // Defaults first, then by createdAt desc
    items.sort((a, b) => {
      const aDefault = a.isDefault === true ? 1 : 0;
      const bDefault = b.isDefault === true ? 1 : 0;
      if (bDefault !== aDefault) return aDefault - bDefault;
      const aTime = a.createdAt ?? 0;
      const bTime = b.createdAt ?? 0;
      return bTime - aTime;
    });
    return items;
  },
});

export const get = query({
  args: { id: v.id("template_store") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const add = mutation({
  args: {
    name: v.string(),
    language: v.string(),
    category: v.string(),
    components: v.any(),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    formSnapshot: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("template_store", {
      name: args.name,
      language: args.language,
      category: args.category,
      components: args.components,
      description: args.description,
      tags: args.tags,
      formSnapshot: args.formSnapshot,
      isDefault: false,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("template_store") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (!doc) return;
    if (doc.isDefault === true) {
      throw new Error("لا يمكن حذف قالب افتراضي من المتجر.");
    }
    await ctx.db.delete(args.id);
  },
});

/** One-time or on-demand: seed default templates if store is empty. */
export const seedDefaults = mutation({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("template_store").collect();
    const defaults = existing.filter((t) => t.isDefault === true);
    if (defaults.length > 0 && !args.force) {
      return { seeded: 0, message: "القوالب الافتراضية موجودة مسبقاً." };
    }
    if (args.force && defaults.length > 0) {
      for (const t of defaults) {
        await ctx.db.delete(t._id);
      }
    }
    let seeded = 0;
    for (const t of DEFAULT_TEMPLATES) {
      await ctx.db.insert("template_store", {
        name: t.name,
        language: t.language,
        category: t.category,
        description: t.description,
        tags: t.tags,
        isDefault: t.isDefault,
        components: t.components,
        formSnapshot: t.formSnapshot,
        createdAt: undefined,
      });
      seeded++;
    }
    return { seeded, message: `تم تحميل ${seeded} قوالب افتراضية.` };
  },
});

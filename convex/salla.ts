import { v } from "convex/values";
import { action, mutation, query, internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

// Salla API endpoints
const SALLA_TOKEN_URL = "https://accounts.salla.sa/oauth2/token";
const SALLA_API_BASE = "https://api.salla.dev/admin/v2";
type SallaConnectionStatus = "connected" | "disconnected" | "token_invalid" | "refresh_failed";

// Get connection status
export const getConnection = query({
    args: {},
    handler: async (ctx) => {
        // For now, get the first integration (single-tenant)
        const integration = await ctx.db.query("sallaIntegrations").first();

        if (!integration) {
            return {
                connected: false,
                status: "disconnected" as SallaConnectionStatus,
                tokenSource: "db" as const,
            };
        }

        const isExpired = integration.expiresAt < Date.now();
        const status: SallaConnectionStatus =
            integration.tokenStatus ??
            (isExpired ? "token_invalid" : "connected");

        return {
            connected: status === "connected",
            status,
            merchantId: integration.merchantId,
            storeName: integration.storeName,
            storeUrl: integration.storeUrl,
            connectedAt: integration.connectedAt,
            isExpired,
            tokenSource: "db" as const,
            lastTokenErrorCode: integration.lastTokenErrorCode,
            lastTokenErrorMessage: integration.lastTokenErrorMessage,
            lastTokenErrorAt: integration.lastTokenErrorAt,
        };
    },
});

// Save tokens after OAuth callback
export const saveTokens = mutation({
    args: {
        merchantId: v.string(),
        accessToken: v.string(),
        refreshToken: v.string(),
        expiresIn: v.number(), // seconds
        storeName: v.optional(v.string()),
        storeUrl: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Check if integration already exists
        const existing = await ctx.db
            .query("sallaIntegrations")
            .withIndex("by_merchant", (q) => q.eq("merchantId", args.merchantId))
            .first();

        const expiresAt = Date.now() + args.expiresIn * 1000;

        if (existing) {
            await ctx.db.patch(existing._id, {
                accessToken: args.accessToken,
                refreshToken: args.refreshToken,
                expiresAt,
                storeName: args.storeName,
                storeUrl: args.storeUrl,
                tokenStatus: "connected",
                lastTokenErrorCode: undefined,
                lastTokenErrorMessage: undefined,
                lastTokenErrorAt: undefined,
            });
            return existing._id;
        }

        return await ctx.db.insert("sallaIntegrations", {
            merchantId: args.merchantId,
            accessToken: args.accessToken,
            refreshToken: args.refreshToken,
            expiresAt,
            storeName: args.storeName,
            storeUrl: args.storeUrl,
            connectedAt: Date.now(),
            tokenStatus: "connected",
        });
    },
});

// Disconnect Salla
export const disconnect = mutation({
    args: {},
    handler: async (ctx) => {
        const integration = await ctx.db.query("sallaIntegrations").first();
        if (integration) {
            await ctx.db.delete(integration._id);
        }
    },
});

// Exchange authorization code for tokens (internal - called from http.ts)
export const exchangeCode = internalAction({
    args: {
        code: v.string(),
    },
    handler: async (ctx, args) => {
        const clientId = process.env.SALLA_CLIENT_ID;
        const clientSecret = process.env.SALLA_CLIENT_SECRET;
        const redirectUri = process.env.SALLA_REDIRECT_URI;

        if (!clientId || !clientSecret || !redirectUri) {
            throw new Error("Missing Salla OAuth configuration");
        }

        // Exchange code for tokens
        const tokenResponse = await fetch(SALLA_TOKEN_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                client_id: clientId,
                client_secret: clientSecret,
                code: args.code,
                redirect_uri: redirectUri,
            }),
        });

        if (!tokenResponse.ok) {
            const error = await tokenResponse.text();
            throw new Error(`Failed to exchange code: ${error}`);
        }

        const tokens = await tokenResponse.json();

        // Get merchant info
        const merchantResponse = await fetch(`${SALLA_API_BASE}/store/info`, {
            headers: {
                Authorization: `Bearer ${tokens.access_token}`,
            },
        });

        let merchantInfo = { id: "unknown", name: undefined, domain: undefined };
        if (merchantResponse.ok) {
            const data = await merchantResponse.json();
            merchantInfo = {
                id: data.data?.id?.toString() || "unknown",
                name: data.data?.name,
                domain: data.data?.domain,
            };
        }

        // Save tokens to database
        await ctx.runMutation("salla:saveTokens" as any, {
            merchantId: merchantInfo.id,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresIn: tokens.expires_in || 1209600, // Default 14 days
            storeName: merchantInfo.name,
            storeUrl: merchantInfo.domain,
        });

        return { success: true, storeName: merchantInfo.name };
    },
});

// Refresh access token
export const refreshToken = action({
    args: {},
    handler: async (ctx) => {
        const integration = await ctx.runQuery("salla:getConnectionWithToken" as any, {});

        if (!integration) {
            throw new Error("No Salla integration found");
        }
        if (!integration.refreshToken) {
            return { success: false, skipped: true, reason: "missing_refresh_token" };
        }

        const clientId = process.env.SALLA_CLIENT_ID;
        const clientSecret = process.env.SALLA_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            throw new Error("Missing Salla OAuth configuration");
        }

        const tokenResponse = await fetch(SALLA_TOKEN_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: integration.refreshToken,
            }),
        });

        if (!tokenResponse.ok) {
            const body = await tokenResponse.text();
            console.error("[Salla] Refresh token failed:", tokenResponse.status, body);
            await ctx.runMutation("salla:setTokenHealth" as any, {
                integrationId: integration._id,
                status: "refresh_failed",
                errorCode: tokenResponse.status,
                errorMessage: body || tokenResponse.statusText,
            });
            throw new Error(`Failed to refresh token: ${tokenResponse.status} ${body || tokenResponse.statusText}`);
        }

        const tokens = await tokenResponse.json();

        // Update tokens in database
        await ctx.runMutation("salla:saveTokens" as any, {
            merchantId: integration.merchantId,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresIn: tokens.expires_in || 1209600,
        });

        return { success: true };
    },
});

// Fetch products from Salla API (not stored in Convex)
export const fetchProducts = action({
    args: {
        page: v.optional(v.number()),
        perPage: v.optional(v.number()),
        keyword: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const emptyPagination = { currentPage: 1, totalPages: 0, totalItems: 0 };

        // Get access token from DB
        const integration = await ctx.runQuery("salla:getConnectionWithToken" as any, {});

        if (!integration) {
            return {
                connected: false,
                status: "disconnected" as SallaConnectionStatus,
                products: [],
                pagination: emptyPagination,
                tokenError: true,
                errorMessage: "لا يوجد ربط نشط مع سلة. أعد الربط من صفحة التكاملات.",
            };
        }

        const page = args.page || 1;
        const perPage = args.perPage || 20;
        
        let url = `${SALLA_API_BASE}/products?page=${page}&per_page=${perPage}`;
        if (args.keyword) {
            url += `&keyword=${encodeURIComponent(args.keyword)}`;
        }

        let response: Response;
        try {
            response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${integration.accessToken}`,
                },
            }
            );
        } catch (networkError) {
            console.error("[Salla] Network error in fetchProducts:", networkError);
            return {
                connected: true,
                status: "connected" as SallaConnectionStatus,
                products: [],
                pagination: emptyPagination,
                apiError: true,
                errorMessage: "تعذر الاتصال بسلة حالياً. تحقق من الشبكة ثم أعد المحاولة.",
            };
        }

        if (!response.ok) {
            const errorBody = await response.text().catch(() => "");

            if (response.status === 401 && integration.refreshToken) {
                try {
                    await ctx.runAction("salla:refreshToken" as any, {});
                    return ctx.runAction("salla:fetchProducts" as any, { page, perPage, keyword: args.keyword });
                } catch (refreshErr) {
                    console.error("[Salla] Token refresh failed in fetchProducts:", refreshErr);
                    await ctx.runMutation("salla:setTokenHealth" as any, {
                        integrationId: integration._id,
                        status: "refresh_failed",
                        errorCode: 401,
                        errorMessage: "Salla token refresh failed after unauthorized response.",
                    });
                    return {
                        connected: false,
                        status: "refresh_failed" as SallaConnectionStatus,
                        products: [],
                        pagination: emptyPagination,
                        tokenError: true,
                        errorMessage: "انتهت صلاحية ربط سلة. أعد الربط من صفحة التكاملات.",
                    };
                }
            }
            if (response.status === 401) {
                await ctx.runMutation("salla:setTokenHealth" as any, {
                    integrationId: integration._id,
                    status: "token_invalid",
                    errorCode: 401,
                    errorMessage: "token is not valid",
                });
                return {
                    connected: false,
                    status: "token_invalid" as SallaConnectionStatus,
                    products: [],
                    pagination: emptyPagination,
                    tokenError: true,
                    errorMessage: "رمز سلة غير صالح. أعد الربط من صفحة التكاملات.",
                };
            }

            console.error("[Salla] fetchProducts failed:", {
                status: response.status,
                statusText: response.statusText,
                body: errorBody.slice(0, 400),
            });
            return {
                connected: true,
                status: "connected" as SallaConnectionStatus,
                products: [],
                pagination: emptyPagination,
                apiError: true,
                errorMessage: `فشل جلب المنتجات من سلة (${response.status}).`,
            };
        }

        let data: any;
        try {
            data = await response.json();
        } catch (parseError) {
            console.error("[Salla] Failed to parse products response:", parseError);
            return {
                connected: true,
                status: "connected" as SallaConnectionStatus,
                products: [],
                pagination: emptyPagination,
                apiError: true,
                errorMessage: "تعذر قراءة رد سلة. أعد المحاولة لاحقاً.",
            };
        }

        await ctx.runMutation("salla:setTokenHealth" as any, {
            integrationId: integration._id,
            status: "connected",
        });

        return {
            connected: true,
            status: "connected" as SallaConnectionStatus,
            products: data.data?.map((p: any) => ({
                id: p.id,
                name: p.name,
                sku: p.sku || `SALLA-${p.id}`,
                price: p.price?.amount || 0,
                originalPrice: p.sale_price?.amount || p.price?.amount || 0,
                currency: p.price?.currency || "SAR",
                stock: p.quantity || 0,
                image: p.main_image || null,
                inStock: p.quantity > 0,
                description: p.description || "",
                url: p.urls?.customer || "",
                status: p.status || "active",
                options: p.options || [],
                images: p.images || [],
            })) || [],
            pagination: {
                currentPage: data.pagination?.current_page || 1,
                totalPages: data.pagination?.total_pages || 1,
                totalItems: data.pagination?.total || 0,
            },
        };
    },
});

// Fetch single product from Salla
export const getProduct = action({
    args: {
        id: v.string(),
    },
    handler: async (ctx, args) => {
        const integration = await ctx.runQuery("salla:getConnectionWithToken" as any, {});

        if (!integration) {
            throw new Error("Not connected to Salla");
        }

        const response = await fetch(
            `${SALLA_API_BASE}/products/${args.id}`,
            {
                headers: {
                    Authorization: `Bearer ${integration.accessToken}`,
                },
            }
        );

        if (!response.ok) {
            if (response.status === 401 && integration.refreshToken) {
                try {
                    await ctx.runAction("salla:refreshToken" as any, {});
                    return ctx.runAction("salla:getProduct" as any, { id: args.id });
                } catch (refreshErr) {
                    console.error("[Salla] Token refresh failed in getProduct:", refreshErr);
                    throw new Error("Salla token expired. Please reconnect from Integrations.");
                }
            }
            throw new Error("Failed to fetch product");
        }

        const data = await response.json();
        const p = data.data;

        return {
            id: p.id,
            name: p.name,
            sku: p.sku || `SALLA-${p.id}`,
            price: p.price?.amount || 0,
            originalPrice: p.sale_price?.amount || p.price?.amount || 0,
            currency: p.price?.currency || "SAR",
            stock: p.quantity || 0,
            image: p.main_image || null,
            images: p.images || [],
            inStock: p.quantity > 0,
            description: p.description || "",
            url: p.urls?.customer || "",
            status: p.status || "active",
            options: p.options || [],
        };
    },
});

// Internal query to get token (for actions)
export const getConnectionWithToken = query({
    args: {},
    handler: async (ctx) => {
        const integration = await ctx.db.query("sallaIntegrations").first();
        return integration ?? null;
    },
});

export const setTokenHealth = internalMutation({
    args: {
        integrationId: v.id("sallaIntegrations"),
        status: v.union(v.literal("connected"), v.literal("token_invalid"), v.literal("refresh_failed")),
        errorCode: v.optional(v.number()),
        errorMessage: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.integrationId, {
            tokenStatus: args.status,
            lastTokenErrorCode: args.errorCode,
            lastTokenErrorMessage: args.errorMessage,
            lastTokenErrorAt: args.status === "connected" ? undefined : Date.now(),
        });
    },
});

"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import crypto from "crypto";

export const createAppSecretProof = internalAction({
    args: {
        accessToken: v.string(),
        appSecret: v.string(),
    },
    handler: async (_ctx, args) => {
        return crypto
            .createHmac("sha256", args.appSecret)
            .update(args.accessToken, "utf8")
            .digest("hex");
    },
});

export const verifySignature = internalAction({
    args: {
        rawBody: v.string(),
        signatureHeader: v.string(),
        appSecret: v.string(),
    },
    handler: async (ctx, args) => {
        const { rawBody, signatureHeader, appSecret } = args;

        if (!signatureHeader.startsWith("sha256=")) return false;

        const expectedHex = crypto
            .createHmac("sha256", appSecret)
            .update(rawBody, "utf8")
            .digest("hex");

        const expected = "sha256=" + expectedHex;

        if (signatureHeader.length !== expected.length) {
            console.error(`[verifySignature] Length mismatch: received=${signatureHeader.length}, expected=${expected.length}`);
            return false;
        }

        try {
            const isValid = crypto.timingSafeEqual(
                Buffer.from(signatureHeader, "utf8"),
                Buffer.from(expected, "utf8")
            );
            if (!isValid) {
                console.error(`[verifySignature] Signature mismatch!`);
                console.error(`[verifySignature] Received: ${signatureHeader.substring(0, 15)}...`);
                console.error(`[verifySignature] Expected: ${expected.substring(0, 15)}...`);
            } else {
                console.log(`[verifySignature] Signature verified successfully.`);
            }
            return isValid;
        } catch (e) {
            console.error(`[verifySignature] Error during timingSafeEqual:`, e);
            return false;
        }
    },
});

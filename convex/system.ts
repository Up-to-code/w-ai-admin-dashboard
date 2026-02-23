import { query } from "./_generated/server";
import { v } from "convex/values";

export const getRuntimeDeploymentInfo = query({
  args: {
    includeEnvKeys: v.optional(v.boolean()),
  },
  handler: async (_ctx, args) => {
    const env = {
      CONVEX_DEPLOYMENT: process.env.CONVEX_DEPLOYMENT ?? null,
      NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL ?? null,
      CONVEX_CLOUD_URL: process.env.CONVEX_CLOUD_URL ?? null,
      VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      VERCEL_URL: process.env.VERCEL_URL ?? null,
      NODE_ENV: process.env.NODE_ENV ?? null,
    };
    return {
      now: Date.now(),
      deploymentUrl:
        env.NEXT_PUBLIC_CONVEX_URL ??
        env.CONVEX_CLOUD_URL ??
        null,
      buildMarker:
        env.VERCEL_GIT_COMMIT_SHA ??
        env.VERCEL_URL ??
        "unknown",
      ...(args.includeEnvKeys ? { env } : {}),
    };
  },
});

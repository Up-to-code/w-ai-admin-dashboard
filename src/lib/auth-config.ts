/**
 * Auth configuration for trusted origins and app URL.
 * Used for OAuth callbacks, CORS, and secure redirects.
 */

const DEFAULT_APP_URL = "https://w-ai-admin-dashboard.vercel.app"

export const authConfig = {
  /** App URL - set via NEXT_PUBLIC_APP_URL for production (Vercel) */
  appUrl: process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : DEFAULT_APP_URL),

  /** Trusted origins for auth redirects and CORS */
  trustedOrigins: [
    "https://w-ai-admin-dashboard.vercel.app",
    "http://localhost:3000",
    ...(process.env.NEXT_PUBLIC_APP_URL ? [process.env.NEXT_PUBLIC_APP_URL] : []),
  ].filter((v, i, a) => a.indexOf(v) === i),
}

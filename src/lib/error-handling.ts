import { notFound } from "next/navigation"

// This component can be used for dynamic 404 pages
// For example, when a resource is not found in the database
export function DynamicNotFound() {
  notFound()
}

// Helper function to check if a route exists in our application
export function isValidRoute(pathname: string): boolean {
  const validRoutes = [
    "/",
    "/login",
    "/register",
    "/chat",
    "/campaigns",
    "/storage",
    "/ai-settings",
    "/integrations",
    "/settings",
  ]

  return validRoutes.includes(pathname)
}

// Error tracking utility (placeholder for analytics integration)
export function track404Error(pathname: string, referrer?: string) {
  // In a real application, you'd integrate with your analytics service
  // Example: analytics.track('404_error', { pathname, referrer, timestamp: Date.now() })
  console.warn(`404 Error tracked: ${pathname}`, { referrer, timestamp: Date.now() })
}
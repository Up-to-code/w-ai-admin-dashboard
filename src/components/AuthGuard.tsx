"use client"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  // Static extraction: render UI only without auth gating.
  return <>{children}</>
}

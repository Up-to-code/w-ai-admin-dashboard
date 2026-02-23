"use client"

import { createContext, useContext, useMemo, useState } from "react"

type HeaderContent = React.ReactNode | null

type DashboardHeaderContextValue = {
  content: HeaderContent
  setContent: (content: HeaderContent) => void
  clear: () => void
}

const DashboardHeaderContext = createContext<DashboardHeaderContextValue | null>(null)

export function DashboardHeaderProvider({ children }: { children: React.ReactNode }) {
  const [content, setContent] = useState<HeaderContent>(null)

  const value = useMemo<DashboardHeaderContextValue>(() => {
    return {
      content,
      setContent,
      clear: () => setContent(null),
    }
  }, [content])

  return <DashboardHeaderContext.Provider value={value}>{children}</DashboardHeaderContext.Provider>
}

export function useDashboardHeader() {
  const ctx = useContext(DashboardHeaderContext)
  if (!ctx) {
    throw new Error("useDashboardHeader must be used within DashboardHeaderProvider")
  }
  return ctx
}


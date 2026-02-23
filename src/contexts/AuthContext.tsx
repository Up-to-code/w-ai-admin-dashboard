"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react"
import { useQuery } from "convex/react"
import { api } from "@/mock/convex-api"
import type { Id } from "@/mock/dataModel"
import type { UserRole } from "@/lib/auth-storage"
import { authStorage } from "@/lib/auth-storage"

type AuthContextType = {
  isAuthenticated: boolean | null
  userId: string | null
  role: UserRole | null
  isAdmin: boolean
  loading: boolean
  login: (token: string, id: string, role?: UserRole) => void
  logout: () => void
  setRole: (role: UserRole) => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserIdState] = useState<string | null>(() => authStorage.getUserId())
  const storedUserId = userId ?? authStorage.getUserId()

  const dbUser = useQuery(
    api.auth.getUser,
    storedUserId ? { userId: storedUserId as Id<"users"> } : "skip"
  )

  const role: UserRole | null =
    dbUser !== undefined && dbUser !== null ? (dbUser.role as UserRole) : null
  const isAuthenticated =
    storedUserId !== null &&
    (dbUser === undefined ? !!authStorage.getAuthToken() : dbUser !== null)
  const loading = !!storedUserId && dbUser === undefined
  const isAdmin = role === "admin"

  useEffect(() => {
    if (!storedUserId) {
      setUserIdState(null)
      return
    }
    setUserIdState(storedUserId)
    if (dbUser === null) {
      authStorage.clearAuth()
      setUserIdState(null)
    } else if (dbUser && dbUser.role) {
      authStorage.setUserRole(dbUser.role as UserRole)
    }
  }, [storedUserId, dbUser])

  const login = useCallback((token: string, id: string, userRole: UserRole = "user") => {
    authStorage.setAuthToken(token)
    authStorage.setUserId(id)
    authStorage.setUserRole(userRole)
    setUserIdState(id)
  }, [])

  const setRole = useCallback((newRole: UserRole) => {
    authStorage.setUserRole(newRole)
    // Role is sourced from DB; this updates cache only. Query will refetch.
  }, [])

  const logout = useCallback(() => {
    authStorage.clearAuth()
    setUserIdState(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        userId: isAuthenticated ? storedUserId : null,
        role,
        isAdmin,
        loading,
        login,
        logout,
        setRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}

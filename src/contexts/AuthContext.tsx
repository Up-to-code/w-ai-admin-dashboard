"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react"
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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [userId, setUserIdState] = useState<string | null>(null)
  const [role, setRoleState] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  const isAdmin = role === "admin"

  useEffect(() => {
    const storedToken = authStorage.getAuthToken()
    const storedUserId = authStorage.getUserId()
    const storedRole = authStorage.getUserRole()

    if (storedToken && storedUserId) {
      setIsAuthenticated(true)
      setUserIdState(storedUserId)
      setRoleState(storedRole ?? "user")
    } else {
      setIsAuthenticated(false)
      setUserIdState(null)
      setRoleState(null)
    }

    setLoading(false)
  }, [])

  const login = useCallback(
    (token: string, id: string, userRole: UserRole = "admin") => {
      authStorage.setAuthToken(token)
      authStorage.setUserId(id)
      authStorage.setUserRole(userRole)
      setIsAuthenticated(true)
      setUserIdState(id)
      setRoleState(userRole)
    },
    []
  )

  const setRole = useCallback((newRole: UserRole) => {
    authStorage.setUserRole(newRole)
    setRoleState(newRole)
  }, [])

  const logout = useCallback(() => {
    authStorage.clearAuth()
    setIsAuthenticated(false)
    setUserIdState(null)
    setRoleState(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        userId,
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

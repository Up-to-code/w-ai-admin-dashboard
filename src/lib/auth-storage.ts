const AUTH_TOKEN_KEY = "auth_token"
const USER_ID_KEY = "user_id"
const USER_ROLE_KEY = "user_role"

export type UserRole = "admin" | "agent" | "user"

function safeLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export const authStorage = {
  setAuthToken(token: string): void {
    safeLocalStorage()?.setItem(AUTH_TOKEN_KEY, token)
  },

  getAuthToken(): string | null {
    return safeLocalStorage()?.getItem(AUTH_TOKEN_KEY) ?? null
  },

  removeAuthToken(): void {
    safeLocalStorage()?.removeItem(AUTH_TOKEN_KEY)
  },

  setUserId(userId: string): void {
    safeLocalStorage()?.setItem(USER_ID_KEY, userId)
  },

  getUserId(): string | null {
    return safeLocalStorage()?.getItem(USER_ID_KEY) ?? null
  },

  removeUserId(): void {
    safeLocalStorage()?.removeItem(USER_ID_KEY)
  },

  setUserRole(role: UserRole): void {
    safeLocalStorage()?.setItem(USER_ROLE_KEY, role)
  },

  getUserRole(): UserRole | null {
    const value = safeLocalStorage()?.getItem(USER_ROLE_KEY)
    return (value as UserRole) ?? null
  },

  removeUserRole(): void {
    safeLocalStorage()?.removeItem(USER_ROLE_KEY)
  },

  clearAuth(): void {
    this.removeAuthToken()
    this.removeUserId()
    this.removeUserRole()
  },
}

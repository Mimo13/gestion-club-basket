import { createContext, useContext, type PropsWithChildren } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AuthenticatedUser } from '@club-basket/contracts'
import { authApi } from './auth-api.js'

interface AuthContextValue {
  user: AuthenticatedUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient()
  const sessionQuery = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: () => authApi.session(),
    retry: false,
  })
  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => authApi.login(email, password),
    onSuccess: (session) => {
      queryClient.setQueryData(['auth', 'session'], session)
    },
  })
  const logoutMutation = useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'session'], null)
      queryClient.removeQueries({ queryKey: ['teams'] })
    },
  })

  const value: AuthContextValue = {
    user: sessionQuery.data?.user ?? null,
    isLoading: sessionQuery.isLoading,
    login: async (email, password) => { await loginMutation.mutateAsync({ email, password }) },
    logout: async () => { await logoutMutation.mutateAsync() },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe utilizarse dentro de AuthProvider')
  return context
}

import {
  apiErrorSchema,
  categoriesResponseSchema,
  categorySchema,
  healthResponseSchema,
  listTeamsQuerySchema,
  paginatedTeamsSchema,
  managedUsersResponseSchema,
  sessionResponseSchema,
  type CreateCategoryInput,
  type CreateManagedUserInput,
  type CreateTeamInput,
  type Role,
  type UpdateCategoryInput,
  type UserStatus,
  type ListTeamsQuery,
  type PaginatedTeams,
} from '@club-basket/contracts'

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

export function createApiClient(baseUrl: string) {
  const csrfToken = (): string | undefined => {
    if (typeof document === 'undefined') return undefined
    return document.cookie.split('; ').find((part) => part.startsWith('club_basket_csrf='))?.split('=')[1]
  }

  const request = async (path: string, init?: RequestInit): Promise<unknown> => {
    const headers = new Headers(init?.headers)
    headers.set('Content-Type', 'application/json')
    const token = csrfToken()
    if (token) headers.set('x-csrf-token', decodeURIComponent(token))
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      credentials: 'include',
      headers,
    })

    const body: unknown = await response.json().catch(() => undefined)
    if (!response.ok) {
      const parsed = apiErrorSchema.safeParse(body)
      throw new ApiClientError(
        response.status,
        parsed.success ? parsed.data.error.code : 'UNKNOWN_ERROR',
        parsed.success ? parsed.data.error.message : 'Error de comunicación con la API',
      )
    }
    return body
  }

  return {
    async health() {
      return healthResponseSchema.parse(await request('/api/v1/health'))
    },
    async login(email: string, password: string) {
      return sessionResponseSchema.parse(await request('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, client: 'web' }),
      }))
    },
    async session() {
      return sessionResponseSchema.parse(await request('/api/v1/auth/session'))
    },
    async logout() {
      await request('/api/v1/auth/logout', { method: 'POST' })
    },
    async requestPasswordReset(email: string) {
      await request('/api/v1/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) })
    },
    async changePassword(currentPassword: string, newPassword: string) {
      await request('/api/v1/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) })
    },
    async resetPassword(token: string, password: string) {
      await request('/api/v1/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) })
    },
    async listUsers() {
      return managedUsersResponseSchema.parse(await request('/api/v1/admin/users'))
    },
    async inviteUser(input: CreateManagedUserInput) {
      return await request('/api/v1/admin/users', { method: 'POST', body: JSON.stringify(input) })
    },
    async updateUserRole(userId: string, role: Role) {
      await request(`/api/v1/admin/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) })
    },
    async updateUserStatus(userId: string, status: UserStatus) {
      await request(`/api/v1/admin/users/${userId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
    },
    async listCategories() {
      return categoriesResponseSchema.parse(await request('/api/v1/categories'))
    },
    async listSettingsCategories() {
      return categoriesResponseSchema.parse(await request('/api/v1/settings/categories'))
    },
    async createCategory(input: CreateCategoryInput) {
      return categorySchema.parse(await request('/api/v1/settings/categories', { method: 'POST', body: JSON.stringify(input) }))
    },
    async updateCategory(categoryId: string, input: UpdateCategoryInput) {
      return categorySchema.parse(await request(`/api/v1/settings/categories/${categoryId}`, { method: 'PATCH', body: JSON.stringify(input) }))
    },
    async listTeams(query: Partial<ListTeamsQuery> = {}): Promise<PaginatedTeams> {
      const parsedQuery = listTeamsQuerySchema.parse(query)
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(parsedQuery)) {
        if (value !== undefined) params.set(key, String(value))
      }
      return paginatedTeamsSchema.parse(await request(`/api/v1/teams?${params}`))
    },
    async createTeam(input: CreateTeamInput) {
      return await request('/api/v1/teams', {
        method: 'POST',
        body: JSON.stringify(input),
      })
    },
  }
}

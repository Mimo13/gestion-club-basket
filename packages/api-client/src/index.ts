import {
  apiErrorSchema,
  healthResponseSchema,
  listTeamsQuerySchema,
  paginatedTeamsSchema,
  sessionResponseSchema,
  type CreateTeamInput,
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
  const request = async (path: string, init?: RequestInit): Promise<unknown> => {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init?.headers },
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

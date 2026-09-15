import {
  apiErrorSchema,
  attendanceCalendarSchema,
  attendanceSummarySchema,
  todayAttendanceSchema,
  categoriesResponseSchema,
  categorySchema,
  currentSeasonSchema,
  healthResponseSchema,
  listActivitiesQuerySchema,
  listTeamsQuerySchema,
  managedUsersResponseSchema,
  matchRosterSchema,
  paginatedActivitiesSchema,
  paginatedTeamsSchema,
  playerDetailSchema,
  playerSchema,
  playersResponseSchema,
  sessionResponseSchema,
  seasonsResponseSchema,
  teamDetailSchema,
  trainingSchedulesResponseSchema,
  type AttendanceCalendar,
  type AttendanceSummary,
  type TodayAttendance,
  type CreateActivityInput,
  type CreateCategoryInput,
  type CreateManagedUserInput,
  type CreatePlayerInput,
  type CreateTeamInput,
  type ListActivitiesQuery,
  type ListTeamsQuery,
  type MarkAbsenceResponse,
  type MatchRoster,
  type PaginatedActivities,
  type PaginatedTeams,
  type PlayerDetail,
  type Role,
  type TeamDetail,
  type TrainingSchedule,
  type UpdateActivityInput,
  type UpdateCategoryInput,
  type UserStatus,
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
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, { ...init, credentials: 'include', headers })
    const body: unknown = await response.json().catch(() => undefined)
    if (!response.ok) {
      const parsed = apiErrorSchema.safeParse(body)
      throw new ApiClientError(response.status, parsed.success ? parsed.data.error.code : 'UNKNOWN_ERROR', parsed.success ? parsed.data.error.message : 'Error de comunicación con la API')
    }
    return body
  }

  return {
    async health() { return healthResponseSchema.parse(await request('/api/v1/health')) },
    async currentSeason() { return currentSeasonSchema.parse(await request('/api/v1/seasons/current')) },
    async listSeasons() { return seasonsResponseSchema.parse(await request('/api/v1/seasons')) },
    async login(email: string, password: string) { return sessionResponseSchema.parse(await request('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password, client: 'web' }) })) },
    async session() { return sessionResponseSchema.parse(await request('/api/v1/auth/session')) },
    async logout() { await request('/api/v1/auth/logout', { method: 'POST' }) },
    async requestPasswordReset(email: string) { await request('/api/v1/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }) },
    async changePassword(currentPassword: string, newPassword: string) { await request('/api/v1/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }) },
    async resetPassword(token: string, password: string) { await request('/api/v1/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }) },
    async listUsers() { return managedUsersResponseSchema.parse(await request('/api/v1/admin/users')) },
    async inviteUser(input: CreateManagedUserInput) { return await request('/api/v1/admin/users', { method: 'POST', body: JSON.stringify(input) }) },
    async updateUserRole(userId: string, role: Role) { await request(`/api/v1/admin/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }) },
    async updateUserRoles(userId: string, roles: Role[]) { await request(`/api/v1/admin/users/${userId}/roles`, { method: 'PATCH', body: JSON.stringify({ roles }) }) },
    async updateUserTeamIds(userId: string, teamIds: string[]) { await request(`/api/v1/admin/users/${userId}/team-assignments`, { method: 'PATCH', body: JSON.stringify({ teamIds }) }) },
    async updateUserStatus(userId: string, status: UserStatus) { await request(`/api/v1/admin/users/${userId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }) },
    async listCategories() { return categoriesResponseSchema.parse(await request('/api/v1/categories')) },
    async listSettingsCategories() { return categoriesResponseSchema.parse(await request('/api/v1/settings/categories')) },
    async createCategory(input: CreateCategoryInput) { return categorySchema.parse(await request('/api/v1/settings/categories', { method: 'POST', body: JSON.stringify(input) })) },
    async updateCategory(categoryId: string, input: UpdateCategoryInput) { return categorySchema.parse(await request(`/api/v1/settings/categories/${categoryId}`, { method: 'PATCH', body: JSON.stringify(input) })) },
    async listPlayers(teamId: string, includeInactive = false) { return playersResponseSchema.parse(await request(`/api/v1/teams/${teamId}/players${includeInactive ? '?includeInactive=true' : ''}`)) },
    async createPlayer(teamId: string, input: CreatePlayerInput) { return playerSchema.parse(await request(`/api/v1/teams/${teamId}/players`, { method: 'POST', body: JSON.stringify(input) })) },
    async updatePlayerStatus(teamId: string, playerId: string, status: 'active' | 'inactive' | 'archived') { return playerSchema.parse(await request(`/api/v1/teams/${teamId}/players/${playerId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })) },
    async todayAbsences(teamId: string) { return (await request(`/api/v1/teams/${teamId}/attendance/today`)) as { trainingDate: string; absentPlayerIds: string[] } },
    async todayAttendance(teamId: string): Promise<TodayAttendance> { return todayAttendanceSchema.parse(await request(`/api/v1/teams/${teamId}/attendance/daily`)) },
    async listMatches(teamId: string) { return (await request(`/api/v1/teams/${teamId}/matches`)) as { items: Array<{ id: string; opponentName: string; matchDate: string; status: string }> } },
    async attendanceSummary(teamId: string, fromMatchId?: string, toMatchId?: string): Promise<AttendanceSummary> {
      const params = new URLSearchParams()
      if (fromMatchId) params.set('fromMatchId', fromMatchId)
      if (toMatchId) params.set('toMatchId', toMatchId)
      return attendanceSummarySchema.parse(await request(`/api/v1/teams/${teamId}/attendance-summary?${params}`))
    },
    async markAbsence(teamId: string, playerId: string, trainingDate?: string): Promise<MarkAbsenceResponse> { return (await request(`/api/v1/teams/${teamId}/attendance/absence`, { method: 'POST', body: JSON.stringify({ playerId, trainingDate }) })) as MarkAbsenceResponse },
    async removeAbsence(teamId: string, playerId: string, trainingDate: string) { await request(`/api/v1/teams/${teamId}/attendance/absence/${playerId}?trainingDate=${encodeURIComponent(trainingDate)}`, { method: 'DELETE' }) },
    async updateConvocation(teamId: string, matchId: string, playerId: string, calledUp: boolean) { await request(`/api/v1/teams/${teamId}/matches/${matchId}/convocations/${playerId}`, { method: 'PATCH', body: JSON.stringify({ calledUp }) }) },
    async teamDetail(teamId: string): Promise<TeamDetail> { return teamDetailSchema.parse(await request(`/api/v1/teams/${teamId}`)) },
    async listTrainingSchedules(teamId: string): Promise<{ items: TrainingSchedule[] }> { return trainingSchedulesResponseSchema.parse(await request(`/api/v1/teams/${teamId}/training-schedules`)) },
    async replaceTrainingSchedules(teamId: string, schedules: Array<{ weekday: number; startsAt: string; endsAt: string; venueName?: string | null }>): Promise<{ items: TrainingSchedule[] }> { return trainingSchedulesResponseSchema.parse(await request(`/api/v1/teams/${teamId}/training-schedules`, { method: 'PUT', body: JSON.stringify({ schedules }) })) },
    async playerDetail(playerId: string): Promise<PlayerDetail> { return playerDetailSchema.parse(await request(`/api/v1/players/${playerId}`)) },
    async attendanceCalendar(fromDate?: string, toDate?: string, teamIds?: string[], centered = false): Promise<AttendanceCalendar> {
      const params = new URLSearchParams()
      if (fromDate) params.set('fromDate', fromDate)
      if (toDate) params.set('toDate', toDate)
      if (teamIds) params.set('teamIds', teamIds.join(','))
      if (centered) params.set('centered', 'true')
      return attendanceCalendarSchema.parse(await request(`/api/v1/dashboard/attendance?${params}`))
    },
    async matchRoster(teamId: string, matchId: string): Promise<MatchRoster> { return matchRosterSchema.parse(await request(`/api/v1/teams/${teamId}/matches/${matchId}/roster`)) },
    async createActivity(input: CreateActivityInput) { return (await request('/api/v1/activities', { method: 'POST', body: JSON.stringify(input) })) as PaginatedActivities['items'][number] },
    async updateActivity(activityId: string, input: UpdateActivityInput) { return (await request(`/api/v1/activities/${activityId}`, { method: 'PATCH', body: JSON.stringify(input) })) as PaginatedActivities['items'][number] },
    async listActivities(query: Partial<ListActivitiesQuery> = {}): Promise<PaginatedActivities> {
      const parsedQuery = listActivitiesQuerySchema.parse(query)
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(parsedQuery)) if (value !== undefined) params.set(key, String(value))
      return paginatedActivitiesSchema.parse(await request(`/api/v1/activities?${params}`))
    },
    async listTeams(query: Partial<ListTeamsQuery> = {}): Promise<PaginatedTeams> {
      const parsedQuery = listTeamsQuerySchema.parse(query)
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(parsedQuery)) if (value !== undefined) params.set(key, String(value))
      return paginatedTeamsSchema.parse(await request(`/api/v1/teams?${params}`))
    },
    async createTeam(input: CreateTeamInput) { return await request('/api/v1/teams', { method: 'POST', body: JSON.stringify(input) }) },
  }
}

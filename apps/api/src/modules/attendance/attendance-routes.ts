import type { FastifyInstance } from 'fastify'
import { attendanceCalendarSchema, createPlayerInputSchema, dateSchema, markAbsenceInputSchema, matchRosterSchema, playerDetailSchema, updatePlayerStatusInputSchema, uuidSchema } from '@club-basket/contracts'
import { recordAuditEvent } from '../../shared/audit.js'
import { canAccessTeam, canViewAllTeams, requireAuthenticatedUser, requireRole } from '../identity/auth-context.js'
import { requireCsrf } from '../identity/csrf.js'
import { attendanceCalendar, attendanceSummary, createPlayer, currentClubDate, findCurrentSeason, listAbsencesForDate, listSeasons, listTeamMatches, listTeamPlayers, markAbsence, matchRoster, playerDetail, removeAbsence, todayAttendance, updateConvocation, updatePlayerStatus } from './attendance-repository.js'

function params(request: { params: unknown }): { teamId: string; playerId?: string; matchId?: string } {
  return request.params as { teamId: string; playerId?: string; matchId?: string }
}

function forbidden(reply: { code: (status: number) => { send: (body: unknown) => unknown } }): unknown {
  return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'No tienes acceso a este equipo' } })
}

export async function attendanceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/seasons', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply)
    if (!user) return
    return { items: await listSeasons(user.clubId) }
  })

  app.get('/api/v1/seasons/current', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply)
    if (!user) return
    const season = await findCurrentSeason(user.clubId)
    if (!season) return reply.code(404).send({ error: { code: 'SEASON_NOT_FOUND', message: 'No hay una temporada configurada' } })
    return season
  })

  app.get('/api/v1/teams/:teamId/players', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply)
    if (!user) return
    const { teamId } = params(request)
    if (!canAccessTeam(user, teamId)) return forbidden(reply)
    const query = request.query as { includeInactive?: string }
    return { items: await listTeamPlayers(user.clubId, teamId, query.includeInactive === 'true') }
  })

  app.get('/api/v1/players/:playerId', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply)
    if (!user) return
    const detail = await playerDetail(user.clubId, String((request.params as { playerId: string }).playerId))
    if (!detail) return reply.code(404).send({ error: { code: 'PLAYER_NOT_FOUND', message: 'El jugador no existe' } })
    if (!detail.team) return reply.code(404).send({ error: { code: 'PLAYER_NOT_FOUND', message: 'El jugador no tiene un equipo accesible' } })
    if (!canAccessTeam(user, detail.team.id)) return forbidden(reply)
    return playerDetailSchema.parse(detail)
  })

  app.get('/api/v1/dashboard/attendance', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply)
    if (!user) return
    const query = request.query as { fromDate?: string; toDate?: string; teamIds?: string; centered?: string }
    const toDate = query.toDate ?? new Date().toISOString().slice(0, 10)
    const fromDate = query.fromDate ?? (() => { const date = new Date(`${toDate}T12:00:00`); date.setDate(date.getDate() - 89); return date.toISOString().slice(0, 10) })()
    if (!dateSchema.safeParse(fromDate).success || !dateSchema.safeParse(toDate).success || fromDate > toDate) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'El intervalo de fechas no es válido' } })
    const requestedTeamIds = query.teamIds === undefined ? undefined : query.teamIds.split(',').filter(Boolean)
    if (requestedTeamIds && requestedTeamIds.some((teamId) => !uuidSchema.safeParse(teamId).success)) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Los equipos del resumen no son válidos' } })
    if (requestedTeamIds && requestedTeamIds.some((teamId) => !user.teamIds.includes(teamId))) return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'No tienes acceso a uno de los equipos solicitados' } })
    const allowedTeamIds = requestedTeamIds ?? (canViewAllTeams(user) ? undefined : user.teamIds)
    return attendanceCalendarSchema.parse(await attendanceCalendar(user.clubId, fromDate, toDate, allowedTeamIds, query.centered === 'true'))
  })

  app.get('/api/v1/teams/:teamId/matches/:matchId/roster', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply)
    if (!user) return
    const { teamId, matchId } = params(request)
    if (!canAccessTeam(user, teamId)) return forbidden(reply)
    const roster = await matchRoster(user.clubId, teamId, matchId!)
    if (!roster) return reply.code(404).send({ error: { code: 'MATCH_NOT_FOUND', message: 'El partido no existe en el equipo' } })
    return matchRosterSchema.parse(roster)
  })

  app.post('/api/v1/teams/:teamId/players', async (request, reply) => {
    if (!(await requireCsrf(request, reply))) return
    const user = await requireRole(request, reply, ['club_admin', 'coordinator', 'coach'])
    if (!user) return
    const { teamId } = params(request)
    if (!canAccessTeam(user, teamId)) return forbidden(reply)
    const input = createPlayerInputSchema.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Los datos del jugador no son válidos', details: input.error.flatten() } })
    try {
      const player = await createPlayer(user.clubId, teamId, input.data)
      await recordAuditEvent({ clubId: user.clubId, actorUserId: user.id, action: 'player.created', entityType: 'player', entityId: player.id, metadata: { teamId } })
      return reply.code(201).send(player)
    } catch (error) {
      if (error instanceof Error && error.message.includes('no existe')) return reply.code(404).send({ error: { code: 'TEAM_NOT_FOUND', message: error.message } })
      throw error
    }
  })

  app.patch('/api/v1/teams/:teamId/players/:playerId/status', async (request, reply) => {
    if (!(await requireCsrf(request, reply))) return
    const user = await requireRole(request, reply, ['club_admin', 'coordinator', 'coach'])
    if (!user) return
    const { teamId, playerId } = params(request)
    if (!canAccessTeam(user, teamId)) return forbidden(reply)
    const input = updatePlayerStatusInputSchema.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'El estado del jugador no es válido' } })
    const player = await updatePlayerStatus(user.clubId, teamId, playerId!, input.data.status)
    if (!player) return reply.code(404).send({ error: { code: 'PLAYER_NOT_FOUND', message: 'El jugador no existe en el equipo' } })
    return player
  })

  app.get('/api/v1/teams/:teamId/attendance/daily', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply)
    if (!user) return
    const { teamId } = params(request)
    if (!canAccessTeam(user, teamId)) return forbidden(reply)
    return todayAttendance(user.clubId, teamId)
  })

  app.get('/api/v1/teams/:teamId/attendance/today', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply)
    if (!user) return
    const { teamId } = params(request)
    if (!canAccessTeam(user, teamId)) return forbidden(reply)
    return listAbsencesForDate(user.clubId, teamId, await currentClubDate(user.clubId))
  })

  app.get('/api/v1/teams/:teamId/matches', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply)
    if (!user) return
    const { teamId } = params(request)
    if (!canAccessTeam(user, teamId)) return forbidden(reply)
    return { items: await listTeamMatches(user.clubId, teamId) }
  })

  app.get('/api/v1/teams/:teamId/attendance-summary', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply)
    if (!user) return
    const { teamId } = params(request)
    if (!canAccessTeam(user, teamId)) return forbidden(reply)
    const query = request.query as { fromMatchId?: string; toMatchId?: string }
    return attendanceSummary(user.clubId, teamId, query.fromMatchId, query.toMatchId)
  })

  app.post('/api/v1/teams/:teamId/attendance/absence', async (request, reply) => {
    if (!(await requireCsrf(request, reply))) return
    const user = await requireRole(request, reply, ['club_admin', 'coordinator', 'coach', 'assistant'])
    if (!user) return
    const { teamId } = params(request)
    if (!canAccessTeam(user, teamId)) return forbidden(reply)
    const input = markAbsenceInputSchema.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Los datos de asistencia no son válidos', details: input.error.flatten() } })
    const trainingDate = input.data.trainingDate ?? await currentClubDate(user.clubId)
    const today = await currentClubDate(user.clubId)
    if (trainingDate > today) return reply.code(400).send({ error: { code: 'FUTURE_ATTENDANCE', message: 'No se puede registrar una falta en una fecha futura' } })
    try {
      return reply.code(201).send(await markAbsence({ clubId: user.clubId, teamId, playerId: input.data.playerId, trainingDate, recordedBy: user.id }))
    } catch (error) {
      if (error instanceof Error && (error.message.includes('no existe') || error.message.includes('no pertenece'))) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: error.message } })
      throw error
    }
  })

  app.patch('/api/v1/teams/:teamId/matches/:matchId/convocations/:playerId', async (request, reply) => {
    if (!(await requireCsrf(request, reply))) return
    const user = await requireRole(request, reply, ['club_admin', 'coordinator', 'coach', 'assistant'])
    if (!user) return
    const { teamId, matchId, playerId } = params(request)
    if (!canAccessTeam(user, teamId)) return forbidden(reply)
    const body = request.body as { calledUp?: boolean }
    if (typeof body.calledUp !== 'boolean') return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'calledUp debe ser booleano' } })
    try {
      await updateConvocation({ clubId: user.clubId, teamId, matchId: matchId!, playerId: playerId!, calledUp: body.calledUp, updatedBy: user.id })
      return reply.code(204).send()
    } catch (error) {
      if (error instanceof Error && error.message.includes('no pertenece')) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: error.message } })
      throw error
    }
  })

  app.delete('/api/v1/teams/:teamId/attendance/absence/:playerId', async (request, reply) => {
    if (!(await requireCsrf(request, reply))) return
    const user = await requireRole(request, reply, ['club_admin', 'coordinator', 'coach', 'assistant'])
    if (!user) return
    const { teamId, playerId } = params(request)
    if (!canAccessTeam(user, teamId)) return forbidden(reply)
    const query = request.query as { trainingDate?: string }
    const trainingDate = query.trainingDate ?? new Date().toISOString().slice(0, 10)
    if (!dateSchema.safeParse(trainingDate).success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'La fecha no es válida' } })
    await removeAbsence({ clubId: user.clubId, teamId, playerId: playerId!, trainingDate })
    return reply.code(204).send()
  })
}

import type { FastifyInstance } from 'fastify'
import { createPlayerInputSchema, dateSchema, updatePlayerStatusInputSchema } from '@club-basket/contracts'
import { canRegisterAttendance } from '@club-basket/domain'
import { recordAuditEvent } from '../../shared/audit.js'
import { requireAuthenticatedUser, requireRole } from '../identity/auth-context.js'
import { requireCsrf } from '../identity/csrf.js'
import { attendanceSummary, createPlayer, findCurrentSeason, listAbsencesForDate, listSeasons, listTeamMatches, listTeamPlayers, markAbsence, removeAbsence, updateConvocation, updatePlayerStatus } from './attendance-repository.js'

function params(request: { params: unknown }): { teamId: string; playerId?: string } {
  return request.params as { teamId: string; playerId?: string }
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
    const query = request.query as { includeInactive?: string }
    return { items: await listTeamPlayers(user.clubId, params(request).teamId, query.includeInactive === 'true') }
  })

  app.post('/api/v1/teams/:teamId/players', async (request, reply) => {
    if (!(await requireCsrf(request, reply))) return
    const user = await requireRole(request, reply, ['club_admin', 'coordinator', 'coach'])
    if (!user) return
    const input = createPlayerInputSchema.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Los datos del jugador no son válidos', details: input.error.flatten() } })
    try {
      const player = await createPlayer(user.clubId, params(request).teamId, input.data)
      await recordAuditEvent({ clubId: user.clubId, actorUserId: user.id, action: 'player.created', entityType: 'player', entityId: player.id, metadata: { teamId: params(request).teamId } })
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
    const input = updatePlayerStatusInputSchema.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'El estado del jugador no es válido' } })
    const player = await updatePlayerStatus(user.clubId, params(request).teamId, params(request).playerId!, input.data.status)
    if (!player) return reply.code(404).send({ error: { code: 'PLAYER_NOT_FOUND', message: 'El jugador no existe en el equipo' } })
    await recordAuditEvent({ clubId: user.clubId, actorUserId: user.id, action: 'player.status_updated', entityType: 'player', entityId: player.id, metadata: { teamId: params(request).teamId, status: input.data.status } })
    return player
  })

  app.get('/api/v1/teams/:teamId/attendance/today', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply)
    if (!user) return
    const trainingDate = new Date().toISOString().slice(0, 10)
    return listAbsencesForDate(user.clubId, params(request).teamId, trainingDate)
  })

  app.get('/api/v1/teams/:teamId/matches', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply)
    if (!user) return
    return { items: await listTeamMatches(user.clubId, params(request).teamId) }
  })

  app.get('/api/v1/teams/:teamId/attendance-summary', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply)
    if (!user) return
    const query = request.query as { fromMatchId?: string; toMatchId?: string }
    return attendanceSummary(user.clubId, params(request).teamId, query.fromMatchId, query.toMatchId)
  })

  app.post('/api/v1/teams/:teamId/attendance/absence', async (request, reply) => {
    if (!(await requireCsrf(request, reply))) return
    const user = await requireAuthenticatedUser(request, reply)
    if (!user) return
    if (!canRegisterAttendance(user.role)) return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'No tienes permiso para registrar asistencia' } })
    const body = request.body as { playerId?: string }
    const team = params(request)
    const trainingDate = new Date().toISOString().slice(0, 10)
    if (!body.playerId || !dateSchema.safeParse(trainingDate).success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'El jugador no es válido' } })
    try {
      const result = await markAbsence({ clubId: user.clubId, teamId: team.teamId, playerId: body.playerId, trainingDate, recordedBy: user.id })
      await recordAuditEvent({ clubId: user.clubId, actorUserId: user.id, action: 'attendance.absence_marked', entityType: 'player', entityId: body.playerId, metadata: { trainingDate } })
      return reply.code(201).send(result)
    } catch (error) {
      if (error instanceof Error && (error.message.includes('no existe') || error.message.includes('no pertenece'))) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: error.message } })
      throw error
    }
  })

  app.patch('/api/v1/teams/:teamId/matches/:matchId/convocations/:playerId', async (request, reply) => {
    if (!(await requireCsrf(request, reply))) return
    const user = await requireRole(request, reply, ['club_admin', 'coordinator', 'coach', 'assistant'])
    if (!user) return
    const body = request.body as { calledUp?: boolean }
    if (typeof body.calledUp !== 'boolean') return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'calledUp debe ser booleano' } })
    const team = params(request)
    const matchId = String((request.params as { matchId: string }).matchId)
    try {
      await updateConvocation({ clubId: user.clubId, teamId: team.teamId, matchId, playerId: team.playerId!, calledUp: body.calledUp, updatedBy: user.id })
      await recordAuditEvent({ clubId: user.clubId, actorUserId: user.id, action: 'attendance.convocation_updated', entityType: 'player', entityId: team.playerId, metadata: { matchId, calledUp: body.calledUp } })
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
    const query = request.query as { trainingDate?: string }
    const trainingDate = query.trainingDate ?? new Date().toISOString().slice(0, 10)
    if (!dateSchema.safeParse(trainingDate).success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'La fecha no es válida' } })
    await removeAbsence({ clubId: user.clubId, teamId: params(request).teamId, playerId: params(request).playerId!, trainingDate })
    return reply.code(204).send()
  })
}

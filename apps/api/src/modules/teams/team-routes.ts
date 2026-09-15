import type { FastifyInstance } from 'fastify'
import { createTeamInputSchema, listTeamsQuerySchema, teamDetailSchema, trainingSchedulesResponseSchema, upsertTrainingSchedulesInputSchema } from '@club-basket/contracts'
import { canManageTeam } from '@club-basket/domain'
import { requireAuthenticatedUser, canAccessTeam, canViewAllTeams } from '../identity/auth-context.js'
import { createTeam, findTeam, listTeamCoaches, listTeams, listTrainingSchedules, replaceTrainingSchedules } from './team-repository.js'
import { listTeamPlayers } from '../attendance/attendance-repository.js'
import { requireCsrf } from '../identity/csrf.js'

export async function teamRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/teams', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply)
    if (!user) return

    const query = listTeamsQuerySchema.safeParse(request.query)
    if (!query.success) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Los filtros de equipos no son válidos', details: query.error.flatten() },
      })
    }

    return listTeams(user.clubId, query.data, canViewAllTeams(user) ? undefined : user.teamIds)
  })

  app.get('/api/v1/teams/:teamId', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply)
    if (!user) return
    const teamId = String((request.params as { teamId: string }).teamId)
    if (!canAccessTeam(user, teamId)) return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'No tienes acceso a este equipo' } })
    const team = await findTeam(user.clubId, teamId)
    if (!team) return reply.code(404).send({ error: { code: 'TEAM_NOT_FOUND', message: 'El equipo no existe' } })
    return teamDetailSchema.parse({ team, players: await listTeamPlayers(user.clubId, teamId, true), coaches: await listTeamCoaches(user.clubId, teamId) })
  })

  app.get('/api/v1/teams/:teamId/training-schedules', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply)
    if (!user) return
    const teamId = String((request.params as { teamId: string }).teamId)
    if (!canAccessTeam(user, teamId)) return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'No tienes acceso a este equipo' } })
    return trainingSchedulesResponseSchema.parse({ items: await listTrainingSchedules(user.clubId, teamId) })
  })

  app.put('/api/v1/teams/:teamId/training-schedules', async (request, reply) => {
    if (!(await requireCsrf(request, reply))) return
    const user = await requireAuthenticatedUser(request, reply)
    if (!user) return
    if (!user.roles.some((role) => role === 'club_admin' || role === 'coordinator' || role === 'coach')) return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'No tienes permiso para modificar horarios' } })
    const teamId = String((request.params as { teamId: string }).teamId)
    if (!canAccessTeam(user, teamId)) return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'No tienes acceso a este equipo' } })
    const input = upsertTrainingSchedulesInputSchema.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Los horarios no son válidos', details: input.error.flatten() } })
    return trainingSchedulesResponseSchema.parse({ items: await replaceTrainingSchedules(user.clubId, teamId, input.data) })
  })

  app.post('/api/v1/teams', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply)
    if (!user) return

    if (!canManageTeam(user.role)) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'No tienes permiso para crear equipos' } })
    }

    const input = createTeamInputSchema.safeParse(request.body)
    if (!input.success) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Los datos del equipo no son válidos', details: input.error.flatten() },
      })
    }

    const team = await createTeam(user.clubId, input.data)
    return reply.code(201).send(team)
  })
}

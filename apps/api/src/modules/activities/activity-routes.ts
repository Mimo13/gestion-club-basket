import type { FastifyInstance } from 'fastify'
import { createActivityInputSchema, listActivitiesQuerySchema, paginatedActivitiesSchema, updateActivityInputSchema } from '@club-basket/contracts'
import { canManageActivity } from '@club-basket/domain'
import { recordAuditEvent } from '../../shared/audit.js'
import { canAccessTeam, canViewAllTeams, requireAuthenticatedUser } from '../identity/auth-context.js'
import { createActivity, listActivities, updateActivity } from './activity-repository.js'

export async function activityRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/v1/activities', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply)
    if (!user) return
    if (!canManageActivity(user.role)) return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'No tienes permiso para crear actividades' } })
    const input = createActivityInputSchema.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Los datos de la actividad no son válidos', details: input.error.flatten() } })
    try {
      const activity = await createActivity(user.clubId, input.data, canViewAllTeams(user) ? undefined : user.teamIds)
      await recordAuditEvent({ clubId: user.clubId, actorUserId: user.id, action: 'activity.created', entityType: 'activity', entityId: activity.id, metadata: { type: activity.type, teamId: activity.teamId } })
      return reply.code(201).send(activity)
    } catch (error) {
      if (error instanceof Error && error.message.includes('no existe')) return reply.code(404).send({ error: { code: 'TEAM_NOT_FOUND', message: error.message } })
      throw error
    }
  })

  app.patch('/api/v1/activities/:activityId', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply)
    if (!user) return
    if (!canManageActivity(user.role)) return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'No tienes permiso para editar actividades' } })
    const input = updateActivityInputSchema.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Los datos de la actividad no son válidos', details: input.error.flatten() } })
    const activityId = String((request.params as { activityId: string }).activityId)
    try {
      const activity = await updateActivity(user.clubId, activityId, input.data, canViewAllTeams(user) ? undefined : user.teamIds)
      if (!activity) return reply.code(404).send({ error: { code: 'ACTIVITY_NOT_FOUND', message: 'La actividad no existe' } })
      await recordAuditEvent({ clubId: user.clubId, actorUserId: user.id, action: 'activity.updated', entityType: 'activity', entityId: activity.id, metadata: { type: activity.type, teamId: activity.teamId, status: activity.status } })
      return reply.send(activity)
    } catch (error) {
      if (error instanceof Error && error.message.includes('tipo')) return reply.code(400).send({ error: { code: 'ACTIVITY_TYPE_IMMUTABLE', message: error.message } })
      if (error instanceof Error && error.message.includes('equipo')) return reply.code(404).send({ error: { code: 'TEAM_NOT_FOUND', message: error.message } })
      throw error
    }
  })

  app.get('/api/v1/activities', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply)
    if (!user) return

    const query = listActivitiesQuerySchema.safeParse(request.query)
    if (!query.success) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'Los filtros de agenda no son válidos', details: query.error.flatten() },
      })
    }

    return paginatedActivitiesSchema.parse(await listActivities(user.clubId, query.data, canViewAllTeams(user) ? undefined : user.teamIds))
  })
}

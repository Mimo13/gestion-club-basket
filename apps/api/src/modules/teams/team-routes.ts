import type { FastifyInstance } from 'fastify'
import { createTeamInputSchema, listTeamsQuerySchema } from '@club-basket/contracts'
import { canManageTeam } from '@club-basket/domain'
import { requireAuthenticatedUser } from '../identity/auth-context.js'
import { createTeam, listTeams } from './team-repository.js'

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

    return listTeams(user.clubId, query.data)
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

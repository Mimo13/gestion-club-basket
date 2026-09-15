import type { FastifyInstance } from 'fastify'
import { createManagedUserInputSchema, updateUserRolesInputSchema, updateUserTeamIdsInputSchema, updateUserStatusInputSchema, managedUsersResponseSchema } from '@club-basket/contracts'
import { recordAuditEvent } from '../../shared/audit.js'
import { requireRole, hasRole } from './auth-context.js'
import { changeMembershipRoles, changeUserStatus, changeUserTeamIds, createInvitedUser, createPasswordResetToken, findManagedUsers } from './auth-repository.js'
import { sendPasswordResetEmail } from './mailer.js'
import { requireCsrf } from './csrf.js'

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/v1/admin/users', async (request, reply) => {
    if (!(await requireCsrf(request, reply))) return
    const actor = await requireRole(request, reply, ['club_admin', 'coordinator'])
    if (!actor) return
    const input = createManagedUserInputSchema.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Los datos del usuario no son válidos' } })
    if (!hasRole(actor, 'club_admin') && input.data.roles.includes('club_admin')) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Sólo un super-admin puede asignar ese perfil' } })
    }
    try {
      const user = await createInvitedUser({ ...input.data, clubId: actor.clubId })
      const token = await createPasswordResetToken(user.email, new Date(Date.now() + 24 * 60 * 60 * 1000))
      if (token) {
        await sendPasswordResetEmail({ to: user.email, token })
        if (process.env.NODE_ENV !== 'production') request.log.info({ passwordResetToken: token }, 'Token de invitación de desarrollo')
      }
      await recordAuditEvent({ clubId: actor.clubId, actorUserId: actor.id, action: 'admin.user_invited', entityType: 'user', entityId: user.id })
      return reply.code(201).send(user)
    } catch (error) {
      if ((error as { code?: string }).code === '23505') return reply.code(409).send({ error: { code: 'USER_EXISTS', message: 'Ya existe un usuario con ese email' } })
      throw error
    }
  })

  app.get('/api/v1/admin/users', async (request, reply) => {
    const user = await requireRole(request, reply, ['club_admin', 'coordinator'])
    if (!user) return
    return managedUsersResponseSchema.parse({ items: await findManagedUsers(user.clubId) })
  })

  app.patch('/api/v1/admin/users/:userId/roles', async (request, reply) => {
    if (!(await requireCsrf(request, reply))) return
    const actor = await requireRole(request, reply, ['club_admin', 'coordinator'])
    if (!actor) return
    const input = updateUserRolesInputSchema.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Los perfiles no son válidos' } })
    if (!hasRole(actor, 'club_admin') && input.data.roles.includes('club_admin')) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Sólo un super-admin puede asignar ese perfil' } })
    }
    const userId = String((request.params as { userId: string }).userId)
    if (userId === actor.id && !input.data.roles.includes('club_admin')) return reply.code(400).send({ error: { code: 'SELF_ROLE_CHANGE', message: 'No puedes quitarte el perfil de administrador' } })
    await changeMembershipRoles(actor.clubId, userId, input.data.roles)
    if (!input.data.roles.includes('coach') && !input.data.roles.includes('assistant')) {
      await changeUserTeamIds(actor.clubId, userId, [], actor.id)
    }
    await recordAuditEvent({ clubId: actor.clubId, actorUserId: actor.id, action: 'admin.roles_changed', entityType: 'user', entityId: userId, metadata: { roles: input.data.roles } })
    return reply.code(204).send()
  })

  app.patch('/api/v1/admin/users/:userId/team-assignments', async (request, reply) => {
    if (!(await requireCsrf(request, reply))) return
    const actor = await requireRole(request, reply, ['club_admin', 'coordinator'])
    if (!actor) return
    const input = updateUserTeamIdsInputSchema.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Los equipos asignados no son válidos' } })
    const userId = String((request.params as { userId: string }).userId)
    await changeUserTeamIds(actor.clubId, userId, input.data.teamIds, actor.id)
    await recordAuditEvent({ clubId: actor.clubId, actorUserId: actor.id, action: 'admin.coach_teams_changed', entityType: 'user', entityId: userId, metadata: { teamIds: input.data.teamIds } })
    return reply.code(204).send()
  })

  app.patch('/api/v1/admin/users/:userId/role', async (request, reply) => {
    if (!(await requireCsrf(request, reply))) return
    const actor = await requireRole(request, reply, ['club_admin', 'coordinator'])
    if (!actor) return
    const input = updateUserRolesInputSchema.safeParse({ roles: [((request.body as { role?: string }).role)] })
    if (!input.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'El perfil no es válido' } })
    if (!hasRole(actor, 'club_admin') && input.data.roles.includes('club_admin')) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Sólo un super-admin puede asignar ese perfil' } })
    }
    const userId = String((request.params as { userId: string }).userId)
    if (userId === actor.id && input.data.roles[0] !== 'club_admin') return reply.code(400).send({ error: { code: 'SELF_ROLE_CHANGE', message: 'No puedes quitarte el perfil de administrador' } })
    await changeMembershipRoles(actor.clubId, userId, input.data.roles)
    return reply.code(204).send()
  })

  app.patch('/api/v1/admin/users/:userId/status', async (request, reply) => {
    if (!(await requireCsrf(request, reply))) return
    const actor = await requireRole(request, reply, ['club_admin', 'coordinator'])
    if (!actor) return
    const input = updateUserStatusInputSchema.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'El estado no es válido' } })
    const userId = String((request.params as { userId: string }).userId)
    if (userId === actor.id && input.data.status !== 'active') return reply.code(400).send({ error: { code: 'SELF_LOCKOUT', message: 'No puedes desactivar tu propia cuenta' } })
    await changeUserStatus(actor.clubId, userId, input.data.status)
    await recordAuditEvent({ clubId: actor.clubId, actorUserId: actor.id, action: 'admin.status_changed', entityType: 'user', entityId: userId, metadata: { status: input.data.status } })
    return reply.code(204).send()
  })
}

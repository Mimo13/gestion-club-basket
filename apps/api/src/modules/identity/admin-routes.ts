import type { FastifyInstance } from 'fastify'
import { createManagedUserInputSchema, updateUserRoleInputSchema, updateUserStatusInputSchema, managedUsersResponseSchema } from '@club-basket/contracts'
import { recordAuditEvent } from '../../shared/audit.js'
import { requireRole } from './auth-context.js'
import { changeMembershipRole, changeUserStatus, createInvitedUser, createPasswordResetToken, findManagedUsers } from './auth-repository.js'
import { sendPasswordResetEmail } from './mailer.js'
import { requireCsrf } from './csrf.js'

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/v1/admin/users', async (request, reply) => {
    if (!(await requireCsrf(request, reply))) return
    const actor = await requireRole(request, reply, ['club_admin'])
    if (!actor) return
    const input = createManagedUserInputSchema.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Los datos del usuario no son válidos' } })
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
    const user = await requireRole(request, reply, ['club_admin'])
    if (!user) return
    return managedUsersResponseSchema.parse({ items: await findManagedUsers(user.clubId) })
  })

  app.patch('/api/v1/admin/users/:userId/role', async (request, reply) => {
    if (!(await requireCsrf(request, reply))) return
    const actor = await requireRole(request, reply, ['club_admin'])
    if (!actor) return
    const input = updateUserRoleInputSchema.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'El rol no es válido' } })
    const userId = String((request.params as { userId: string }).userId)
    if (userId === actor.id && input.data.role !== 'club_admin') {
      return reply.code(400).send({ error: { code: 'SELF_ROLE_CHANGE', message: 'No puedes quitarte el rol de administrador' } })
    }
    await changeMembershipRole(actor.clubId, userId, input.data.role)
    await recordAuditEvent({ clubId: actor.clubId, actorUserId: actor.id, action: 'admin.role_changed', entityType: 'user', entityId: userId, metadata: { role: input.data.role } })
    return reply.code(204).send()
  })

  app.patch('/api/v1/admin/users/:userId/status', async (request, reply) => {
    if (!(await requireCsrf(request, reply))) return
    const actor = await requireRole(request, reply, ['club_admin'])
    if (!actor) return
    const input = updateUserStatusInputSchema.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'El estado no es válido' } })
    const userId = String((request.params as { userId: string }).userId)
    if (userId === actor.id && input.data.status !== 'active') {
      return reply.code(400).send({ error: { code: 'SELF_LOCKOUT', message: 'No puedes desactivar tu propia cuenta' } })
    }
    await changeUserStatus(actor.clubId, userId, input.data.status)
    await recordAuditEvent({ clubId: actor.clubId, actorUserId: actor.id, action: 'admin.status_changed', entityType: 'user', entityId: userId, metadata: { status: input.data.status } })
    return reply.code(204).send()
  })
}

import type { FastifyInstance } from 'fastify'
import {
  changePasswordInputSchema,
  forgotPasswordInputSchema,
  loginInputSchema,
  resetPasswordInputSchema,
  sessionResponseSchema,
} from '@club-basket/contracts'
import { env } from '../../config/env.js'
import { recordAuditEvent } from '../../shared/audit.js'
import { MemoryRateLimiter } from '../../shared/rate-limit.js'
import { sendPasswordResetEmail } from './mailer.js'
import { getAuthenticatedUser, getRequestSessionToken, requireAuthenticatedUser, SESSION_COOKIE } from './auth-context.js'
import {
  consumePasswordResetToken,
  createPasswordResetToken,
  createSession,
  findUserForLogin,
  revokeSession,
  updateUserPassword,
} from './auth-repository.js'
import { requireCsrf, setCsrfCookie } from './csrf.js'
import { hashPassword, verifyPassword } from './password.js'

const SESSION_MAX_AGE_SECONDS = env.SESSION_TTL_DAYS * 24 * 60 * 60
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000
const loginLimiter = new MemoryRateLimiter(10, 15 * 60 * 1000)
const recoveryLimiter = new MemoryRateLimiter(5, 60 * 60 * 1000)

function requestIp(request: { ip: string }): string {
  return request.ip || 'unknown'
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/v1/auth/login', async (request, reply) => {
    const input = loginInputSchema.safeParse(request.body)
    if (!input.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Las credenciales no son válidas', details: input.error.flatten() } })
    }
    const limiterKey = `${requestIp(request)}:${input.data.email}`
    if (!loginLimiter.isAllowed(limiterKey)) {
      return reply.code(429).send({ error: { code: 'RATE_LIMITED', message: 'Demasiados intentos. Espera unos minutos.' } })
    }

    const user = await findUserForLogin(input.data.email)
    const valid = user?.password_hash ? await verifyPassword(input.data.password, user.password_hash) : false
    if (!user || !valid) {
      if (user) await recordAuditEvent({ clubId: user.club_id, actorUserId: user.id, action: 'auth.login_failed', entityType: 'user', entityId: user.id })
      return reply.code(401).send({ error: { code: 'INVALID_CREDENTIALS', message: 'Email o contraseña incorrectos' } })
    }

    loginLimiter.clear(limiterKey)
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000)
    const token = await createSession(user.id, expiresAt)
    if (input.data.client === 'web') {
      reply.setCookie(SESSION_COOKIE, token, { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESSION_MAX_AGE_SECONDS })
      setCsrfCookie(reply)
    }
    await recordAuditEvent({ clubId: user.club_id, actorUserId: user.id, action: 'auth.login', entityType: 'user', entityId: user.id })

    return reply.send(sessionResponseSchema.parse({
      user: { id: user.id, email: user.email, displayName: user.display_name, clubId: user.club_id, role: user.role },
      expiresAt: expiresAt.toISOString(),
      accessToken: input.data.client === 'mobile' ? token : undefined,
    }))
  })

  app.get('/api/v1/auth/session', async (request, reply) => {
    const user = await getAuthenticatedUser(request)
    if (!user) return reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'No hay una sesión activa' } })
    return sessionResponseSchema.parse({ user, expiresAt: undefined })
  })

  app.post('/api/v1/auth/logout', async (request, reply) => {
    if (!(await requireCsrf(request, reply))) return
    const token = getRequestSessionToken(request)
    const user = await getAuthenticatedUser(request)
    if (token) await revokeSession(token)
    if (user) await recordAuditEvent({ clubId: user.clubId, actorUserId: user.id, action: 'auth.logout', entityType: 'user', entityId: user.id })
    reply.clearCookie(SESSION_COOKIE, { path: '/' })
    reply.clearCookie('club_basket_csrf', { path: '/' })
    return reply.code(204).send()
  })

  app.post('/api/v1/auth/forgot-password', async (request, reply) => {
    const input = forgotPasswordInputSchema.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'El email no es válido' } })
    if (!recoveryLimiter.isAllowed(`${requestIp(request)}:${input.data.email}`)) {
      return reply.code(429).send({ error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes. Espera unos minutos.' } })
    }
    const token = await createPasswordResetToken(input.data.email, new Date(Date.now() + RESET_TOKEN_TTL_MS))
    if (token) {
      const user = await findUserForLogin(input.data.email)
      if (user) await recordAuditEvent({ clubId: user.club_id, actorUserId: user.id, action: 'auth.password_reset_requested', entityType: 'user', entityId: user.id })
      await sendPasswordResetEmail({ to: input.data.email, token })
      if (env.NODE_ENV !== 'production') request.log.info({ passwordResetToken: token }, 'Token de recuperación de desarrollo')
    }
    return reply.send({ message: 'Si existe una cuenta, recibirás instrucciones para recuperar la contraseña.' })
  })

  app.post('/api/v1/auth/reset-password', async (request, reply) => {
    const input = resetPasswordInputSchema.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Los datos de recuperación no son válidos' } })
    const userId = await consumePasswordResetToken(input.data.token)
    if (!userId) return reply.code(400).send({ error: { code: 'INVALID_RESET_TOKEN', message: 'El enlace no es válido o ha caducado' } })
    await updateUserPassword(userId, await hashPassword(input.data.password))
    return reply.code(204).send()
  })

  app.post('/api/v1/auth/change-password', async (request, reply) => {
    if (!(await requireCsrf(request, reply))) return
    const user = await requireAuthenticatedUser(request, reply)
    if (!user) return
    const input = changePasswordInputSchema.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'La nueva contraseña no es válida' } })
    const stored = await findUserForLogin(user.email)
    if (!stored?.password_hash || !(await verifyPassword(input.data.currentPassword, stored.password_hash))) {
      return reply.code(401).send({ error: { code: 'INVALID_CREDENTIALS', message: 'La contraseña actual no es correcta' } })
    }
    await updateUserPassword(user.id, await hashPassword(input.data.newPassword), getRequestSessionToken(request))
    await recordAuditEvent({ clubId: user.clubId, actorUserId: user.id, action: 'auth.password_changed', entityType: 'user', entityId: user.id })
    return reply.code(204).send()
  })

}

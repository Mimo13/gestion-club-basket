import type { FastifyInstance } from 'fastify'
import { loginInputSchema, sessionResponseSchema } from '@club-basket/contracts'
import { env } from '../../config/env.js'
import { createSession, findUserForLogin, revokeSession } from './auth-repository.js'
import { getAuthenticatedUser, getRequestSessionToken, SESSION_COOKIE } from './auth-context.js'
import { verifyPassword } from './password.js'

const SESSION_MAX_AGE_SECONDS = env.SESSION_TTL_DAYS * 24 * 60 * 60

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/v1/auth/login', async (request, reply) => {
    const input = loginInputSchema.safeParse(request.body)
    if (!input.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Las credenciales no son válidas', details: input.error.flatten() } })
    }

    const user = await findUserForLogin(input.data.email)
    const valid = user?.password_hash ? await verifyPassword(input.data.password, user.password_hash) : false
    if (!user || !valid) {
      return reply.code(401).send({ error: { code: 'INVALID_CREDENTIALS', message: 'Email o contraseña incorrectos' } })
    }

    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000)
    const token = await createSession(user.id, expiresAt)
    if (input.data.client === 'web') {
      reply.setCookie(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_MAX_AGE_SECONDS,
      })
    }

    const response = sessionResponseSchema.parse({
      user: { id: user.id, email: user.email, displayName: user.display_name, clubId: user.club_id, role: user.role },
      expiresAt: expiresAt.toISOString(),
      accessToken: input.data.client === 'mobile' ? token : undefined,
    })
    return reply.send(response)
  })

  app.get('/api/v1/auth/session', async (request, reply) => {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'No hay una sesión activa' } })
    }
    return sessionResponseSchema.parse({ user, expiresAt: undefined })
  })

  app.post('/api/v1/auth/logout', async (request, reply) => {
    const token = getRequestSessionToken(request)
    if (token) await revokeSession(token)
    reply.clearCookie(SESSION_COOKIE, { path: '/' })
    return reply.code(204).send()
  })
}

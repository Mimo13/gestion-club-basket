import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import Fastify from 'fastify'
import { healthResponseSchema } from '@club-basket/contracts'
import { env } from './config/env.js'
import { adminRoutes } from './modules/identity/admin-routes.js'
import { authRoutes } from './modules/identity/auth-routes.js'
import { teamRoutes } from './modules/teams/team-routes.js'

export function buildApp() {
  const app = Fastify({ logger: env.NODE_ENV !== 'test', trustProxy: env.NODE_ENV === 'production' })

  app.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('X-Frame-Options', 'DENY')
    reply.header('Referrer-Policy', 'same-origin')
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  })

  void app.register(cookie)
  void app.register(cors, { origin: env.CORS_ORIGIN, credentials: true })

  app.get('/api/v1/health', async () => {
    return healthResponseSchema.parse({
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString(),
    })
  })

  void app.register(authRoutes)
  void app.register(adminRoutes)
  void app.register(teamRoutes)

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error)
    return reply.code(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Se produjo un error interno' },
    })
  })

  return app
}

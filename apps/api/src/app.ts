import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import Fastify from 'fastify'
import { healthResponseSchema } from '@club-basket/contracts'
import { env } from './config/env.js'
import { authRoutes } from './modules/identity/auth-routes.js'
import { teamRoutes } from './modules/teams/team-routes.js'

export function buildApp() {
  const app = Fastify({ logger: env.NODE_ENV !== 'test' })

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
  void app.register(teamRoutes)

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error)
    return reply.code(500).send({
      error: { code: 'INTERNAL_ERROR', message: 'Se produjo un error interno' },
    })
  })

  return app
}

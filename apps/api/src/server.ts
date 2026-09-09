import { buildApp } from './app.js'
import { env } from './config/env.js'
import { closeDatabase } from './database/client.js'

const app = buildApp()

try {
  await app.listen({ host: env.API_HOST, port: env.API_PORT })
} catch (error) {
  app.log.error(error)
  await closeDatabase()
  process.exit(1)
}

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'Apagando API')
  await app.close()
  await closeDatabase()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))

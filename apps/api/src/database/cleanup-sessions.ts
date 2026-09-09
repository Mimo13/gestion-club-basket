import { cleanupExpiredSessions } from '../modules/identity/auth-repository.js'
import { closeDatabase } from './client.js'

try {
  console.log(`Sesiones eliminadas: ${await cleanupExpiredSessions()}`)
} finally {
  await closeDatabase()
}

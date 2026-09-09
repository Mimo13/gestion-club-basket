import { cleanupExpiredSessions } from './auth-repository.js'
import { db, closeDatabase } from '../../database/client.js'

try {
  const sessions = await cleanupExpiredSessions()
  const resetTokens = await db.query(`DELETE FROM password_reset_tokens WHERE expires_at <= now() OR used_at < now() - interval '1 day'`)
  console.log(`Limpieza completada: ${sessions} sesiones y ${resetTokens.rowCount ?? 0} tokens`)
} finally {
  await closeDatabase()
}

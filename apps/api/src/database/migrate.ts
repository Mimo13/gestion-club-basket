import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db, closeDatabase } from './client.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.join(currentDir, 'migrations')

await db.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`)

const existingMigration = await db.query<{ version: string }>(
  'SELECT version FROM schema_migrations WHERE version = $1',
  ['001_initial_schema'],
)
const hasInitialSchema = await db.query<{ exists: boolean }>(
  "SELECT to_regclass('public.clubs') IS NOT NULL AS exists",
)
if (existingMigration.rowCount === 0 && hasInitialSchema.rows[0]?.exists === true) {
  await db.query('INSERT INTO schema_migrations (version) VALUES ($1)', ['001_initial_schema'])
}

const files = (await fs.readdir(migrationsDir))
  .filter((file) => file.endsWith('.sql'))
  .sort()

for (const file of files) {
  const version = file.replace(/\.sql$/, '')
  const applied = await db.query('SELECT 1 FROM schema_migrations WHERE version = $1', [version])
  if (applied.rowCount) continue

  const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8')
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version])
    await client.query('COMMIT')
    console.log(`Migración aplicada: ${version}`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

await closeDatabase()
console.log('Migraciones completadas')

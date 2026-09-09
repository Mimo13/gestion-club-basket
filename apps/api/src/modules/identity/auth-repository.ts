import { createHmac, randomBytes } from 'node:crypto'
import type { Role } from '@club-basket/contracts'
import { env } from '../../config/env.js'
import { db } from '../../database/client.js'

const SESSION_BYTES = 32

export interface AuthenticatedUser {
  id: string
  email: string
  displayName: string
  clubId: string
  role: Role
}

interface UserRow {
  id: string
  email: string
  display_name: string
  password_hash: string | null
  club_id: string
  role: Role
}

function mapUser(row: UserRow): AuthenticatedUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    clubId: row.club_id,
    role: row.role,
  }
}

function hashSessionToken(token: string): string {
  return createHmac('sha256', env.SESSION_SECRET).update(token).digest('hex')
}

const userQuery = `
  SELECT u.id, u.email, u.display_name, u.password_hash, cm.club_id, cm.role
  FROM users u
  JOIN club_memberships cm ON cm.user_id = u.id
`

export async function findUserForLogin(email: string): Promise<UserRow | null> {
  const result = await db.query<UserRow>(
    `${userQuery} WHERE u.email = $1 AND u.status = 'active' ORDER BY cm.created_at LIMIT 1`,
    [email.toLowerCase()],
  )
  return result.rows[0] ?? null
}

export async function findUserBySessionToken(token: string): Promise<AuthenticatedUser | null> {
  const result = await db.query<UserRow>(
    `${userQuery}
     JOIN user_sessions us ON us.user_id = u.id
     WHERE us.token_hash = $1
       AND us.revoked_at IS NULL
       AND us.expires_at > now()
       AND u.status = 'active'
     ORDER BY cm.created_at
     LIMIT 1`,
    [hashSessionToken(token)],
  )
  const row = result.rows[0]
  return row ? mapUser(row) : null
}

export async function createSession(userId: string, expiresAt: Date): Promise<string> {
  const token = randomBytes(SESSION_BYTES).toString('base64url')
  await db.query(
    `INSERT INTO user_sessions (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, hashSessionToken(token), expiresAt],
  )
  return token
}

export async function revokeSession(token: string): Promise<void> {
  await db.query(
    `UPDATE user_sessions SET revoked_at = now()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [hashSessionToken(token)],
  )
}

export async function createUserWithMembership(input: {
  email: string
  displayName: string
  passwordHash: string
  clubId: string
  role: Role
}): Promise<AuthenticatedUser> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const userResult = await client.query<{ id: string; email: string; display_name: string }>(
      `INSERT INTO users (email, display_name, password_hash, status)
       VALUES (lower($1), $2, $3, 'active')
       RETURNING id, email, display_name`,
      [input.email, input.displayName, input.passwordHash],
    )
    const user = userResult.rows[0]
    if (!user) throw new Error('No se pudo crear el usuario')

    await client.query(
      `INSERT INTO club_memberships (club_id, user_id, role) VALUES ($1, $2, $3)`,
      [input.clubId, user.id, input.role],
    )
    await client.query('COMMIT')
    return { id: user.id, email: user.email, displayName: user.display_name, clubId: input.clubId, role: input.role }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

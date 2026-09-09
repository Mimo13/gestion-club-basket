import { createHmac, randomBytes } from 'node:crypto'
import type { AuthenticatedUser, Role } from '@club-basket/contracts'
export type { AuthenticatedUser } from '@club-basket/contracts'
import { env } from '../../config/env.js'
import { db } from '../../database/client.js'

const SESSION_BYTES = 32
const RECOVERY_TOKEN_BYTES = 32

interface UserRow {
  id: string
  email: string
  display_name: string
  password_hash: string | null
  club_id: string
  role: Role
}

export interface ManagedUser {
  id: string
  email: string
  displayName: string
  status: 'active' | 'invited' | 'disabled'
  role: Role
  clubId: string
  createdAt: string
}

export interface UserSession {
  id: string
  createdAt: string
  expiresAt: string
  revokedAt: string | null
  current: boolean
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

function hashSecret(secret: string): string {
  return createHmac('sha256', env.SESSION_SECRET).update(secret).digest('hex')
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
     WHERE us.token_hash = $1 AND us.revoked_at IS NULL
       AND us.expires_at > now() AND u.status = 'active'
     ORDER BY cm.created_at LIMIT 1`,
    [hashSecret(token)],
  )
  const row = result.rows[0]
  return row ? mapUser(row) : null
}

export async function createSession(userId: string, expiresAt: Date): Promise<string> {
  const token = randomBytes(SESSION_BYTES).toString('base64url')
  await db.query(
    `INSERT INTO user_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, hashSecret(token), expiresAt],
  )
  return token
}

export async function revokeSession(token: string): Promise<void> {
  await db.query(
    `UPDATE user_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`,
    [hashSecret(token)],
  )
}

export async function revokeAllUserSessions(userId: string, keepToken?: string): Promise<void> {
  if (keepToken) {
    await db.query(`UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1 AND token_hash <> $2 AND revoked_at IS NULL`, [userId, hashSecret(keepToken)])
    return
  }
  await db.query(`UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [userId])
}

export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db.query(`DELETE FROM user_sessions WHERE expires_at <= now() OR revoked_at < now() - interval '30 days'`)
  return result.rowCount ?? 0
}

export async function createPasswordResetToken(email: string, tokenExpiresAt: Date): Promise<string | null> {
  const user = await db.query<{ id: string }>(`SELECT id FROM users WHERE email = $1 AND status IN ('active', 'invited')`, [email.toLowerCase()])
  const userId = user.rows[0]?.id
  if (!userId) return null

  const token = randomBytes(RECOVERY_TOKEN_BYTES).toString('base64url')
  await db.query(`DELETE FROM password_reset_tokens WHERE user_id = $1 OR expires_at <= now()`, [userId])
  await db.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, hashSecret(token), tokenExpiresAt],
  )
  return token
}

export async function consumePasswordResetToken(token: string): Promise<string | null> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query<{ user_id: string }>(
      `SELECT user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
       FOR UPDATE`,
      [hashSecret(token)],
    )
    const userId = result.rows[0]?.user_id
    if (!userId) {
      await client.query('ROLLBACK')
      return null
    }
    await client.query(`UPDATE password_reset_tokens SET used_at = now() WHERE token_hash = $1`, [hashSecret(token)])
    await client.query('COMMIT')
    return userId
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function updateUserPassword(userId: string, passwordHash: string, keepToken?: string): Promise<void> {
  await db.query(`UPDATE users SET password_hash = $2, status = 'active', updated_at = now() WHERE id = $1`, [userId, passwordHash])
  await revokeAllUserSessions(userId, keepToken)
}

export async function findManagedUsers(clubId: string): Promise<ManagedUser[]> {
  const result = await db.query<ManagedUser>(
    `SELECT u.id, u.email, u.display_name AS "displayName", u.status,
            cm.role, cm.club_id AS "clubId", u.created_at AS "createdAt"
     FROM users u JOIN club_memberships cm ON cm.user_id = u.id
     WHERE cm.club_id = $1 ORDER BY u.display_name, u.email`,
    [clubId],
  )
  return result.rows.map((row) => ({ ...row, createdAt: new Date(row.createdAt).toISOString() }))
}

export async function changeMembershipRole(clubId: string, userId: string, role: Role): Promise<void> {
  await db.query(`UPDATE club_memberships SET role = $3 WHERE club_id = $1 AND user_id = $2`, [clubId, userId, role])
}

export async function changeUserStatus(clubId: string, userId: string, status: ManagedUser['status']): Promise<void> {
  await db.query(
    `UPDATE users u SET status = $3, updated_at = now()
     WHERE u.id = $2 AND EXISTS (SELECT 1 FROM club_memberships cm WHERE cm.club_id = $1 AND cm.user_id = u.id)`,
    [clubId, userId, status],
  )
  if (status !== 'active') await revokeAllUserSessions(userId)
}

export async function createInvitedUser(input: {
  email: string
  displayName: string
  clubId: string
  role: Role
}): Promise<ManagedUser> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const userResult = await client.query<{ id: string; email: string; display_name: string; status: ManagedUser['status']; created_at: Date }>(
      `INSERT INTO users (email, display_name, status) VALUES (lower($1), $2, 'invited')
       RETURNING id, email, display_name, status, created_at`,
      [input.email, input.displayName],
    )
    const user = userResult.rows[0]
    if (!user) throw new Error('No se pudo crear el usuario invitado')
    await client.query(`INSERT INTO club_memberships (club_id, user_id, role) VALUES ($1, $2, $3)`, [input.clubId, user.id, input.role])
    await client.query('COMMIT')
    return { id: user.id, email: user.email, displayName: user.display_name, status: user.status, role: input.role, clubId: input.clubId, createdAt: user.created_at.toISOString() }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
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
       VALUES (lower($1), $2, $3, 'active') RETURNING id, email, display_name`,
      [input.email, input.displayName, input.passwordHash],
    )
    const user = userResult.rows[0]
    if (!user) throw new Error('No se pudo crear el usuario')
    await client.query(`INSERT INTO club_memberships (club_id, user_id, role) VALUES ($1, $2, $3)`, [input.clubId, user.id, input.role])
    await client.query('COMMIT')
    return { id: user.id, email: user.email, displayName: user.display_name, clubId: input.clubId, role: input.role }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

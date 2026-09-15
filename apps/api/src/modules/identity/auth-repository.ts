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
  roles: Role[] | string
  team_ids: string[] | string
}

export interface ManagedUser {
  id: string
  email: string
  displayName: string
  status: 'active' | 'invited' | 'disabled'
  role: Role
  roles: Role[]
  clubId: string
  createdAt: string
  teamIds: string[]
}

interface ManagedUserRow {
  id: string
  email: string
  displayName: string
  status: ManagedUser['status']
  role: Role
  roles: Role[] | string
  clubId: string
  createdAt: string | Date
  teamIds: string[] | string
}

function arrayValue<T extends string>(value: T[] | string | null | undefined): T[] {
  if (Array.isArray(value)) return value
  if (!value) return []
  return value.replace(/^\{(.*)\}$/, '$1').split(',').map((item) => item.replace(/^"|"$/g, '').trim()).filter(Boolean) as T[]
}

function primaryRole(roles: Role[]): Role {
  return (['club_admin', 'coordinator', 'coach', 'assistant', 'viewer'] as const).find((role) => roles.includes(role)) ?? 'viewer'
}

export function mapUser(row: UserRow): AuthenticatedUser {
  const roles = arrayValue<Role>(row.roles).length > 0 ? arrayValue<Role>(row.roles) : [row.role]
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    clubId: row.club_id,
    role: primaryRole(roles),
    roles,
    teamIds: arrayValue<string>(row.team_ids),
  }
}

function hashSecret(secret: string): string {
  return createHmac('sha256', env.SESSION_SECRET).update(secret).digest('hex')
}

const userQuery = `
  SELECT u.id, u.email, u.display_name, u.password_hash, cm.club_id, cm.role, cm.roles,
         COALESCE((SELECT array_agg(utc.team_id) FROM user_team_coaches utc WHERE utc.user_id = u.id), '{}') AS team_ids
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
  const result = await db.query<ManagedUserRow>(
    `SELECT u.id, u.email, u.display_name AS "displayName", u.status,
            cm.role, cm.roles, cm.club_id AS "clubId", u.created_at AS "createdAt",
            COALESCE(array_agg(utc.team_id) FILTER (WHERE utc.team_id IS NOT NULL), '{}') AS "teamIds"
     FROM users u JOIN club_memberships cm ON cm.user_id = u.id
     LEFT JOIN user_team_coaches utc ON utc.user_id = u.id
     WHERE cm.club_id = $1
     GROUP BY u.id, cm.club_id, cm.role, cm.roles
     ORDER BY u.display_name, u.email`,
    [clubId],
  )
  return result.rows.map((row) => ({
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    status: row.status,
    role: row.role,
    roles: arrayValue<Role>(row.roles).length > 0 ? arrayValue<Role>(row.roles) : [row.role],
    clubId: row.clubId,
    teamIds: arrayValue<string>(row.teamIds),
    createdAt: new Date(row.createdAt).toISOString(),
  }))
}

export async function changeMembershipRoles(clubId: string, userId: string, roles: Role[]): Promise<void> {
  const mainRole = primaryRole(roles)
  await db.query(`UPDATE club_memberships SET roles = $3::membership_role[], role = $4 WHERE club_id = $1 AND user_id = $2`, [clubId, userId, roles, mainRole])
}

export async function changeUserTeamIds(clubId: string, userId: string, teamIds: string[], assignedBy: string): Promise<void> {
  const validTeams = await db.query<{ id: string }>(`SELECT id FROM teams WHERE club_id = $1 AND id = ANY($2::uuid[])`, [clubId, teamIds])
  const validTeamIds = validTeams.rows.map((row) => row.id)
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query(`DELETE FROM user_team_coaches WHERE user_id = $1 AND team_id IN (SELECT id FROM teams WHERE club_id = $2)`, [userId, clubId])
    if (validTeamIds.length > 0) {
      await client.query(`INSERT INTO user_team_coaches (user_id, team_id, assigned_by) SELECT $1, id, $3 FROM teams WHERE club_id = $2 AND id = ANY($4::uuid[]) ON CONFLICT DO NOTHING`, [userId, clubId, assignedBy, validTeamIds])
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
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
  roles: Role[]
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
    await client.query(`INSERT INTO club_memberships (club_id, user_id, role, roles) VALUES ($1, $2, $3, $4::membership_role[])`, [input.clubId, user.id, primaryRole(input.roles), input.roles])
    await client.query('COMMIT')
    return { id: user.id, email: user.email, displayName: user.display_name, status: user.status, role: primaryRole(input.roles), roles: input.roles, clubId: input.clubId, teamIds: [], createdAt: user.created_at.toISOString() }
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
  roles: Role[]
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
    await client.query(`INSERT INTO club_memberships (club_id, user_id, role, roles) VALUES ($1, $2, $3, $4::membership_role[])`, [input.clubId, user.id, primaryRole(input.roles), input.roles])
    await client.query('COMMIT')
    return { id: user.id, email: user.email, displayName: user.display_name, clubId: input.clubId, role: primaryRole(input.roles), roles: input.roles, teamIds: [] }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

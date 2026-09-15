import type { FastifyReply, FastifyRequest } from 'fastify'
import type { Role } from '@club-basket/contracts'
import { findUserBySessionToken } from './auth-repository.js'
import type { AuthenticatedUser } from './auth-repository.js'

export const SESSION_COOKIE = 'club_basket_session'

function getSessionToken(request: FastifyRequest): string | undefined {
  return request.cookies[SESSION_COOKIE] ?? request.headers.authorization?.replace(/^Bearer\s+/i, '')
}

export async function getAuthenticatedUser(request: FastifyRequest): Promise<AuthenticatedUser | null> {
  const token = getSessionToken(request)
  return token ? findUserBySessionToken(token) : null
}

export async function requireAuthenticatedUser(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<AuthenticatedUser | undefined> {
  const user = await getAuthenticatedUser(request)
  if (!user) {
    await reply.code(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Es necesario iniciar sesión' } })
    return undefined
  }
  return user
}

export function hasRole(user: AuthenticatedUser, role: Role): boolean {
  return user.roles.includes(role)
}

export function canViewAllTeams(user: AuthenticatedUser): boolean {
  return hasRole(user, 'club_admin') || hasRole(user, 'coordinator')
}

export function canAccessTeam(user: AuthenticatedUser, teamId: string): boolean {
  if (canViewAllTeams(user)) return true
  const hasScopedTeamRole = hasRole(user, 'coach') || hasRole(user, 'assistant')
  return hasScopedTeamRole && user.teamIds.includes(teamId)
}

export async function requireRole(
  request: FastifyRequest,
  reply: FastifyReply,
  roles: readonly Role[],
): Promise<AuthenticatedUser | undefined> {
  const user = await requireAuthenticatedUser(request, reply)
  if (!user) return undefined
  if (!roles.some((role) => user.roles.includes(role))) {
    await reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'No tienes permiso para esta operación' } })
    return undefined
  }
  return user
}

export function getRequestSessionToken(request: FastifyRequest): string | undefined {
  return getSessionToken(request)
}

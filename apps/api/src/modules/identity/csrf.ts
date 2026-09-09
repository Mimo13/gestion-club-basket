import { randomBytes } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { SESSION_COOKIE } from './auth-context.js'

export const CSRF_COOKIE = 'club_basket_csrf'
export const CSRF_HEADER = 'x-csrf-token'

export function setCsrfCookie(reply: FastifyReply): void {
  reply.setCookie(CSRF_COOKIE, randomBytes(24).toString('base64url'), {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
}

export function requiresCsrf(request: FastifyRequest): boolean {
  return Boolean(request.cookies[SESSION_COOKIE]) && !request.headers.authorization
}

export function hasValidCsrf(request: FastifyRequest): boolean {
  const cookie = request.cookies[CSRF_COOKIE]
  const header = request.headers[CSRF_HEADER]
  return Boolean(cookie && header && cookie === header)
}

export async function requireCsrf(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  if (!requiresCsrf(request) || hasValidCsrf(request)) return true
  await reply.code(403).send({ error: { code: 'CSRF_REQUIRED', message: 'La petición no supera la validación CSRF' } })
  return false
}

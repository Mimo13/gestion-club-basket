import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, closeDatabase } from '../../database/client.js'
import { buildApp } from '../../app.js'
import { createPasswordResetToken } from './auth-repository.js'
import { hashPassword } from './password.js'

const adminEmail = 'security-admin@example.test'
const adminPassword = 'security-admin-password-123'
const invitedEmail = 'security-invited@example.test'

beforeAll(async () => {
  await db.query(
    `INSERT INTO users (email, display_name, password_hash, status)
     VALUES ($1, $2, $3, 'active')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'active'`,
    [adminEmail, 'Security Admin', await hashPassword(adminPassword)],
  )
  await db.query(
    `INSERT INTO club_memberships (club_id, user_id, role)
     SELECT $1, id, 'club_admin' FROM users WHERE email = $2
     ON CONFLICT (club_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    ['00000000-0000-0000-0000-000000000001', adminEmail],
  )
})

afterAll(async () => {
  await db.query('DELETE FROM users WHERE email IN ($1, $2)', [adminEmail, invitedEmail])
  await closeDatabase()
})

describe('identity security', () => {
  it('requires CSRF on cookie-authenticated mutations', async () => {
    const app = buildApp()
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: adminEmail, password: adminPassword } })
    const cookies = (Array.isArray(login.headers['set-cookie']) ? login.headers['set-cookie'] : [login.headers['set-cookie']]).filter((value): value is string => Boolean(value))
    const cookie = cookies.map((value) => value.split(';')[0]).join('; ')
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/logout', headers: { cookie } })
    expect(response.statusCode).toBe(403)
    await app.close()
  })

  it('invites users and resets a password with a one-use token', async () => {
    const app = buildApp()
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email: adminEmail, password: adminPassword } })
    const cookies = (Array.isArray(login.headers['set-cookie']) ? login.headers['set-cookie'] : [login.headers['set-cookie']]).filter((value): value is string => Boolean(value))
    const cookie = cookies.map((value) => value.split(';')[0]).join('; ')
    const csrf = cookie.match(/(?:^|; )club_basket_csrf=([^;]+)/)?.[1]

    const invited = await app.inject({
      method: 'POST', url: '/api/v1/admin/users', headers: { cookie, 'x-csrf-token': csrf },
      payload: { email: invitedEmail, displayName: 'Invited User', role: 'coach' },
    })
    expect(invited.statusCode).toBe(201)

    const token = await createPasswordResetToken(invitedEmail, new Date(Date.now() + 60_000))
    expect(token).toBeTruthy()
    const reset = await app.inject({ method: 'POST', url: '/api/v1/auth/reset-password', payload: { token, password: 'new-invited-password-123' } })
    expect(reset.statusCode).toBe(204)
    const reused = await app.inject({ method: 'POST', url: '/api/v1/auth/reset-password', payload: { token, password: 'another-password-123' } })
    expect(reused.statusCode).toBe(400)
    await app.close()
  })
})

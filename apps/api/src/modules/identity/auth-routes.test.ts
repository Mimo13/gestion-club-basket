import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { db, closeDatabase } from '../../database/client.js'
import { buildApp } from '../../app.js'
import { hashPassword } from './password.js'

const testEmail = 'identity-test@example.test'
const testPassword = 'identity-test-password-123'

beforeAll(async () => {
  const passwordHash = await hashPassword(testPassword)
  await db.query(
    `INSERT INTO users (email, display_name, password_hash, status)
     VALUES ($1, $2, $3, 'active')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'active'`,
    [testEmail, 'Identity Test', passwordHash],
  )
  await db.query(
    `INSERT INTO club_memberships (club_id, user_id, role)
     SELECT $1, id, 'club_admin' FROM users WHERE email = $2
     ON CONFLICT (club_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    ['00000000-0000-0000-0000-000000000001', testEmail],
  )
})

afterAll(async () => {
  await db.query('DELETE FROM users WHERE email = $1', [testEmail])
  await closeDatabase()
})

describe('identity routes', () => {
  it('rejects invalid credentials', async () => {
    const app = buildApp()
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: testEmail, password: 'wrong-password' },
    })
    expect(response.statusCode).toBe(401)
    await app.close()
  })

  it('returns managed users with normalized profile and team arrays', async () => {
    const app = buildApp()
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: testEmail, password: testPassword },
    })
    const setCookie = login.headers['set-cookie']
    const cookies = (Array.isArray(setCookie) ? setCookie : [setCookie]).filter((value): value is string => Boolean(value))
    const cookie = cookies.map((value) => value.split(';')[0]).join('; ')

    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/users', headers: { cookie } })
    expect(response.statusCode).toBe(200)
    expect(response.json().items[0].roles).toEqual(['club_admin'])
    expect(response.json().items[0].teamIds).toEqual([])
    await app.close()
  })

  it('logs in, reads the session, protects teams and logs out', async () => {
    const app = buildApp()
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: testEmail, password: testPassword },
    })

    expect(login.statusCode).toBe(200)
    const cookie = login.headers['set-cookie']
    expect(cookie).toBeTruthy()
    const cookieValues = Array.isArray(cookie) ? cookie : [cookie]
    const cookieHeader = cookieValues.filter((value): value is string => Boolean(value)).map((value) => value.split(';')[0]).join('; ')
    const csrfCookie = cookieHeader.match(/(?:^|; )club_basket_csrf=([^;]+)/)?.[1]

    const session = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/session',
      headers: { cookie: cookieHeader },
    })
    expect(session.statusCode).toBe(200)
    expect(session.json().user.email).toBe(testEmail)

    const teamsWithoutAuth = await app.inject({ method: 'GET', url: '/api/v1/teams' })
    expect(teamsWithoutAuth.statusCode).toBe(401)

    const logout = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { cookie: cookieHeader, 'x-csrf-token': csrfCookie },
    })
    expect(logout.statusCode).toBe(204)

    const sessionAfterLogout = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/session',
      headers: { cookie: cookieHeader },
    })
    expect(sessionAfterLogout.statusCode).toBe(401)
    await app.close()
  })
})

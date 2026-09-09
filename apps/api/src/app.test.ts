import { beforeAll, describe, expect, it } from 'vitest'

let buildApp: typeof import('./app.js').buildApp

beforeAll(async () => {
  process.env.DATABASE_URL ??= 'postgresql://club_basket_app:local-dev-change-me@127.0.0.1:5432/club_basket'
  process.env.SESSION_SECRET ??= 'test-only-session-secret'
  ;({ buildApp } = await import('./app.js'))
})

describe('API', () => {
  it('returns health status', async () => {
    const app = buildApp()
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ status: 'ok', service: 'api' })
    await app.close()
  })
})

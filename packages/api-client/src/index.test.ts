import { describe, expect, it, vi } from 'vitest'
import { createApiClient } from './index.js'

describe('api client', () => {
  it('validates health responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok', service: 'api', timestamp: '2026-01-01T00:00:00.000Z' }), { status: 200 }),
    ))

    await expect(createApiClient('http://localhost:3000').health()).resolves.toMatchObject({ status: 'ok' })
    vi.unstubAllGlobals()
  })
})

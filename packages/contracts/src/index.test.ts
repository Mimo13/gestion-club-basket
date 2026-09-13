import { describe, expect, it } from 'vitest'
import { createActivityInputSchema, createPlayerInputSchema, createTeamInputSchema, listActivitiesQuerySchema, listTeamsQuerySchema } from './index.js'

describe('contracts', () => {
  it('applies defaults to team creation', () => {
    const result = createTeamInputSchema.safeParse({
      name: '  Senior A ',
      categoryId: '00000000-0000-0000-0000-000000000001',
      seasonId: '00000000-0000-0000-0000-000000000001',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Senior A')
      expect(result.data.gender).toBe('unspecified')
    }
  })

  it('coerces and bounds pagination query values', () => {
    const result = listTeamsQuerySchema.parse({ limit: '20', offset: '10' })
    expect(result).toMatchObject({ limit: 20, offset: 10 })
  })

  it('validates activity variants and requires match details', () => {
    const training = createActivityInputSchema.safeParse({ type: 'training', teamId: '00000000-0000-0000-0000-000000000001', startsAt: '2026-09-01T18:00:00.000Z' })
    const match = createActivityInputSchema.safeParse({ type: 'match', teamId: '00000000-0000-0000-0000-000000000001', startsAt: '2026-09-01T18:00:00.000Z', opponentName: 'Rival', isHome: true })
    const invalidMatch = createActivityInputSchema.safeParse({ type: 'match', teamId: '00000000-0000-0000-0000-000000000001', startsAt: '2026-09-01T18:00:00.000Z', isHome: true })
    expect(training.success).toBe(true)
    expect(match.success).toBe(true)
    expect(invalidMatch.success).toBe(false)
  })

  it('validates player creation fields', () => {
    expect(createPlayerInputSchema.safeParse({ firstName: 'Ana', lastName: 'Pérez', birthDate: '2012-04-03' }).success).toBe(true)
    expect(createPlayerInputSchema.safeParse({ firstName: '', lastName: 'Pérez', birthDate: '2012-04-03' }).success).toBe(false)
  })

  it('validates an activity date interval and applies pagination defaults', () => {
    const result = listActivitiesQuerySchema.parse({ fromDate: '2026-09-01', toDate: '2026-09-30' })
    expect(result).toMatchObject({ fromDate: '2026-09-01', toDate: '2026-09-30', limit: 50, offset: 0 })
    expect(() => listActivitiesQuerySchema.parse({ fromDate: '2026-09-30', toDate: '2026-09-01' })).toThrow()
  })
})

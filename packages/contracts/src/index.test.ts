import { describe, expect, it } from 'vitest'
import { createTeamInputSchema, listTeamsQuerySchema } from './index.js'

describe('contracts', () => {
  it('applies defaults to team creation', () => {
    const result = createTeamInputSchema.safeParse({
      name: '  Senior A ',
      category: 'Senior',
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
})

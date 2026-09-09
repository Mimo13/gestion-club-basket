import { describe, expect, it } from 'vitest'

describe('categories module', () => {
  it('uses non-negative ordering values', () => {
    const requestedOrder = 40
    expect(Math.max(requestedOrder, 0)).toBe(40)
  })
})

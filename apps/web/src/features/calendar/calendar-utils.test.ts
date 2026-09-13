import { describe, expect, it } from 'vitest'
import { getCalendarRange, groupActivitiesByDate } from './calendar-utils.js'
import type { Activity } from '@club-basket/contracts'

const activity = (id: string, startsAt: string): Activity => ({
  id,
  teamId: '00000000-0000-0000-0000-000000000001',
  teamName: 'Cadete',
  type: 'training',
  startsAt,
  endsAt: null,
  status: 'scheduled',
  venueName: null,
  notes: null,
  opponentName: null,
  isHome: null,
  competition: null,
  matchStatus: null,
})

describe('calendar utils', () => {
  it('calculates day, Monday-Sunday week and month ranges', () => {
    expect(getCalendarRange('day', '2026-09-16')).toEqual({ fromDate: '2026-09-16', toDate: '2026-09-16' })
    expect(getCalendarRange('week', '2026-09-16')).toEqual({ fromDate: '2026-09-14', toDate: '2026-09-20' })
    expect(getCalendarRange('month', '2026-09-16')).toEqual({ fromDate: '2026-09-01', toDate: '2026-09-30' })
  })

  it('groups activities by local calendar date and sorts each group', () => {
    const groups = groupActivitiesByDate([
      activity('later', '2026-09-17T18:00:00.000Z'),
      activity('earlier', '2026-09-17T16:00:00.000Z'),
      activity('next-day', '2026-09-18T10:00:00.000Z'),
    ])
    expect(groups.map((group) => group.date)).toEqual(['2026-09-17', '2026-09-18'])
    expect(groups[0]?.activities.map((item) => item.id)).toEqual(['earlier', 'later'])
  })
})

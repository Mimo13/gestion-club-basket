import { describe, expect, it } from 'vitest'
import { attendanceCountsAsPresent, canManageActivity, canManageTeam, canRegisterAttendance } from './index.js'

describe('domain permissions', () => {
  it('limits team management to administrative roles', () => {
    expect(canManageTeam('club_admin')).toBe(true)
    expect(canManageTeam('coordinator')).toBe(true)
    expect(canManageTeam('coach')).toBe(false)
    expect(canManageTeam('viewer')).toBe(false)
  })

  it('allows coaches to manage activities but not assistants or viewers', () => {
    expect(canManageActivity('club_admin')).toBe(true)
    expect(canManageActivity('coach')).toBe(true)
    expect(canManageActivity('assistant')).toBe(false)
    expect(canManageActivity('viewer')).toBe(false)
  })

  it('allows coaching staff to register attendance', () => {
    expect(canRegisterAttendance('coach')).toBe(true)
    expect(canRegisterAttendance('assistant')).toBe(true)
    expect(canRegisterAttendance('viewer')).toBe(false)
  })

  it('counts present and late attendance as present', () => {
    expect(attendanceCountsAsPresent('present')).toBe(true)
    expect(attendanceCountsAsPresent('late')).toBe(true)
    expect(attendanceCountsAsPresent('absent')).toBe(false)
    expect(attendanceCountsAsPresent('excused')).toBe(false)
  })
})

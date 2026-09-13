import type { Role } from '@club-basket/contracts'

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

export function canManageTeam(role: Role): boolean {
  return role === 'club_admin' || role === 'coordinator'
}

export function canRegisterAttendance(role: Role): boolean {
  return canManageTeam(role) || role === 'coach' || role === 'assistant'
}

export function canManageActivity(role: Role): boolean {
  return canManageTeam(role) || role === 'coach'
}

export function attendanceCountsAsPresent(status: AttendanceStatus): boolean {
  return status === 'present' || status === 'late'
}

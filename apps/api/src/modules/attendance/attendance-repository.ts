import type { Absence, AttendanceCalendar, AttendanceSummary, CreatePlayerInput, CurrentSeason, MarkAbsenceResponse, MatchRoster, Player, PlayerDetail, Team, TrainingSession } from '@club-basket/contracts'
import { db } from '../../database/client.js'

interface PlayerRow {
  id: string
  person_id: string
  team_id: string
  jersey_number: number | null
  first_name: string
  last_name: string
  birth_date: string | Date
  status: Player['status']
}

interface TeamRow {
  id: string
  club_id: string
  season_id: string
  name: string
  category: string
  category_id: string | null
  gender: Team['gender']
  status: Team['status']
  created_at: Date
  updated_at: Date
}

function dateValue(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)
}

export async function currentClubDate(clubId: string): Promise<string> {
  const result = await db.query<{ timezone: string }>('SELECT timezone FROM clubs WHERE id = $1', [clubId])
  const timezone = result.rows[0]?.timezone ?? 'Europe/Madrid'
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const values = new Map(parts.map((part) => [part.type, part.value]))
  return `${values.get('year') ?? '1970'}-${values.get('month') ?? '01'}-${values.get('day') ?? '01'}`
}

export async function currentClubDateTime(clubId: string): Promise<{ date: string; time: string; weekday: number }> {
  const result = await db.query<{ timezone: string }>('SELECT timezone FROM clubs WHERE id = $1', [clubId])
  const timezone = result.rows[0]?.timezone ?? 'Europe/Madrid'
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date())
  const values = new Map(parts.map((part) => [part.type, part.value]))
  const date = `${values.get('year') ?? '1970'}-${values.get('month') ?? '01'}-${values.get('day') ?? '01'}`
  return { date, time: `${values.get('hour') ?? '00'}:${values.get('minute') ?? '00'}`, weekday: mondayWeekday(date) }
}

function mapPlayer(row: PlayerRow): Player {
  const birthDate = dateValue(row.birth_date)
  const birthYear = Number(birthDate.slice(0, 4))
  return { id: row.id, personId: row.person_id, teamId: row.team_id, jerseyNumber: row.jersey_number, firstName: row.first_name, lastName: row.last_name, fullName: `${row.first_name} ${row.last_name}`, birthDate, birthYear, birthYearOrder: birthYear, status: row.status }
}

export async function todayAttendance(clubId: string, teamId: string): Promise<import('@club-basket/contracts').TodayAttendance> {
  const current = await currentClubDateTime(clubId)
  const scheduleResult = await db.query<{ weekday: number; starts_at: string; ends_at: string; venue_name: string | null }>(
    `SELECT weekday, to_char(starts_at, 'HH24:MI') AS starts_at, to_char(ends_at, 'HH24:MI') AS ends_at, venue_name
     FROM team_training_schedules WHERE team_id = $1 AND weekday = $2 ORDER BY starts_at LIMIT 1`, [teamId, current.weekday],
  )
  const schedule = scheduleResult.rows[0]
  const players = (await listTeamPlayers(clubId, teamId)).sort((first, second) => (first.jerseyNumber ?? 100) - (second.jerseyNumber ?? 100) || first.fullName.localeCompare(second.fullName))
  const playerIds = players.map((player) => player.id)
  const absentIds = playerIds.length === 0 ? new Set<string>() : new Set((await db.query<{ player_id: string }>(
    `SELECT ta.player_id FROM training_absences ta JOIN training_sessions ts ON ts.id = ta.training_session_id
     WHERE ts.team_id = $1 AND ts.training_date = $2::date AND ta.player_id = ANY($3::uuid[])`, [teamId, current.date, playerIds],
  )).rows.map((row) => row.player_id))
  const totals = playerIds.length === 0 ? [] : (await db.query<{ player_id: string; total: string }>(
    `SELECT ta.player_id, count(*)::text AS total FROM training_absences ta JOIN training_sessions ts ON ts.id = ta.training_session_id
     WHERE ts.team_id = $1 AND ta.player_id = ANY($2::uuid[]) GROUP BY ta.player_id`, [teamId, playerIds],
  )).rows
  const totalByPlayer = new Map(totals.map((row) => [row.player_id, Number(row.total)]))
  return {
    teamId,
    trainingDate: current.date,
    currentTime: current.time,
    isTrainingDay: Boolean(schedule),
    isCurrentTraining: Boolean(schedule && current.time >= schedule.starts_at && current.time <= schedule.ends_at),
    schedule: schedule ? { weekday: schedule.weekday, startsAt: schedule.starts_at, endsAt: schedule.ends_at, venueName: schedule.venue_name } : null,
    players: players.map((player) => ({ ...player, absentToday: absentIds.has(player.id), totalAbsences: totalByPlayer.get(player.id) ?? 0 })),
  }
}

function mapTeam(row: TeamRow): Team {
  return { id: row.id, clubId: row.club_id, seasonId: row.season_id, categoryId: row.category_id, name: row.name, category: row.category, gender: row.gender, status: row.status, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() }
}

export async function listSeasons(clubId: string): Promise<CurrentSeason[]> {
  const result = await db.query<{ id: string; name: string; starts_on: string | Date; ends_on: string | Date }>('SELECT id, name, starts_on, ends_on FROM seasons WHERE club_id = $1 ORDER BY starts_on DESC', [clubId])
  return result.rows.map((row) => ({ id: row.id, name: row.name, startsOn: dateValue(row.starts_on), endsOn: dateValue(row.ends_on) }))
}

export async function findCurrentSeason(clubId: string): Promise<CurrentSeason | null> {
  const result = await db.query<{ id: string; name: string; starts_on: string; ends_on: string }>('SELECT id, name, starts_on, ends_on FROM seasons WHERE club_id = $1 ORDER BY is_current DESC, starts_on DESC LIMIT 1', [clubId])
  const row = result.rows[0]
  return row ? { id: row.id, name: row.name, startsOn: dateValue(row.starts_on), endsOn: dateValue(row.ends_on) } : null
}

export async function createPlayer(clubId: string, teamId: string, input: CreatePlayerInput): Promise<Player> {
  const result = await db.query<PlayerRow>(
    `WITH new_person AS (
       INSERT INTO people (club_id, first_name, last_name, birth_date)
       SELECT t.club_id, $3, $4, $5::date FROM teams t WHERE t.id = $2 AND t.club_id = $1
       RETURNING id
     ), new_player AS (
       INSERT INTO players (person_id, current_team_id, jersey_number)
       SELECT id, $2, $6 FROM new_person
       RETURNING id, person_id, current_team_id AS team_id, jersey_number
     )
     SELECT p.id, p.person_id, p.team_id, p.jersey_number, pe.first_name, pe.last_name, pe.birth_date, pe.status
     FROM new_player p JOIN people pe ON pe.id = p.person_id`,
    [clubId, teamId, input.firstName, input.lastName, input.birthDate, input.jerseyNumber ?? null],
  )
  const row = result.rows[0]
  if (!row) throw new Error('El equipo no existe en el club')
  return mapPlayer(row)
}

export async function updatePlayerStatus(clubId: string, teamId: string, playerId: string, status: Player['status']): Promise<Player | null> {
  const result = await db.query<PlayerRow>(
    `UPDATE people pe SET status = $4, updated_at = now()
     FROM players p JOIN teams t ON t.id = p.current_team_id
     WHERE pe.id = p.person_id AND p.id = $3 AND t.id = $2 AND t.club_id = $1
     RETURNING p.id, p.person_id, p.current_team_id AS team_id, p.jersey_number, pe.first_name, pe.last_name, pe.birth_date, pe.status`,
    [clubId, teamId, playerId, status],
  )
  return result.rows[0] ? mapPlayer(result.rows[0]) : null
}

export async function listTeamPlayers(clubId: string, teamId: string, includeInactive = false): Promise<Player[]> {
  const result = await db.query<PlayerRow>(
    `SELECT p.id, p.person_id, p.current_team_id AS team_id, p.jersey_number, pe.first_name, pe.last_name, pe.birth_date, pe.status
     FROM players p JOIN people pe ON pe.id = p.person_id JOIN teams t ON t.id = p.current_team_id
     WHERE t.id = $1 AND t.club_id = $2 ${includeInactive ? '' : "AND pe.status = 'active'"}
     ORDER BY EXTRACT(YEAR FROM pe.birth_date), p.jersey_number NULLS LAST, pe.last_name, pe.first_name`, [teamId, clubId],
  )
  return result.rows.map(mapPlayer)
}

export async function playerDetail(clubId: string, playerId: string): Promise<PlayerDetail | null> {
  const playerResult = await db.query<PlayerRow>(
    `SELECT p.id, p.person_id, p.current_team_id AS team_id, p.jersey_number, pe.first_name, pe.last_name, pe.birth_date, pe.status
     FROM players p JOIN people pe ON pe.id = p.person_id WHERE p.id = $1 AND pe.club_id = $2`, [playerId, clubId],
  )
  const row = playerResult.rows[0]
  if (!row) return null
  const teamResult = await db.query<TeamRow>('SELECT id, club_id, season_id, name, category, category_id, gender, status, created_at, updated_at FROM teams WHERE id = $1 AND club_id = $2', [row.team_id, clubId])
  const absenceResult = await db.query<{ player_id: string; training_date: string | Date; recorded_at: string | Date }>('SELECT ta.player_id, ts.training_date, ta.recorded_at FROM training_absences ta JOIN training_sessions ts ON ts.id = ta.training_session_id WHERE ta.player_id = $1 ORDER BY ts.training_date DESC', [playerId])
  return { player: mapPlayer(row), team: teamResult.rows[0] ? mapTeam(teamResult.rows[0]) : null, absences: absenceResult.rows.map((absence) => ({ playerId: absence.player_id, trainingDate: dateValue(absence.training_date), recordedAt: new Date(absence.recorded_at).toISOString() })) }
}

export async function listAbsencesForDate(clubId: string, teamId: string, trainingDate: string): Promise<{ trainingDate: string; absentPlayerIds: string[] }> {
  const result = await db.query<{ player_id: string }>(
    `SELECT ta.player_id FROM training_absences ta JOIN training_sessions ts ON ts.id = ta.training_session_id JOIN teams t ON t.id = ts.team_id
     WHERE t.id = $1 AND t.club_id = $2 AND ts.training_date = $3::date ORDER BY ta.player_id`, [teamId, clubId, trainingDate],
  )
  return { trainingDate, absentPlayerIds: result.rows.map((row) => row.player_id) }
}

function mondayWeekday(value: string): number {
  const sundayBasedWeekday = new Date(`${value}T12:00:00`).getUTCDay()
  return sundayBasedWeekday === 0 ? 6 : sundayBasedWeekday - 1
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function nextTrainingDate(today: string, weekdays: Set<number>): string | null {
  for (let offset = 0; offset <= 6; offset += 1) {
    const date = shiftDate(today, offset)
    if (weekdays.has(mondayWeekday(date))) return date
  }
  return null
}

function centeredTrainingDates(center: string, weekdays: Set<number>): string[] {
  const previous: string[] = []
  const following: string[] = []
  let cursor = shiftDate(center, -1)
  while (previous.length < 6) {
    if (weekdays.has(mondayWeekday(cursor))) previous.push(cursor)
    cursor = shiftDate(cursor, -1)
  }
  cursor = shiftDate(center, 1)
  while (following.length < 6) {
    if (weekdays.has(mondayWeekday(cursor))) following.push(cursor)
    cursor = shiftDate(cursor, 1)
  }
  return [...previous.reverse(), center, ...following]
}

export async function attendanceCalendar(clubId: string, fromDate: string, toDate: string, allowedTeamIds?: string[], centered = false): Promise<AttendanceCalendar> {
  const teamFilter = allowedTeamIds ? ' AND t.id = ANY($2::uuid[])' : ''
  const teamValues: Array<string | string[]> = allowedTeamIds ? [clubId, allowedTeamIds] : [clubId]
  const teams = await db.query<{ team_id: string; team_name: string; player_id: string; full_name: string }>(
    `SELECT t.id AS team_id, t.name AS team_name, p.id AS player_id, concat(pe.first_name, ' ', pe.last_name) AS full_name
     FROM teams t JOIN players p ON p.current_team_id = t.id JOIN people pe ON pe.id = p.person_id
     WHERE t.club_id = $1 AND pe.status = 'active'${teamFilter}
     ORDER BY t.name, EXTRACT(YEAR FROM pe.birth_date), p.jersey_number NULLS LAST, pe.last_name, pe.first_name`, teamValues,
  )

  const teamIds = [...new Set(teams.rows.map((row) => row.team_id))]
  const schedules = teamIds.length === 0
    ? { rows: [] as Array<{ team_id: string; weekday: number }> }
    : await db.query<{ team_id: string; weekday: number }>(
      'SELECT team_id, weekday FROM team_training_schedules WHERE team_id = ANY($1::uuid[]) ORDER BY team_id, weekday',
      [teamIds],
    )
  const trainingWeekdays = new Map<string, Set<number>>()
  for (const schedule of schedules.rows) {
    const weekdays = trainingWeekdays.get(schedule.team_id) ?? new Set<number>()
    weekdays.add(schedule.weekday)
    trainingWeekdays.set(schedule.team_id, weekdays)
  }

  const teamDates = new Map<string, string[]>()
  const centerDate = centered ? await currentClubDate(clubId) : null
  for (const teamId of teamIds) {
    const weekdays = trainingWeekdays.get(teamId) ?? new Set<number>()
    if (!centered || !centerDate) continue
    const center = nextTrainingDate(centerDate, weekdays)
    if (center) teamDates.set(teamId, centeredTrainingDates(center, weekdays))
  }

  const calendarDates = centered ? [...teamDates.values()].flat() : [fromDate, toDate]
  const sortedCalendarDates = [...calendarDates].sort()
  const calendarFromDate = centered && sortedCalendarDates.length > 0 ? sortedCalendarDates[0]! : fromDate
  const calendarToDate = centered && sortedCalendarDates.length > 0 ? sortedCalendarDates[sortedCalendarDates.length - 1]! : toDate
  const absenceFilter = allowedTeamIds ? ' AND t.id = ANY($4::uuid[])' : ''
  const absenceValues: Array<string | string[]> = allowedTeamIds ? [clubId, calendarFromDate, calendarToDate, allowedTeamIds] : [clubId, calendarFromDate, calendarToDate]
  const absences = await db.query<{ player_id: string; training_date: string | Date }>(
    `SELECT ta.player_id, ts.training_date FROM training_absences ta JOIN training_sessions ts ON ts.id = ta.training_session_id JOIN teams t ON t.id = ts.team_id
     WHERE t.club_id = $1 AND ts.training_date >= $2::date AND ts.training_date <= $3::date${absenceFilter}`, absenceValues,
  )

  const counts = new Map<string, number>()
  for (const absence of absences.rows) {
    const key = `${absence.player_id}:${dateValue(absence.training_date)}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const teamMap = new Map<string, AttendanceCalendar['teams'][number]>()
  for (const row of teams.rows) {
    const team = teamMap.get(row.team_id) ?? { teamId: row.team_id, teamName: row.team_name, players: [] }
    const dates = centered ? (teamDates.get(row.team_id) ?? []) : []
    const cells: AttendanceCalendar['teams'][number]['players'][number]['cells'] = []
    if (centered) {
      for (const date of dates) cells.push({ date, count: counts.get(`${row.player_id}:${date}`) ?? 0 })
    } else {
      const cursor = new Date(`${fromDate}T12:00:00`)
      const end = new Date(`${toDate}T12:00:00`)
      const weekdays = trainingWeekdays.get(row.team_id) ?? new Set<number>()
      while (cursor <= end) {
        const date = cursor.toISOString().slice(0, 10)
        if (weekdays.has(mondayWeekday(date))) cells.push({ date, count: counts.get(`${row.player_id}:${date}`) ?? 0 })
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      }
    }
    const visibleCells = centered ? cells : cells.slice(-10)
    team.players.push({ playerId: row.player_id, fullName: row.full_name, cells: visibleCells, totalAbsences: visibleCells.reduce((total, cell) => total + cell.count, 0) })
    teamMap.set(row.team_id, team)
  }
  return { fromDate: calendarFromDate, toDate: calendarToDate, teams: [...teamMap.values()] }
}

async function findTeamDate(clubId: string, teamId: string, trainingDate: string, createdBy: string): Promise<TrainingSession> {
  const result = await db.query<{ id: string; team_id: string; training_date: string | Date }>(
    `INSERT INTO training_sessions (team_id, training_date, created_by) SELECT t.id, $3::date, $4 FROM teams t WHERE t.id = $2 AND t.club_id = $1
     ON CONFLICT (team_id, training_date) DO UPDATE SET created_by = EXCLUDED.created_by RETURNING id, team_id, training_date`, [clubId, teamId, trainingDate, createdBy],
  )
  const row = result.rows[0]
  if (!row) throw new Error('El equipo no existe en el club')
  return { id: row.id, teamId: row.team_id, trainingDate: dateValue(row.training_date) }
}

export async function markAbsence(input: { clubId: string; teamId: string; playerId: string; trainingDate: string; recordedBy: string }): Promise<MarkAbsenceResponse> {
  const session = await findTeamDate(input.clubId, input.teamId, input.trainingDate, input.recordedBy)
  const validPlayer = await db.query<{ id: string }>('SELECT p.id FROM players p JOIN teams t ON t.id = p.current_team_id WHERE p.id = $1 AND t.id = $2 AND t.club_id = $3', [input.playerId, input.teamId, input.clubId])
  if (!validPlayer.rows[0]) throw new Error('El jugador no pertenece al equipo')
  const result = await db.query<{ player_id: string; training_date: string | Date; recorded_at: string | Date }>(
    `INSERT INTO training_absences (training_session_id, player_id, recorded_by) VALUES ($1, $2, $3)
     ON CONFLICT (training_session_id, player_id) DO UPDATE SET recorded_by = EXCLUDED.recorded_by, recorded_at = now()
     RETURNING player_id, $4::date AS training_date, recorded_at`, [session.id, input.playerId, input.recordedBy, input.trainingDate],
  )
  const row = result.rows[0]
  if (!row) throw new Error('No se pudo registrar la ausencia')
  const countResult = await db.query<{ count: string }>('SELECT count(*)::text AS count FROM training_absences WHERE player_id = $1', [input.playerId])
  return { session, absence: { playerId: row.player_id, trainingDate: dateValue(row.training_date), recordedAt: new Date(row.recorded_at).toISOString() }, totalAbsencesInInterval: Number(countResult.rows[0]?.count ?? 0) }
}

export async function removeAbsence(input: { clubId: string; teamId: string; playerId: string; trainingDate: string }): Promise<void> {
  await db.query('DELETE FROM training_absences ta USING training_sessions ts, teams t, players p WHERE ta.training_session_id = ts.id AND ts.team_id = t.id AND p.id = ta.player_id AND t.id = $1 AND t.club_id = $2 AND p.id = $3 AND ts.training_date = $4::date', [input.teamId, input.clubId, input.playerId, input.trainingDate])
}

async function intervalMatches(teamId: string, fromMatchId?: string, toMatchId?: string, referenceDate?: string): Promise<{ fromMatchId: string | null; toMatchId: string | null; fromDate: string | null; toDate: string | null }> {
  if (fromMatchId && toMatchId) {
    const selected = await db.query<{ id: string; training_date: string | Date }>('SELECT m.id, a.starts_at::date AS training_date FROM matches m JOIN activities a ON a.id = m.activity_id WHERE m.id = ANY($1::uuid[]) AND a.team_id = $2 ORDER BY a.starts_at', [[fromMatchId, toMatchId], teamId])
    if (selected.rows[0] && selected.rows[1]) return { fromMatchId: selected.rows[0].id, toMatchId: selected.rows[1].id, fromDate: dateValue(selected.rows[0].training_date), toDate: dateValue(selected.rows[1].training_date) }
  }
  const today = referenceDate ?? new Date().toISOString().slice(0, 10)
  const [previousResult, nextResult] = await Promise.all([
    db.query<{ id: string; training_date: string | Date }>(
      `SELECT m.id, a.starts_at::date AS training_date
       FROM matches m JOIN activities a ON a.id = m.activity_id
       WHERE a.team_id = $1 AND m.status <> 'cancelled' AND a.starts_at::date <= $2::date
       ORDER BY a.starts_at DESC
       LIMIT 1`, [teamId, today],
    ),
    db.query<{ id: string; training_date: string | Date }>(
      `SELECT m.id, a.starts_at::date AS training_date
       FROM matches m JOIN activities a ON a.id = m.activity_id
       WHERE a.team_id = $1 AND m.status <> 'cancelled' AND a.starts_at::date > $2::date
       ORDER BY a.starts_at
       LIMIT 1`, [teamId, today],
    ),
  ])
  const previous = previousResult.rows[0]
  const next = nextResult.rows[0]
  return {
    fromMatchId: previous?.id ?? null,
    toMatchId: next?.id ?? null,
    fromDate: previous ? dateValue(previous.training_date) : shiftDate(today, -1),
    toDate: next ? dateValue(next.training_date) : shiftDate(today, 1),
  }
}

export async function attendanceSummary(clubId: string, teamId: string, fromMatchId?: string, toMatchId?: string): Promise<AttendanceSummary> {
  const interval = await intervalMatches(teamId, fromMatchId, toMatchId, await currentClubDate(clubId))
  const players = await listTeamPlayers(clubId, teamId)
  if (!interval.fromDate || !interval.toDate) return { teamId, ...interval, players: players.map((player) => ({ ...player, absences: [], absenceCount: 0, calledUp: null })) }
  const absences = await db.query<{ player_id: string; training_date: string | Date; recorded_at: string | Date }>('SELECT ta.player_id, ts.training_date, ta.recorded_at FROM training_absences ta JOIN training_sessions ts ON ts.id = ta.training_session_id WHERE ts.team_id = $1 AND ts.training_date > $2::date AND ts.training_date < $3::date ORDER BY ts.training_date', [teamId, interval.fromDate, interval.toDate])
  const convocations = await db.query<{ player_id: string }>('SELECT mc.player_id FROM match_convocations mc WHERE mc.match_id = $1 AND mc.status = \'called_up\'', [interval.toMatchId])
  const called = new Set(convocations.rows.map((row) => row.player_id))
  return { teamId, ...interval, players: players.map((player) => { const playerAbsences = absences.rows.filter((row) => row.player_id === player.id).map((row) => ({ playerId: row.player_id, trainingDate: dateValue(row.training_date), recordedAt: new Date(row.recorded_at).toISOString() })); return { ...player, absences: playerAbsences, absenceCount: playerAbsences.length, calledUp: called.has(player.id) } }) }
}

export async function matchRoster(clubId: string, teamId: string, matchId: string): Promise<MatchRoster | null> {
  const match = await db.query<{ id: string }>('SELECT m.id FROM matches m JOIN activities a ON a.id = m.activity_id JOIN teams t ON t.id = a.team_id WHERE m.id = $1 AND t.id = $2 AND t.club_id = $3', [matchId, teamId, clubId])
  if (!match.rows[0]) return null
  const players = await listTeamPlayers(clubId, teamId)
  const called = await db.query<{ player_id: string; status: string }>('SELECT player_id, status FROM match_convocations WHERE match_id = $1', [matchId])
  const statuses = new Map(called.rows.map((row) => [row.player_id, row.status === 'called_up']))
  return { teamId, matchId, players: players.map((player) => ({ ...player, calledUp: statuses.get(player.id) ?? null })) }
}

export async function updateConvocation(input: { clubId: string; teamId: string; matchId: string; playerId: string; calledUp: boolean; updatedBy: string }): Promise<void> {
  const result = await db.query<{ id: string }>(
    `INSERT INTO match_convocations (match_id, player_id, status, updated_by)
     SELECT m.id, p.id, $5, $6 FROM matches m JOIN activities a ON a.id = m.activity_id JOIN teams t ON t.id = a.team_id JOIN players p ON p.id = $4 AND p.current_team_id = t.id
     WHERE m.id = $2 AND t.id = $3 AND t.club_id = $1
     ON CONFLICT (match_id, player_id) DO UPDATE SET status = EXCLUDED.status, updated_by = EXCLUDED.updated_by, updated_at = now()
     RETURNING match_id AS id`, [input.clubId, input.matchId, input.teamId, input.playerId, input.calledUp ? 'called_up' : 'not_called', input.updatedBy],
  )
  if (!result.rows[0]) throw new Error('El partido o jugador no pertenece al equipo')
}

export async function listTeamMatches(clubId: string, teamId: string): Promise<Array<{ id: string; opponentName: string; matchDate: string; status: string }>> {
  const result = await db.query<{ id: string; opponent_name: string; match_date: string | Date; status: string }>('SELECT m.id, m.opponent_name, a.starts_at::date AS match_date, m.status FROM matches m JOIN activities a ON a.id = m.activity_id JOIN teams t ON t.id = a.team_id WHERE a.team_id = $1 AND t.club_id = $2 ORDER BY a.starts_at', [teamId, clubId])
  return result.rows.map((row) => ({ id: row.id, opponentName: row.opponent_name, matchDate: dateValue(row.match_date), status: row.status }))
}

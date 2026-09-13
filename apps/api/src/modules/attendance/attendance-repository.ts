import type { Absence, AttendanceSummary, CreatePlayerInput, CurrentSeason, MarkAbsenceResponse, Player, TrainingSession } from '@club-basket/contracts'
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

function dateValue(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)
}

function mapPlayer(row: PlayerRow): Player {
  const birthDate = dateValue(row.birth_date)
  const birthYear = Number(birthDate.slice(0, 4))
  return { id: row.id, personId: row.person_id, teamId: row.team_id, jerseyNumber: row.jersey_number, firstName: row.first_name, lastName: row.last_name, fullName: `${row.first_name} ${row.last_name}`, birthDate, birthYear, birthYearOrder: birthYear, status: row.status }
}

export async function listSeasons(clubId: string): Promise<CurrentSeason[]> {
  const result = await db.query<{ id: string; name: string; starts_on: string | Date; ends_on: string | Date }>(`SELECT id, name, starts_on, ends_on FROM seasons WHERE club_id = $1 ORDER BY starts_on DESC`, [clubId])
  return result.rows.map((row) => ({ id: row.id, name: row.name, startsOn: dateValue(row.starts_on), endsOn: dateValue(row.ends_on) }))
}

export async function findCurrentSeason(clubId: string): Promise<CurrentSeason | null> {
  const result = await db.query<{ id: string; name: string; starts_on: string; ends_on: string }>(`SELECT id, name, starts_on, ends_on FROM seasons WHERE club_id = $1 ORDER BY is_current DESC, starts_on DESC LIMIT 1`, [clubId])
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

export async function listAbsencesForDate(clubId: string, teamId: string, trainingDate: string): Promise<{ trainingDate: string; absentPlayerIds: string[] }> {
  const result = await db.query<{ player_id: string }>(
    `SELECT ta.player_id FROM training_absences ta JOIN training_sessions ts ON ts.id = ta.training_session_id JOIN teams t ON t.id = ts.team_id
     WHERE t.id = $1 AND t.club_id = $2 AND ts.training_date = $3::date ORDER BY ta.player_id`, [teamId, clubId, trainingDate],
  )
  return { trainingDate, absentPlayerIds: result.rows.map((row) => row.player_id) }
}

async function findTeamDate(clubId: string, teamId: string, trainingDate: string, createdBy: string): Promise<TrainingSession> {
  const result = await db.query<{ id: string; team_id: string; training_date: string | Date }>(
    `INSERT INTO training_sessions (team_id, training_date, created_by) SELECT t.id, $3::date, $4 FROM teams t
     WHERE t.id = $2 AND t.club_id = $1 ON CONFLICT (team_id, training_date) DO UPDATE SET created_by = EXCLUDED.created_by
     RETURNING id, team_id, training_date`, [clubId, teamId, trainingDate, createdBy],
  )
  const row = result.rows[0]
  if (!row) throw new Error('El equipo no existe en el club')
  return { id: row.id, teamId: row.team_id, trainingDate: dateValue(row.training_date) }
}

export async function markAbsence(input: { clubId: string; teamId: string; playerId: string; trainingDate: string; recordedBy: string }): Promise<MarkAbsenceResponse> {
  const session = await findTeamDate(input.clubId, input.teamId, input.trainingDate, input.recordedBy)
  const validPlayer = await db.query<{ id: string }>(`SELECT p.id FROM players p JOIN teams t ON t.id = p.current_team_id WHERE p.id = $1 AND t.id = $2 AND t.club_id = $3`, [input.playerId, input.teamId, input.clubId])
  if (!validPlayer.rows[0]) throw new Error('El jugador no pertenece al equipo')
  const result = await db.query<{ player_id: string; training_date: string | Date; recorded_at: string | Date }>(
    `INSERT INTO training_absences (training_session_id, player_id, recorded_by) VALUES ($1, $2, $3)
     ON CONFLICT (training_session_id, player_id) DO UPDATE SET recorded_by = EXCLUDED.recorded_by, recorded_at = now()
     RETURNING player_id, $4::date AS training_date, recorded_at`, [session.id, input.playerId, input.recordedBy, input.trainingDate],
  )
  const row = result.rows[0]
  if (!row) throw new Error('No se pudo registrar la ausencia')
  const countResult = await db.query<{ count: string }>(`SELECT count(*)::text AS count FROM training_absences WHERE player_id = $1`, [input.playerId])
  return { session, absence: { playerId: row.player_id, trainingDate: dateValue(row.training_date), recordedAt: new Date(row.recorded_at).toISOString() }, totalAbsencesInInterval: Number(countResult.rows[0]?.count ?? 0) }
}

export async function removeAbsence(input: { clubId: string; teamId: string; playerId: string; trainingDate: string }): Promise<void> {
  await db.query(`DELETE FROM training_absences ta USING training_sessions ts, teams t, players p WHERE ta.training_session_id = ts.id AND ts.team_id = t.id AND p.id = ta.player_id AND t.id = $1 AND t.club_id = $2 AND p.id = $3 AND ts.training_date = $4::date`, [input.teamId, input.clubId, input.playerId, input.trainingDate])
}

async function intervalMatches(teamId: string, fromMatchId?: string, toMatchId?: string): Promise<{ fromMatchId: string | null; toMatchId: string | null; fromDate: string | null; toDate: string | null }> {
  if (fromMatchId && toMatchId) {
    const selected = await db.query<{ id: string; training_date: string | Date }>(`SELECT m.id, a.starts_at::date AS training_date FROM matches m JOIN activities a ON a.id = m.activity_id WHERE m.id = ANY($1::uuid[]) AND a.team_id = $2 ORDER BY a.starts_at`, [[fromMatchId, toMatchId], teamId])
    const first = selected.rows[0]
    const second = selected.rows[1]
    if (first && second) return { fromMatchId: first.id, toMatchId: second.id, fromDate: dateValue(first.training_date), toDate: dateValue(second.training_date) }
  }
  const next = await db.query<{ id: string; training_date: string | Date }>(`SELECT m.id, a.starts_at::date AS training_date FROM matches m JOIN activities a ON a.id = m.activity_id WHERE a.team_id = $1 AND m.status <> 'cancelled' ORDER BY a.starts_at LIMIT 2`, [teamId])
  return { fromMatchId: next.rows[0]?.id ?? null, toMatchId: next.rows[1]?.id ?? null, fromDate: next.rows[0] ? dateValue(next.rows[0].training_date) : null, toDate: next.rows[1] ? dateValue(next.rows[1].training_date) : null }
}

export async function attendanceSummary(clubId: string, teamId: string, fromMatchId?: string, toMatchId?: string): Promise<AttendanceSummary> {
  const interval = await intervalMatches(teamId, fromMatchId, toMatchId)
  const players = await listTeamPlayers(clubId, teamId)
  if (!interval.fromDate || !interval.toDate) return { teamId, ...interval, players: players.map((player) => ({ ...player, absences: [], absenceCount: 0, calledUp: null })) }
  const absences = await db.query<{ player_id: string; training_date: string | Date; recorded_at: string | Date }>(`SELECT ta.player_id, ts.training_date, ta.recorded_at FROM training_absences ta JOIN training_sessions ts ON ts.id = ta.training_session_id WHERE ts.team_id = $1 AND ts.training_date > $2::date AND ts.training_date < $3::date ORDER BY ts.training_date`, [teamId, interval.fromDate, interval.toDate])
  const convocations = await db.query<{ player_id: string }>(`SELECT mc.player_id FROM match_convocations mc WHERE mc.match_id = $1 AND mc.status = 'called_up'`, [interval.toMatchId])
  const called = new Set(convocations.rows.map((row) => row.player_id))
  return { teamId, ...interval, players: players.map((player) => { const playerAbsences = absences.rows.filter((row) => row.player_id === player.id).map((row) => ({ playerId: row.player_id, trainingDate: dateValue(row.training_date), recordedAt: new Date(row.recorded_at).toISOString() })); return { ...player, absences: playerAbsences, absenceCount: playerAbsences.length, calledUp: called.has(player.id) } }) }
}

export async function updateConvocation(input: { clubId: string; teamId: string; matchId: string; playerId: string; calledUp: boolean; updatedBy: string }): Promise<void> {
  const result = await db.query<{ id: string }>(
    `INSERT INTO match_convocations (match_id, player_id, status, updated_by)
     SELECT m.id, p.id, $5, $6
     FROM matches m
     JOIN activities a ON a.id = m.activity_id
     JOIN teams t ON t.id = a.team_id
     JOIN players p ON p.id = $4 AND p.current_team_id = t.id
     WHERE m.id = $2 AND t.id = $3 AND t.club_id = $1
     ON CONFLICT (match_id, player_id)
     DO UPDATE SET status = EXCLUDED.status, updated_by = EXCLUDED.updated_by, updated_at = now()
     RETURNING match_id AS id`,
    [input.clubId, input.matchId, input.teamId, input.playerId, input.calledUp ? 'called_up' : 'not_called', input.updatedBy],
  )
  if (!result.rows[0]) throw new Error('El partido o jugador no pertenece al equipo')
}

export async function listTeamMatches(clubId: string, teamId: string): Promise<Array<{ id: string; opponentName: string; matchDate: string; status: string }>> {
  const result = await db.query<{ id: string; opponent_name: string; match_date: string | Date; status: string }>(`SELECT m.id, m.opponent_name, a.starts_at::date AS match_date, m.status FROM matches m JOIN activities a ON a.id = m.activity_id JOIN teams t ON t.id = a.team_id WHERE a.team_id = $1 AND t.club_id = $2 ORDER BY a.starts_at`, [teamId, clubId])
  return result.rows.map((row) => ({ id: row.id, opponentName: row.opponent_name, matchDate: dateValue(row.match_date), status: row.status }))
}

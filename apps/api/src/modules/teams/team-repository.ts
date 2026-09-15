import type { CreateTeamInput, ListTeamsQuery, PaginatedTeams, Team, TeamCoach, TrainingSchedule, UpsertTrainingSchedulesInput } from '@club-basket/contracts'
import { db } from '../../database/client.js'

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

function mapTeam(row: TeamRow): Team {
  return {
    id: row.id,
    clubId: row.club_id,
    seasonId: row.season_id,
    categoryId: row.category_id,
    name: row.name,
    category: row.category,
    gender: row.gender,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

export async function listTeams(clubId: string, query: ListTeamsQuery, allowedTeamIds?: string[]): Promise<PaginatedTeams> {
  const conditions: string[] = ['club_id = $1']
  const values: Array<string | number | string[]> = [clubId]

  if (allowedTeamIds) {
    values.push(allowedTeamIds)
    conditions.push(`id = ANY($${values.length}::uuid[])`)
  }
  if (query.seasonId) {
    values.push(query.seasonId)
    conditions.push(`season_id = $${values.length}`)
  }
  if (query.status) {
    values.push(query.status)
    conditions.push(`status = $${values.length}`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const countResult = await db.query<{ count: string }>(`SELECT count(*)::text AS count FROM teams ${where}`, values)
  const total = Number(countResult.rows[0]?.count ?? 0)

  values.push(String(query.limit), String(query.offset))
  const result = await db.query<TeamRow>(
    `SELECT id, club_id, season_id, name, category, category_id, gender, status, created_at, updated_at
     FROM teams ${where} ORDER BY category, name LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  )

  return {
    items: result.rows.map(mapTeam),
    total,
    limit: query.limit,
    offset: query.offset,
  }
}

export async function findTeam(clubId: string, teamId: string): Promise<Team | null> {
  const result = await db.query<TeamRow>(
    `SELECT id, club_id, season_id, name, category, category_id, gender, status, created_at, updated_at
     FROM teams WHERE id = $1 AND club_id = $2`, [teamId, clubId],
  )
  return result.rows[0] ? mapTeam(result.rows[0]) : null
}

export async function listTeamCoaches(clubId: string, teamId: string): Promise<TeamCoach[]> {
  const result = await db.query<TeamCoach>(
    `SELECT u.id, u.display_name AS "displayName", u.email
     FROM user_team_coaches utc
     JOIN users u ON u.id = utc.user_id
     JOIN teams t ON t.id = utc.team_id
     JOIN club_memberships cm ON cm.user_id = u.id AND cm.club_id = t.club_id
     WHERE t.id = $1 AND t.club_id = $2 AND u.status = 'active' AND 'coach' = ANY(cm.roles)
     ORDER BY u.display_name, u.email`, [teamId, clubId],
  )
  return result.rows
}

export async function listTrainingSchedules(clubId: string, teamId: string): Promise<TrainingSchedule[]> {
  const result = await db.query<{ id: string; team_id: string; weekday: number; starts_at: string; ends_at: string; venue_name: string | null }>(
    `SELECT s.id, s.team_id, s.weekday, to_char(s.starts_at, 'HH24:MI') AS starts_at, to_char(s.ends_at, 'HH24:MI') AS ends_at, s.venue_name
     FROM team_training_schedules s JOIN teams t ON t.id = s.team_id
     WHERE s.team_id = $1 AND t.club_id = $2 ORDER BY s.weekday, s.starts_at`, [teamId, clubId],
  )
  return result.rows.map((row) => ({ id: row.id, teamId: row.team_id, weekday: row.weekday, startsAt: row.starts_at, endsAt: row.ends_at, venueName: row.venue_name }))
}

export async function replaceTrainingSchedules(clubId: string, teamId: string, input: UpsertTrainingSchedulesInput): Promise<TrainingSchedule[]> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const team = await client.query<{ id: string }>('SELECT id FROM teams WHERE id = $1 AND club_id = $2', [teamId, clubId])
    if (!team.rows[0]) throw new Error('El equipo no existe en el club')
    await client.query('DELETE FROM team_training_schedules WHERE team_id = $1', [teamId])
    for (const schedule of input.schedules) {
      await client.query(
        `INSERT INTO team_training_schedules (team_id, weekday, starts_at, ends_at, venue_name)
         VALUES ($1, $2, $3::time, $4::time, $5)`,
        [teamId, schedule.weekday, schedule.startsAt, schedule.endsAt, schedule.venueName ?? null],
      )
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
  return listTrainingSchedules(clubId, teamId)
}

export async function createTeam(clubId: string, input: CreateTeamInput): Promise<Team> {
  const result = await db.query<TeamRow>(
    `INSERT INTO teams (club_id, season_id, name, category, category_id, gender)
     SELECT $1, $2, $3, c.name, c.id, $5
     FROM categories c
     WHERE c.id = $4 AND c.club_id = $1 AND c.status = 'active'
       AND EXISTS (SELECT 1 FROM seasons WHERE id = $2 AND club_id = $1)
     RETURNING id, club_id, season_id, name, category, category_id, gender, status, created_at, updated_at`,
    [clubId, input.seasonId, input.name, input.categoryId, input.gender],
  )

  const row = result.rows[0]
  if (!row) throw new Error('No se pudo crear el equipo')
  return mapTeam(row)
}

import type { Activity, CreateActivityInput, ListActivitiesQuery, PaginatedActivities, UpdateActivityInput } from '@club-basket/contracts'
import type { PoolClient } from 'pg'
import { db } from '../../database/client.js'

interface ActivityRow {
  id: string
  team_id: string
  team_name: string
  type: Activity['type']
  starts_at: Date
  ends_at: Date | null
  status: Activity['status']
  venue_name: string | null
  notes: string | null
  opponent_name: string | null
  is_home: boolean | null
  competition: string | null
  match_phase: Activity['matchPhase']
  league_tier: Activity['leagueTier']
  match_status: Activity['matchStatus']
}

function mapActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    teamId: row.team_id,
    teamName: row.team_name,
    type: row.type,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at?.toISOString() ?? null,
    status: row.status,
    venueName: row.venue_name,
    notes: row.notes,
    opponentName: row.opponent_name,
    isHome: row.is_home,
    competition: row.competition,
    matchPhase: row.match_phase,
    leagueTier: row.league_tier,
    matchStatus: row.match_status,
  }
}

type DbClient = PoolClient

async function findActivity(client: DbClient, clubId: string, activityId: string): Promise<Activity | null> {
  const result = await client.query<ActivityRow>(
    `SELECT a.id, a.team_id, t.name AS team_name,
            CASE WHEN m.id IS NULL THEN 'training' ELSE 'match' END AS type,
            a.starts_at, a.ends_at, a.status, v.name AS venue_name, a.notes,
            m.opponent_name, m.is_home, m.competition, m.phase AS match_phase, m.league_tier AS league_tier, m.status AS match_status
     FROM activities a
     JOIN teams t ON t.id = a.team_id
     LEFT JOIN venues v ON v.id = a.venue_id
     LEFT JOIN matches m ON m.activity_id = a.id
     WHERE a.id = $1 AND t.club_id = $2`,
    [activityId, clubId],
  )
  return result.rows[0] ? mapActivity(result.rows[0]) : null
}

async function resolveVenue(client: DbClient, clubId: string, venueName: string | null | undefined): Promise<string | null> {
  if (!venueName) return null
  const result = await client.query<{ id: string }>(
    `INSERT INTO venues (club_id, name) VALUES ($1, $2)
     ON CONFLICT (club_id, name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [clubId, venueName],
  )
  return result.rows[0]?.id ?? null
}

export async function createActivity(clubId: string, input: CreateActivityInput, allowedTeamIds?: string[]): Promise<Activity> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const team = await client.query<{ id: string }>(`SELECT id FROM teams WHERE id = $1 AND club_id = $2 ${allowedTeamIds ? 'AND id = ANY($3::uuid[])' : ''}`, allowedTeamIds ? [input.teamId, clubId, allowedTeamIds] : [input.teamId, clubId])
    if (!team.rows[0]) throw new Error('El equipo no existe en el club')
    const venueId = await resolveVenue(client, clubId, input.venueName)
    const activity = await client.query<{ id: string }>(
      `INSERT INTO activities (team_id, venue_id, starts_at, ends_at, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [input.teamId, venueId, input.startsAt, input.endsAt ?? null, input.notes ?? null],
    )
    const activityId = activity.rows[0]?.id
    if (!activityId) throw new Error('No se pudo crear la actividad')
    if (input.type === 'match') {
      await client.query(
        `INSERT INTO matches (activity_id, opponent_name, is_home, competition, phase, league_tier)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [activityId, input.opponentName, input.isHome, input.competition ?? null, input.phase, input.leagueTier ?? null],
      )
    }
    const created = await findActivity(client, clubId, activityId)
    if (!created) throw new Error('No se pudo recuperar la actividad creada')
    await client.query('COMMIT')
    return created
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function updateActivity(clubId: string, activityId: string, input: UpdateActivityInput, allowedTeamIds?: string[]): Promise<Activity | null> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const existing = await client.query<{ id: string; type: Activity['type'] }>(
      `SELECT a.id, CASE WHEN m.id IS NULL THEN 'training' ELSE 'match' END AS type
       FROM activities a JOIN teams t ON t.id = a.team_id
       LEFT JOIN matches m ON m.activity_id = a.id
       WHERE a.id = $1 AND t.club_id = $2 ${allowedTeamIds ? 'AND t.id = ANY($3::uuid[])' : ''}`,
      allowedTeamIds ? [activityId, clubId, allowedTeamIds] : [activityId, clubId],
    )
    if (!existing.rows[0]) {
      await client.query('ROLLBACK')
      return null
    }
    if (existing.rows[0].type !== input.type) throw new Error('No se puede cambiar el tipo de actividad')
    const team = await client.query<{ id: string }>(`SELECT id FROM teams WHERE id = $1 AND club_id = $2 ${allowedTeamIds ? 'AND id = ANY($3::uuid[])' : ''}`, allowedTeamIds ? [input.teamId, clubId, allowedTeamIds] : [input.teamId, clubId])
    if (!team.rows[0]) throw new Error('El equipo no existe en el club')
    const venueId = await resolveVenue(client, clubId, input.venueName)
    await client.query(
      `UPDATE activities a SET team_id = $1, venue_id = $2, starts_at = $3, ends_at = $4, notes = $5,
       status = COALESCE($6::activity_status, a.status), updated_at = now()
       WHERE a.id = $7`,
      [input.teamId, venueId, input.startsAt, input.endsAt ?? null, input.notes ?? null, input.status ?? null, activityId],
    )
    if (input.type === 'match') {
      await client.query(
        `UPDATE matches m SET opponent_name = $1, is_home = $2, competition = $3, phase = $4, league_tier = $5,
         status = CASE WHEN $6::activity_status = 'cancelled' THEN 'cancelled'::match_status ELSE m.status END,
         updated_at = now() WHERE m.activity_id = $7`,
        [input.opponentName, input.isHome, input.competition ?? null, input.phase, input.leagueTier ?? null, input.status ?? null, activityId],
      )
    }
    const updated = await findActivity(client, clubId, activityId)
    await client.query('COMMIT')
    return updated
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function listActivities(clubId: string, query: ListActivitiesQuery, allowedTeamIds?: string[]): Promise<PaginatedActivities> {
  const conditions = ['t.club_id = $1']
  const values: Array<string | number | string[]> = [clubId]

  if (allowedTeamIds) {
    values.push(allowedTeamIds)
    conditions.push(`t.id = ANY($${values.length}::uuid[])`)
  }
  if (query.teamId) {
    values.push(query.teamId)
    conditions.push(`a.team_id = $${values.length}`)
  }
  if (query.seasonId) {
    values.push(query.seasonId)
    conditions.push(`t.season_id = $${values.length}`)
  }
  if (query.fromDate) {
    values.push(query.fromDate)
    conditions.push(`a.starts_at >= $${values.length}::date`)
  }
  if (query.toDate) {
    values.push(query.toDate)
    conditions.push(`a.starts_at < ($${values.length}::date + interval '1 day')`)
  }

  const where = conditions.join(' AND ')
  const countResult = await db.query<{ count: string }>(`SELECT count(*)::text AS count FROM activities a JOIN teams t ON t.id = a.team_id WHERE ${where}`, values)
  const total = Number(countResult.rows[0]?.count ?? 0)

  const limitPosition = values.length + 1
  const offsetPosition = values.length + 2
  const result = await db.query<ActivityRow>(
    `SELECT a.id,
            a.team_id,
            t.name AS team_name,
            CASE WHEN m.id IS NULL THEN 'training' ELSE 'match' END AS type,
            a.starts_at,
            a.ends_at,
            a.status,
            v.name AS venue_name,
            a.notes,
            m.opponent_name,
            m.is_home,
            m.competition,
            m.phase AS match_phase,
            m.league_tier AS league_tier,
            m.status AS match_status
     FROM activities a
     JOIN teams t ON t.id = a.team_id
     LEFT JOIN venues v ON v.id = a.venue_id
     LEFT JOIN matches m ON m.activity_id = a.id
     WHERE ${where}
     ORDER BY a.starts_at ASC, a.id ASC
     LIMIT $${limitPosition} OFFSET $${offsetPosition}`,
    [...values, query.limit, query.offset],
  )

  return { items: result.rows.map(mapActivity), total, limit: query.limit, offset: query.offset }
}

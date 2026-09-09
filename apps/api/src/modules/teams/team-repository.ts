import type { CreateTeamInput, ListTeamsQuery, PaginatedTeams, Team } from '@club-basket/contracts'
import { db } from '../../database/client.js'

interface TeamRow {
  id: string
  club_id: string
  season_id: string
  name: string
  category: string
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
    name: row.name,
    category: row.category,
    gender: row.gender,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

export async function listTeams(clubId: string, query: ListTeamsQuery): Promise<PaginatedTeams> {
  const conditions: string[] = ['club_id = $1']
  const values: string[] = [clubId]

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
    `SELECT id, club_id, season_id, name, category, gender, status, created_at, updated_at
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

export async function createTeam(clubId: string, input: CreateTeamInput): Promise<Team> {
  const result = await db.query<TeamRow>(
    `INSERT INTO teams (club_id, season_id, name, category, gender)
     SELECT $1, $2, $3, $4, $5
     WHERE EXISTS (SELECT 1 FROM seasons WHERE id = $2 AND club_id = $1)
     RETURNING id, club_id, season_id, name, category, gender, status, created_at, updated_at`,
    [clubId, input.seasonId, input.name, input.category, input.gender],
  )

  const row = result.rows[0]
  if (!row) throw new Error('No se pudo crear el equipo')
  return mapTeam(row)
}

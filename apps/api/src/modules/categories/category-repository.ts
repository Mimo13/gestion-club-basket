import type { Category, CreateCategoryInput, UpdateCategoryInput } from '@club-basket/contracts'
import { db } from '../../database/client.js'

interface CategoryRow {
  id: string
  club_id: string
  name: string
  age_min: number | null
  age_max: number | null
  birth_year_from: number | null
  birth_year_to: number | null
  birth_year_label: string | null
  sort_order: number
  status: Category['status']
  created_at: Date
  updated_at: Date
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    clubId: row.club_id,
    name: row.name,
    ageMin: row.age_min,
    ageMax: row.age_max,
    birthYearFrom: row.birth_year_from,
    birthYearTo: row.birth_year_to,
    birthYearLabel: row.birth_year_label,
    sortOrder: row.sort_order,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

const columns = `id, club_id, name, age_min, age_max, birth_year_from, birth_year_to,
  birth_year_label, sort_order, status, created_at, updated_at`

export async function listCategories(clubId: string, includeInactive = true): Promise<Category[]> {
  const result = await db.query<CategoryRow>(
    `SELECT ${columns} FROM categories WHERE club_id = $1 ${includeInactive ? '' : "AND status = 'active'"}
     ORDER BY sort_order, name`,
    [clubId],
  )
  return result.rows.map(mapCategory)
}

export async function createCategory(clubId: string, input: CreateCategoryInput): Promise<Category> {
  const result = await db.query<CategoryRow>(
    `INSERT INTO categories (
      club_id, name, age_min, age_max, birth_year_from, birth_year_to,
      birth_year_label, sort_order
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING ${columns}`,
    [clubId, input.name, input.ageMin ?? null, input.ageMax ?? null, input.birthYearFrom ?? null, input.birthYearTo ?? null, input.birthYearLabel ?? null, input.sortOrder],
  )
  const row = result.rows[0]
  if (!row) throw new Error('No se pudo crear la categoría')
  return mapCategory(row)
}

export async function updateCategory(clubId: string, categoryId: string, input: UpdateCategoryInput): Promise<Category | null> {
  const fields: string[] = []
  const values: unknown[] = [clubId, categoryId]
  const mapping: Array<[keyof UpdateCategoryInput, string]> = [
    ['name', 'name'], ['ageMin', 'age_min'], ['ageMax', 'age_max'], ['birthYearFrom', 'birth_year_from'],
    ['birthYearTo', 'birth_year_to'], ['birthYearLabel', 'birth_year_label'], ['sortOrder', 'sort_order'], ['status', 'status'],
  ]
  for (const [key, column] of mapping) {
    if (input[key] !== undefined) {
      values.push(input[key])
      fields.push(`${column} = $${values.length}`)
    }
  }
  if (fields.length === 0) {
    const existing = await db.query<CategoryRow>(`SELECT ${columns} FROM categories WHERE club_id = $1 AND id = $2`, values.slice(0, 2))
    return existing.rows[0] ? mapCategory(existing.rows[0]) : null
  }
  fields.push('updated_at = now()')
  const result = await db.query<CategoryRow>(
    `UPDATE categories SET ${fields.join(', ')} WHERE club_id = $1 AND id = $2 RETURNING ${columns}`,
    values,
  )
  return result.rows[0] ? mapCategory(result.rows[0]) : null
}

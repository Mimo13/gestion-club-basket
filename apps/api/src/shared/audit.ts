import { db } from '../database/client.js'

export async function recordAuditEvent(input: {
  clubId: string
  actorUserId?: string
  action: string
  entityType: string
  entityId?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  await db.query(
    `INSERT INTO audit_events (club_id, actor_user_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [input.clubId, input.actorUserId ?? null, input.action, input.entityType, input.entityId ?? null, JSON.stringify(input.metadata ?? {})],
  )
}

import type { FastifyInstance } from 'fastify'
import { categoriesResponseSchema, createCategoryInputSchema, updateCategoryInputSchema } from '@club-basket/contracts'
import { recordAuditEvent } from '../../shared/audit.js'
import { requireCsrf } from '../identity/csrf.js'
import { requireAuthenticatedUser, requireRole } from '../identity/auth-context.js'
import { createCategory, listCategories, updateCategory } from './category-repository.js'

export async function categoryRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/categories', async (request, reply) => {
    const user = await requireAuthenticatedUser(request, reply)
    if (!user) return
    return categoriesResponseSchema.parse({ items: await listCategories(user.clubId, false) })
  })

  app.get('/api/v1/settings/categories', async (request, reply) => {
    const user = await requireRole(request, reply, ['club_admin', 'coordinator'])
    if (!user) return
    return categoriesResponseSchema.parse({ items: await listCategories(user.clubId) })
  })

  app.post('/api/v1/settings/categories', async (request, reply) => {
    if (!(await requireCsrf(request, reply))) return
    const user = await requireRole(request, reply, ['club_admin', 'coordinator'])
    if (!user) return
    const input = createCategoryInputSchema.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Los datos de la categoría no son válidos', details: input.error.flatten() } })
    try {
      const category = await createCategory(user.clubId, input.data)
      await recordAuditEvent({ clubId: user.clubId, actorUserId: user.id, action: 'settings.category_created', entityType: 'category', entityId: category.id })
      return reply.code(201).send(category)
    } catch (error) {
      if ((error as { code?: string }).code === '23505') return reply.code(409).send({ error: { code: 'CATEGORY_EXISTS', message: 'Ya existe una categoría con ese nombre' } })
      throw error
    }
  })

  app.patch('/api/v1/settings/categories/:categoryId', async (request, reply) => {
    if (!(await requireCsrf(request, reply))) return
    const user = await requireRole(request, reply, ['club_admin', 'coordinator'])
    if (!user) return
    const input = updateCategoryInputSchema.safeParse(request.body)
    if (!input.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Los datos de la categoría no son válidos', details: input.error.flatten() } })
    const categoryId = String((request.params as { categoryId: string }).categoryId)
    const category = await updateCategory(user.clubId, categoryId, input.data)
    if (!category) return reply.code(404).send({ error: { code: 'CATEGORY_NOT_FOUND', message: 'La categoría no existe' } })
    await recordAuditEvent({ clubId: user.clubId, actorUserId: user.id, action: 'settings.category_updated', entityType: 'category', entityId: category.id })
    return reply.send(category)
  })
}

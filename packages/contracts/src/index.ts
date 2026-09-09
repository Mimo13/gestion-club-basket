import { z } from 'zod'

export const uuidSchema = z.string().uuid()
export const isoDateTimeSchema = z.string().datetime({ offset: true })

export const roleSchema = z.enum(['club_admin', 'coordinator', 'coach', 'assistant', 'viewer'])
export type Role = z.infer<typeof roleSchema>

export const userStatusSchema = z.enum(['active', 'invited', 'disabled'])
export type UserStatus = z.infer<typeof userStatusSchema>

export const loginInputSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(200),
  client: z.enum(['web', 'mobile']).default('web'),
})
export type LoginInput = z.infer<typeof loginInputSchema>

export const authenticatedUserSchema = z.object({
  id: uuidSchema,
  email: z.string().email(),
  displayName: z.string().min(1),
  clubId: uuidSchema,
  role: roleSchema,
})
export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>

export const sessionResponseSchema = z.object({
  user: authenticatedUserSchema,
  expiresAt: isoDateTimeSchema.optional(),
  accessToken: z.string().min(1).optional(),
})
export type SessionResponse = z.infer<typeof sessionResponseSchema>

export const forgotPasswordInputSchema = z.object({ email: z.string().trim().email().transform((value) => value.toLowerCase()) })
export type ForgotPasswordInput = z.infer<typeof forgotPasswordInputSchema>

export const resetPasswordInputSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(12).max(200),
})
export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>

export const changePasswordInputSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(12).max(200),
})
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>

export const createManagedUserInputSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  displayName: z.string().trim().min(1).max(160),
  role: roleSchema,
})
export type CreateManagedUserInput = z.infer<typeof createManagedUserInputSchema>

export const managedUserSchema = z.object({
  id: uuidSchema,
  email: z.string().email(),
  displayName: z.string().min(1),
  status: userStatusSchema,
  role: roleSchema,
  clubId: uuidSchema,
  createdAt: isoDateTimeSchema,
})
export type ManagedUser = z.infer<typeof managedUserSchema>

export const updateUserRoleInputSchema = z.object({ role: roleSchema })
export const updateUserStatusInputSchema = z.object({ status: userStatusSchema })
export const managedUsersResponseSchema = z.object({ items: z.array(managedUserSchema) })

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  timestamp: isoDateTimeSchema,
})
export type HealthResponse = z.infer<typeof healthResponseSchema>

export const teamStatusSchema = z.enum(['active', 'inactive', 'archived'])
export type TeamStatus = z.infer<typeof teamStatusSchema>

export const teamSchema = z.object({
  id: uuidSchema,
  clubId: uuidSchema,
  seasonId: uuidSchema,
  name: z.string().min(1).max(120),
  category: z.string().min(1).max(80),
  gender: z.enum(['female', 'male', 'mixed', 'unspecified']),
  status: teamStatusSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})
export type Team = z.infer<typeof teamSchema>

export const createTeamInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(80),
  gender: z.enum(['female', 'male', 'mixed', 'unspecified']).default('unspecified'),
  seasonId: uuidSchema,
})
export type CreateTeamInput = z.infer<typeof createTeamInputSchema>

export const listTeamsQuerySchema = z.object({
  seasonId: uuidSchema.optional(),
  status: teamStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})
export type ListTeamsQuery = z.infer<typeof listTeamsQuerySchema>

export const paginatedTeamsSchema = z.object({
  items: z.array(teamSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
})
export type PaginatedTeams = z.infer<typeof paginatedTeamsSchema>

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
})
export type ApiError = z.infer<typeof apiErrorSchema>

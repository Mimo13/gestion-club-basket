import { z } from 'zod'

export const uuidSchema = z.string().uuid()
export const isoDateTimeSchema = z.string().datetime({ offset: true })
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

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

export const forgotPasswordInputSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
})
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

export const categoryStatusSchema = z.enum(['active', 'inactive'])
export type CategoryStatus = z.infer<typeof categoryStatusSchema>

export const categorySchema = z.object({
  id: uuidSchema,
  clubId: uuidSchema,
  name: z.string().min(1).max(80),
  ageMin: z.number().int().nonnegative().nullable(),
  ageMax: z.number().int().nonnegative().nullable(),
  birthYearFrom: z.number().int().min(1900).max(2200).nullable(),
  birthYearTo: z.number().int().min(1900).max(2200).nullable(),
  birthYearLabel: z.string().max(80).nullable(),
  sortOrder: z.number().int().nonnegative(),
  status: categoryStatusSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})
export type Category = z.infer<typeof categorySchema>

export const createCategoryInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  ageMin: z.number().int().nonnegative().nullable().optional(),
  ageMax: z.number().int().nonnegative().nullable().optional(),
  birthYearFrom: z.number().int().min(1900).max(2200).nullable().optional(),
  birthYearTo: z.number().int().min(1900).max(2200).nullable().optional(),
  birthYearLabel: z.string().trim().max(80).nullable().optional(),
  sortOrder: z.number().int().nonnegative().default(100),
})
export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>

export const updateCategoryInputSchema = createCategoryInputSchema.partial().extend({
  status: categoryStatusSchema.optional(),
})
export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>
export const categoriesResponseSchema = z.object({ items: z.array(categorySchema) })

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  timestamp: isoDateTimeSchema,
})
export type HealthResponse = z.infer<typeof healthResponseSchema>

export const currentSeasonSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  startsOn: dateSchema,
  endsOn: dateSchema,
})
export type CurrentSeason = z.infer<typeof currentSeasonSchema>

export const teamStatusSchema = z.enum(['active', 'inactive', 'archived'])
export type TeamStatus = z.infer<typeof teamStatusSchema>

export const teamSchema = z.object({
  id: uuidSchema,
  clubId: uuidSchema,
  seasonId: uuidSchema,
  categoryId: uuidSchema.nullable().optional(),
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
  categoryId: uuidSchema,
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

export const playerSchema = z.object({
  id: uuidSchema,
  personId: uuidSchema,
  teamId: uuidSchema,
  jerseyNumber: z.number().int().min(0).max(99).nullable(),
  firstName: z.string(),
  lastName: z.string(),
  fullName: z.string(),
  birthDate: dateSchema,
  birthYear: z.number().int(),
  birthYearOrder: z.number().int(),
  status: z.enum(['active', 'inactive', 'archived']),
})
export type Player = z.infer<typeof playerSchema>
export const playersResponseSchema = z.object({ items: z.array(playerSchema) })

export const trainingSessionSchema = z.object({
  id: uuidSchema,
  teamId: uuidSchema,
  trainingDate: dateSchema,
})
export type TrainingSession = z.infer<typeof trainingSessionSchema>

export const absenceSchema = z.object({
  playerId: uuidSchema,
  trainingDate: dateSchema,
  recordedAt: isoDateTimeSchema,
})
export type Absence = z.infer<typeof absenceSchema>

export const markAbsenceResponseSchema = z.object({
  session: trainingSessionSchema,
  absence: absenceSchema,
  totalAbsencesInInterval: z.number().int().nonnegative(),
})
export type MarkAbsenceResponse = z.infer<typeof markAbsenceResponseSchema>

export const attendanceSummaryPlayerSchema = playerSchema.extend({
  absences: z.array(absenceSchema),
  absenceCount: z.number().int().nonnegative(),
  calledUp: z.boolean().nullable(),
})
export const attendanceSummarySchema = z.object({
  teamId: uuidSchema,
  fromMatchId: uuidSchema.nullable(),
  toMatchId: uuidSchema.nullable(),
  fromDate: dateSchema.nullable(),
  toDate: dateSchema.nullable(),
  players: z.array(attendanceSummaryPlayerSchema),
})
export type AttendanceSummary = z.infer<typeof attendanceSummarySchema>

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
})
export type ApiError = z.infer<typeof apiErrorSchema>

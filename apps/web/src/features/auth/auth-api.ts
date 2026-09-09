import { createApiClient } from '@club-basket/api-client'

export const authApi = createApiClient(import.meta.env.VITE_API_URL ?? 'http://localhost:3000')

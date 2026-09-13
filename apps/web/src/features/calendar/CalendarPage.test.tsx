import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PropsWithChildren } from 'react'
import { CalendarPage } from './CalendarPage.js'

const mocks = vi.hoisted(() => ({ listTeams: vi.fn(), listSeasons: vi.fn(), listActivities: vi.fn(), createActivity: vi.fn(), updateActivity: vi.fn() }))

vi.mock('@club-basket/api-client', () => ({
  ApiClientError: class ApiClientError extends Error {},
  createApiClient: () => mocks,
}))

vi.mock('../../features/auth/AuthProvider.js', () => ({
  useAuth: () => ({ user: { role: 'viewer' }, isLoading: false }),
}))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider> }
  return render(<CalendarPage />, { wrapper: Wrapper })
}

describe('CalendarPage', () => {
  afterEach(() => cleanup())

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listTeams.mockResolvedValue({ items: [{ id: 'team-1', name: 'Cadete', category: 'Cadete' }], total: 1, limit: 50, offset: 0 })
    mocks.listSeasons.mockResolvedValue({ items: [] })
    mocks.listActivities.mockResolvedValue({ items: [], total: 0, limit: 100, offset: 0 })
  })

  it('loads the default week view and changes to day view', async () => {
    renderPage()

    expect(await screen.findByRole('button', { name: 'Semana' })).toHaveClass('active')
    fireEvent.click(screen.getByRole('button', { name: 'Día' }))

    expect(screen.getByRole('button', { name: 'Día' })).toHaveClass('active')
    await waitFor(() => expect(mocks.listActivities).toHaveBeenCalled())
  })

  it('filters the agenda by team', async () => {
    renderPage()
    await screen.findByRole('option', { name: 'Cadete' })
    const teamSelect = (await screen.findAllByRole('combobox'))[1]
    if (!teamSelect) throw new Error('No se encontró el filtro de equipo')
    const user = (userEvent as unknown as { setup: () => { selectOptions: (element: HTMLElement, value: string) => Promise<void> } }).setup()

    await user.selectOptions(teamSelect, 'team-1')

    await waitFor(() => expect(mocks.listActivities.mock.calls.some(([query]) => query.teamId === 'team-1' && query.limit === 100)).toBe(true))
  })
})

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PropsWithChildren } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PlayerDetailPage } from './PlayerDetailPage.js'

const mocks = vi.hoisted(() => ({ playerDetail: vi.fn(), attendanceCalendar: vi.fn(), removeAbsence: vi.fn() }))
const auth = vi.hoisted(() => ({ roles: ['coach'] as string[] }))

vi.mock('@club-basket/api-client', () => ({
  ApiClientError: class ApiClientError extends Error {
    constructor(_status: number, _code: string, message: string) { super(message) }
  },
  createApiClient: () => mocks,
}))

vi.mock('../auth/AuthProvider.js', () => ({
  useAuth: () => ({ user: { teamIds: ['team-1'], roles: auth.roles }, isLoading: false }),
}))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider> }
  return render(<MemoryRouter initialEntries={['/players/player-1']}><Routes><Route path="/players/:playerId" element={<PlayerDetailPage />} /></Routes></MemoryRouter>, { wrapper: Wrapper })
}

const detail = {
  player: { id: 'player-1', personId: 'person-1', teamId: 'team-1', jerseyNumber: 0, firstName: 'José Pablo', lastName: 'Robles Valero', fullName: 'José Pablo Robles Valero', birthDate: '2012-06-16', birthYear: 2012, birthYearOrder: 2012, status: 'active' },
  team: { id: 'team-1', clubId: 'club-1', seasonId: 'season-1', categoryId: null, name: 'Cadete Masculino', category: 'Cadete', gender: 'male', status: 'active', createdAt: '2026-09-01T00:00:00+00:00', updatedAt: '2026-09-01T00:00:00+00:00' },
  absences: [
    { playerId: 'player-1', trainingDate: '2026-08-18', recordedAt: '2026-09-15T10:00:00+00:00' },
    { playerId: 'player-1', trainingDate: '2026-08-25', recordedAt: '2026-09-15T10:00:00+00:00' },
  ],
}

describe('PlayerDetailPage', () => {
  afterEach(() => cleanup())

  beforeEach(() => {
    vi.clearAllMocks()
    auth.roles = ['coach']
    mocks.playerDetail.mockResolvedValue(detail)
    mocks.attendanceCalendar.mockResolvedValue({ fromDate: '2026-06-18', toDate: '2026-09-15', teams: [] })
    mocks.removeAbsence.mockResolvedValue(undefined)
  })

  it('lists every absence of the player and removes the selected one', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'José Pablo Robles Valero' })).toBeInTheDocument()
    expect(screen.getByText('2 faltas registradas')).toBeInTheDocument()
    expect(screen.getByText('18/08/2026')).toBeInTheDocument()
    expect(screen.getByText('25/08/2026')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Quitar la falta del 18/08/2026' }))
    expect(await screen.findByRole('heading', { name: 'Quitar la falta' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Quitar falta' }))

    await waitFor(() => expect(mocks.removeAbsence).toHaveBeenCalledWith('team-1', 'player-1', '2026-08-18'))
    expect(await screen.findByRole('status')).toHaveTextContent('Falta eliminada')
  })

  it('does not offer removal to users without attendance permissions', async () => {
    auth.roles = ['viewer']
    renderPage()

    expect(await screen.findByText('2 faltas registradas')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Quitar la falta del/ })).not.toBeInTheDocument()
  })
})

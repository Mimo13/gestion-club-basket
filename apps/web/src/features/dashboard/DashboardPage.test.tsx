import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PropsWithChildren } from 'react'
import { DashboardPage } from './DashboardPage.js'

const mocks = vi.hoisted(() => ({ listTeams: vi.fn(), todayAttendance: vi.fn(), listActivities: vi.fn(), markAbsence: vi.fn(), removeAbsence: vi.fn() }))
let markedToday = false

vi.mock('@club-basket/api-client', () => ({
  ApiClientError: class ApiClientError extends Error {
    constructor(_status: number, _code: string, message: string) { super(message) }
  },
  createApiClient: () => mocks,
}))

vi.mock('../auth/AuthProvider.js', () => ({
  useAuth: () => ({ user: { teamIds: ['team-1'], roles: ['coach'] }, isLoading: false }),
}))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider> }
  return render(<DashboardPage />, { wrapper: Wrapper })
}

function attendance(teamId: string, teamName: string, isTrainingDay = true) {
  return {
    teamId,
    trainingDate: '2026-09-15',
    currentTime: '18:00',
    isTrainingDay,
    isCurrentTraining: isTrainingDay,
    schedule: isTrainingDay ? { weekday: 1, startsAt: '17:00', endsAt: '18:30', venueName: 'Pabellón' } : null,
    players: [
      { id: 'player-2', personId: 'person-2', teamId, jerseyNumber: 10, firstName: 'Ana', lastName: 'Pérez', fullName: 'Ana Pérez', birthDate: '2012-01-01', birthYear: 2012, birthYearOrder: 2012, status: 'active', absentToday: false, totalAbsences: 2 },
      { id: 'player-1', personId: 'person-1', teamId, jerseyNumber: 0, firstName: 'Luis', lastName: 'García', fullName: 'Luis García', birthDate: '2012-01-01', birthYear: 2012, birthYearOrder: 2012, status: 'active', absentToday: false, totalAbsences: 1 },
    ],
    teamName,
  }
}

describe('DashboardPage', () => {
  afterEach(() => cleanup())

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listTeams.mockResolvedValue({ items: [{ id: 'team-1', name: 'Cadete', category: 'Cadete' }], total: 1, limit: 100, offset: 0 })
    markedToday = false
    mocks.todayAttendance.mockImplementation(async () => {
      const current = attendance('team-1', 'Cadete')
      return { ...current, players: current.players.map((player) => player.id === 'player-1' ? { ...player, absentToday: markedToday, totalAbsences: markedToday ? player.totalAbsences + 1 : player.totalAbsences } : player) }
    })
    mocks.markAbsence.mockImplementation(async () => { markedToday = true; return {} })
    mocks.removeAbsence.mockResolvedValue(undefined)
  })

  it('shows daily cards sorted by jersey number and marks an absence', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Asistencia de hoy' })).toBeInTheDocument()
    const buttons = await screen.findAllByRole('button', { name: 'Marcar falta' })
    expect(buttons).toHaveLength(2)
    expect(screen.getByText('Luis García')).toBeInTheDocument()
    fireEvent.click(buttons[0]!)

    await waitFor(() => expect(mocks.markAbsence).toHaveBeenCalledWith('team-1', 'player-1', '2026-09-15'))
    expect(await screen.findByRole('status')).toHaveTextContent('Falta registrada')
    expect(await screen.findByRole('button', { name: 'Falta registrada' })).toBeInTheDocument()
    expect(screen.getAllByText('2 faltas históricas')).toHaveLength(2)
  })

  it('disables absence marking when the selected team has no training today', async () => {
    mocks.todayAttendance.mockResolvedValue(attendance('team-1', 'Cadete', false))
    renderPage()

    expect(await screen.findByText('Hoy no hay entrenamiento configurado para este equipo.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Marcar falta' })[0]).toBeDisabled()
    expect(mocks.markAbsence).not.toHaveBeenCalled()
  })
})

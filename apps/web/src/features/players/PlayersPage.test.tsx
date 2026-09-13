import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PropsWithChildren } from 'react'
import { PlayersPage } from './PlayersPage.js'

const mocks = vi.hoisted(() => ({ listTeams: vi.fn(), listPlayers: vi.fn(), createPlayer: vi.fn(), updatePlayerStatus: vi.fn() }))

vi.mock('@club-basket/api-client', () => ({ ApiClientError: class ApiClientError extends Error {}, createApiClient: () => mocks }))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: PropsWithChildren) { return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider> }
  return render(<PlayersPage />, { wrapper: Wrapper })
}

describe('PlayersPage', () => {
  afterEach(() => cleanup())
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listTeams.mockResolvedValue({ items: [{ id: 'team-1', name: 'Cadete', category: 'Cadete' }], total: 1, limit: 50, offset: 0 })
    mocks.listPlayers.mockResolvedValue({ items: [] })
    mocks.createPlayer.mockResolvedValue({ id: 'player-1' })
  })

  it('shows the player form after selecting a team', async () => {
    renderPage()
    await screen.findByRole('option', { name: /Cadete/ })
    const teamSelect = (await screen.findAllByRole('combobox'))[0]
    if (!teamSelect) throw new Error('No se encontró el selector de equipo')
    fireEvent.change(teamSelect, { target: { value: 'team-1' } })
    expect(await screen.findByRole('heading', { name: 'Nuevo jugador' })).toBeInTheDocument()
  })

  it('submits a new player with the selected team', async () => {
    renderPage()
    await screen.findByRole('option', { name: /Cadete/ })
    const teamSelect = (await screen.findAllByRole('combobox'))[0]
    if (!teamSelect) throw new Error('No se encontró el selector de equipo')
    fireEvent.change(teamSelect, { target: { value: 'team-1' } })
    await screen.findByRole('heading', { name: 'Nuevo jugador' })
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText('Apellidos'), { target: { value: 'Pérez' } })
    fireEvent.change(screen.getByLabelText('Fecha de nacimiento'), { target: { value: '2012-04-03' } })
    fireEvent.click(screen.getByRole('button', { name: 'Añadir jugador' }))
    await waitFor(() => expect(mocks.createPlayer).toHaveBeenCalledWith('team-1', { firstName: 'Ana', lastName: 'Pérez', birthDate: '2012-04-03', jerseyNumber: null }))
  })
})

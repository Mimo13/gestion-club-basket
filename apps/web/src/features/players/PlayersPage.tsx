import { Link, useParams } from 'react-router-dom'
import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiClientError, createApiClient } from '@club-basket/api-client'

const api = createApiClient(import.meta.env.VITE_API_URL ?? '')

export function PlayersPage() {
  const queryClient = useQueryClient()
  const { teamId: routeTeamId } = useParams()
  const [teamId, setTeamId] = useState(routeTeamId ?? '')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [jerseyNumber, setJerseyNumber] = useState('')
  const [error, setError] = useState<string | null>(null)
  const teamsQuery = useQuery({ queryKey: ['teams', 'players'], queryFn: () => api.listTeams({ status: 'active' }) })
  const playersQuery = useQuery({ queryKey: ['team', teamId, 'players', 'management'], queryFn: () => api.listPlayers(teamId, true), enabled: Boolean(teamId) })
  const createMutation = useMutation({
    mutationFn: () => api.createPlayer(teamId, { firstName, lastName, birthDate, jerseyNumber: jerseyNumber ? Number(jerseyNumber) : null }),
    onSuccess: () => { setFirstName(''); setLastName(''); setBirthDate(''); setJerseyNumber(''); setError(null); void queryClient.invalidateQueries({ queryKey: ['team', teamId, 'players'] }) },
  })
  const statusMutation = useMutation({
    mutationFn: ({ playerId, status }: { playerId: string; status: 'active' | 'inactive' }) => api.updatePlayerStatus(teamId, playerId, status),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['team', teamId, 'players'] }),
    onError: (cause) => setError(cause instanceof ApiClientError ? cause.message : 'No se pudo actualizar el jugador'),
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    createMutation.mutate(undefined, { onError: (cause) => setError(cause instanceof ApiClientError ? cause.message : 'No se pudo crear el jugador') })
  }

  return (
    <section className="page-content">
      <p className="eyebrow">Personas y plantillas</p><h1>Jugadores</h1>
      <div className="settings-form player-filters"><label>Equipo<select value={teamId} onChange={(event) => setTeamId(event.target.value)}><option value="">Selecciona un equipo</option>{teamsQuery.data?.items.map((team) => <option key={team.id} value={team.id}>{team.name} · {team.category}</option>)}</select></label></div>
      {teamId && <form className="settings-form category-form" onSubmit={submit}><h2>Nuevo jugador</h2><div className="form-grid-2"><label>Nombre<input value={firstName} onChange={(event) => setFirstName(event.target.value)} required /></label><label>Apellidos<input value={lastName} onChange={(event) => setLastName(event.target.value)} required /></label><label>Fecha de nacimiento<input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} required /></label><label>Dorsal<input type="number" min="0" max="99" value={jerseyNumber} onChange={(event) => setJerseyNumber(event.target.value)} /></label></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Guardando…' : 'Añadir jugador'}</button></form>}
      {teamsQuery.isLoading && <p className="status-message">Cargando equipos…</p>}
      {playersQuery.isLoading && <p className="status-message">Cargando jugadores…</p>}
      {playersQuery.isError && <p className="status-message error">No se han podido cargar los jugadores.</p>}
      {!teamId && <div className="empty-card"><span className="empty-icon">🏀</span><h2>Selecciona un equipo</h2><p>Elige un equipo para gestionar su plantilla.</p></div>}
      {teamId && playersQuery.data?.items.length === 0 && <div className="empty-card"><span className="empty-icon">👤</span><h2>Aún no hay jugadores</h2><p>Añade el primer jugador de este equipo.</p></div>}
      <div className="player-list">{playersQuery.data?.items.map((player) => <div className={`player-card ${player.status !== 'active' ? 'inactive-player' : ''}`} key={player.id}><Link className="player-card-main" to={`/players/${player.id}`}><div className="player-number">{player.jerseyNumber ?? '—'}</div><div className="player-info"><strong>{player.fullName}</strong><span>{player.birthDate} · {player.status === 'active' ? 'Activo' : 'Inactivo'}</span></div><span className="row-chevron">›</span></Link>{player.status === 'active' ? <button className="absence-button" type="button" onClick={() => statusMutation.mutate({ playerId: player.id, status: 'inactive' })}>Dar de baja</button> : <button className="secondary-button" type="button" onClick={() => statusMutation.mutate({ playerId: player.id, status: 'active' })}>Reactivar</button>}</div>)}</div>
    </section>
  )
}

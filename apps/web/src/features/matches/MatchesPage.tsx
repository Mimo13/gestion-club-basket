import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiClientError, createApiClient } from '@club-basket/api-client'
import { AttendanceHeatmap } from '../attendance/AttendanceHeatmap.js'

const api = createApiClient(import.meta.env.VITE_API_URL ?? '')

function displayDate(value: string): string { return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) }

export function MatchesPage() {
  const queryClient = useQueryClient()
  const [teamId, setTeamId] = useState('')
  const [selectedMatchId, setSelectedMatchId] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const teamsQuery = useQuery({ queryKey: ['teams', 'matches'], queryFn: () => api.listTeams({ status: 'active' }) })
  const calendarQuery = useQuery({ queryKey: ['dashboard', 'attendance', teamId], queryFn: () => api.attendanceCalendar(), enabled: Boolean(teamId) })
  const matchesQuery = useQuery({ queryKey: ['team', teamId, 'matches'], queryFn: () => api.listMatches(teamId), enabled: Boolean(teamId) })
  const rosterQuery = useQuery({ queryKey: ['team', teamId, 'match', selectedMatchId, 'roster'], queryFn: () => api.matchRoster(teamId, selectedMatchId), enabled: Boolean(teamId && selectedMatchId) })
  const updateMutation = useMutation({ mutationFn: ({ playerId, calledUp }: { playerId: string; calledUp: boolean }) => api.updateConvocation(teamId, selectedMatchId, playerId, calledUp), onSuccess: () => { setMessage('Convocatoria actualizada'); void queryClient.invalidateQueries({ queryKey: ['team', teamId, 'match', selectedMatchId, 'roster'] }) }, onError: (cause) => setMessage(cause instanceof ApiClientError ? cause.message : 'No se pudo guardar la convocatoria') })
  const selectedTeam = teamsQuery.data?.items.find((team) => team.id === teamId)
  const selectedCalendarTeam = calendarQuery.data?.teams.find((team) => team.teamId === teamId)

  return <section className="page-content">
    <p className="eyebrow">Competición</p><h1>Partidos</h1>
    <div className="settings-form team-selector-form"><label>Equipo<select value={teamId} onChange={(event) => { setTeamId(event.target.value); setSelectedMatchId(''); setMessage(null) }}><option value="">Selecciona un equipo</option>{teamsQuery.data?.items.map((team) => <option key={team.id} value={team.id}>{team.name} · {team.category}</option>)}</select></label></div>
    {!teamId && <div className="empty-card"><span className="empty-icon">🏀</span><h2>Selecciona un equipo</h2><p>Elige un equipo para consultar sus faltas y preparar una convocatoria.</p></div>}
    {teamId && selectedTeam && <><p className="page-intro">{selectedTeam.name}: faltas de los últimos 90 días y partidos disponibles para convocar.</p>{selectedCalendarTeam && calendarQuery.data && <AttendanceHeatmap team={selectedCalendarTeam} calendar={calendarQuery.data} />}<div className="detail-section"><h2>Partidos</h2>{matchesQuery.data?.items.length === 0 && <p className="empty-card">Todavía no hay partidos para este equipo.</p>}<div className="match-list">{matchesQuery.data?.items.map((match) => <button className={selectedMatchId === match.id ? 'match-row selected' : 'match-row'} key={match.id} type="button" onClick={() => setSelectedMatchId(match.id)}><span><strong>vs {match.opponentName}</strong><small>{displayDate(match.matchDate)}</small></span><span className="row-chevron">›</span></button>)}</div></div></>}
    {selectedMatchId && <article className="settings-form roster-card"><div className="section-heading"><div><p className="eyebrow">Convocatoria</p><h2>{matchesQuery.data?.items.find((match) => match.id === selectedMatchId)?.opponentName ?? 'Partido'}</h2></div><button className="text-button" type="button" onClick={() => setSelectedMatchId('')}>Cerrar</button></div>{message && <p className="form-notice" role="status">{message}</p>}{rosterQuery.isLoading && <p className="status-message">Cargando plantilla…</p>}<div className="roster-list">{rosterQuery.data?.players.map((player) => <button className={player.calledUp ? 'roster-row called' : 'roster-row'} key={player.id} type="button" aria-pressed={player.calledUp ?? false} onClick={() => updateMutation.mutate({ playerId: player.id, calledUp: !player.calledUp })}><span className="player-number">{player.jerseyNumber ?? '—'}</span><span className="player-info"><strong>{player.fullName}</strong><small>{player.calledUp ? 'Convocado' : 'No convocado'}</small></span><span className="roster-check">{player.calledUp ? '✓' : '+'}</span></button>)}</div></article>}
  </section>
}

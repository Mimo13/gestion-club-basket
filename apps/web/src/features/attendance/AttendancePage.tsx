import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiClientError, createApiClient } from '@club-basket/api-client'
import type { Player } from '@club-basket/contracts'

const api = createApiClient(import.meta.env.VITE_API_URL ?? '')

function today(): string { return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Europe/Madrid' }).format(new Date()) }
function displayDate(value: string): string { return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) }

export function AttendancePage() {
  const queryClient = useQueryClient()
  const trainingDate = today()
  const { teamId: routeTeamId } = useParams()
  const [selectedTeamId, setSelectedTeamId] = useState(routeTeamId ?? '')
  const [fromMatch, setFromMatch] = useState('')
  const [toMatch, setToMatch] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const teamsQuery = useQuery({ queryKey: ['teams', 'attendance'], queryFn: () => api.listTeams({ status: 'active' }) })
  const teamId = selectedTeamId
  const teams = teamsQuery.data?.items ?? []
  const selectedTeam = teams.find((team) => team.id === teamId)
  const playersQuery = useQuery({ queryKey: ['team', teamId, 'players'], queryFn: () => api.listPlayers(teamId), enabled: Boolean(teamId) })
  const todayAbsencesQuery = useQuery({ queryKey: ['team', teamId, 'attendance', 'today'], queryFn: () => api.todayAbsences(teamId), enabled: Boolean(teamId) })
  const matchesQuery = useQuery({ queryKey: ['team', teamId, 'matches'], queryFn: () => api.listMatches(teamId), enabled: Boolean(teamId) })
  const summaryQuery = useQuery({ queryKey: ['team', teamId, 'attendance', fromMatch, toMatch], queryFn: () => api.attendanceSummary(teamId, fromMatch || undefined, toMatch || undefined), enabled: Boolean(teamId) })
  const convocationMutation = useMutation({ mutationFn: ({ playerId, calledUp }: { playerId: string; calledUp: boolean }) => api.updateConvocation(teamId, toMatch, playerId, calledUp), onSuccess: () => { setMessage('Convocatoria actualizada'); void queryClient.invalidateQueries({ queryKey: ['team', teamId, 'attendance'] }) }, onError: () => setMessage('No se pudo guardar la convocatoria') })
  const absenceMutation = useMutation({
    mutationFn: async ({ playerId, absent }: { playerId: string; absent: boolean }) => { if (absent) await api.markAbsence(teamId, playerId, trainingDate); else await api.removeAbsence(teamId, playerId, trainingDate) },
    onSuccess: () => { setMessage('Asistencia actualizada'); void queryClient.invalidateQueries({ queryKey: ['team', teamId, 'attendance'] }) },
    onError: (cause) => setMessage(cause instanceof ApiClientError ? cause.message : 'No se pudo guardar la asistencia'),
  })

  useEffect(() => {
    if (!selectedTeamId && teamsQuery.data?.items[0]) setSelectedTeamId(teamsQuery.data.items[0].id)
  }, [selectedTeamId, teamsQuery.data])

  function selectTeam(nextTeamId: string) {
    setSelectedTeamId(nextTeamId)
    setFromMatch('')
    setToMatch('')
    setMessage(null)
  }

  function isAbsent(player: Player): boolean {
    if (trainingDate === today()) return todayAbsencesQuery.data?.absentPlayerIds.includes(player.id) ?? false
    return summaryQuery.data?.players.find((item) => item.id === player.id)?.absences.some((absence) => absence.trainingDate === trainingDate) ?? false
  }

  if (teamsQuery.isLoading) return <section className="page-content"><p className="status-message">Cargando equipos…</p></section>
  if (teamsQuery.isError) return <section className="page-content"><p className="status-message error">No se han podido cargar los equipos.</p></section>

  return (
    <section className="page-content">
      <p className="eyebrow">Operativa diaria</p>
      <h1>Asistencia</h1>
      <div className="settings-form attendance-toolbar">
        <label>Equipo<select value={teamId} onChange={(event) => selectTeam(event.target.value)}><option value="">Selecciona un equipo</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name} · {team.category}</option>)}</select></label>
        {selectedTeam && <p><strong>{selectedTeam.name} · Entrenamiento de hoy: {displayDate(trainingDate)}</strong></p>}
        <p className="helper-text">Pulsa «Ha faltado» para guardar la ausencia con la fecha del servidor. El botón es reversible.</p>
      </div>
      {!teamId && <div className="empty-card"><span className="empty-icon">👥</span><h2>Selecciona un equipo</h2><p>Elige un equipo activo para consultar su plantilla y registrar asistencia.</p></div>}
      {message && teamId && <p className="form-notice" role="status">{message}</p>}
      {teamId && playersQuery.isLoading && <p className="status-message">Cargando jugadores…</p>}
      {teamId && playersQuery.isError && <p className="status-message error">No se han podido cargar los jugadores.</p>}
      {teamId && playersQuery.data?.items.length === 0 && <div className="empty-card"><span className="empty-icon">🏀</span><h2>Aún no hay jugadores</h2><p>Añade jugadores a este equipo para comenzar a registrar asistencia.</p></div>}
      {teamId && <div className="player-list">
        {playersQuery.data?.items.map((player) => {
          const absent = isAbsent(player)
          return <article className={`player-card ${absent ? 'absent' : ''}`} key={player.id}>
            <div className="player-number">{player.jerseyNumber ?? '—'}</div>
            <div className="player-info"><strong>{player.fullName}</strong><span>Nacido en {player.birthYear} · {displayDate(player.birthDate)}</span></div>
            <button className={absent ? 'absence-button marked' : 'absence-button'} type="button" aria-pressed={absent} disabled={absenceMutation.isPending} onClick={() => absenceMutation.mutate({ playerId: player.id, absent: !absent })}>{absent ? 'Falta guardada' : 'Ha faltado'}</button>
          </article>
        })}
      </div>}
      {teamId && <div className="attendance-summary">
        <p className="eyebrow">Vista para convocatoria</p><h2>Faltas entre partidos</h2>
        <div className="match-selectors"><label>Partido inicial<select value={fromMatch} onChange={(event) => setFromMatch(event.target.value)}><option value="">Primer partido</option>{matchesQuery.data?.items.map((match) => <option key={match.id} value={match.id}>{displayDate(match.matchDate)} · vs {match.opponentName}</option>)}</select></label><label>Partido siguiente<select value={toMatch} onChange={(event) => setToMatch(event.target.value)}><option value="">Siguiente partido</option>{matchesQuery.data?.items.map((match) => <option key={match.id} value={match.id}>{displayDate(match.matchDate)} · vs {match.opponentName}</option>)}</select></label></div>
        {summaryQuery.data?.fromDate && summaryQuery.data.toDate && <p className="helper-text">Se cuentan entrenamientos posteriores al {displayDate(summaryQuery.data.fromDate)} y anteriores al {displayDate(summaryQuery.data.toDate)}.</p>}
        <div className="convocation-list">{summaryQuery.data?.players.map((player) => <div className="convocation-row" key={player.id}><span>{player.fullName}</span><strong>{player.absenceCount} {player.absenceCount === 1 ? 'falta' : 'faltas'}</strong>{player.calledUp !== null && toMatch && <button className={player.calledUp ? 'callup yes' : 'callup'} type="button" aria-pressed={player.calledUp} disabled={convocationMutation.isPending} onClick={() => convocationMutation.mutate({ playerId: player.id, calledUp: !player.calledUp })}>{player.calledUp ? 'Convocado' : 'No convocado'}</button>}</div>)}</div>
      </div>}
    </section>
  )
}

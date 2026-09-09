import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiClientError, createApiClient } from '@club-basket/api-client'
import type { Player } from '@club-basket/contracts'

const api = createApiClient(import.meta.env.VITE_API_URL ?? 'http://localhost:3000')
const CADETE_TEAM_ID = '00000000-0000-0000-0000-000000000003'

function today(): string { return new Date().toISOString().slice(0, 10) }
function displayDate(value: string): string { return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) }

export function AttendancePage() {
  const queryClient = useQueryClient()
  const trainingDate = today()
  const [fromMatch, setFromMatch] = useState('')
  const [toMatch, setToMatch] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const playersQuery = useQuery({ queryKey: ['team', CADETE_TEAM_ID, 'players'], queryFn: () => api.listPlayers(CADETE_TEAM_ID) })
  const todayAbsencesQuery = useQuery({ queryKey: ['team', CADETE_TEAM_ID, 'attendance', 'today'], queryFn: () => api.todayAbsences(CADETE_TEAM_ID), enabled: trainingDate === today() })
  const matchesQuery = useQuery({ queryKey: ['team', CADETE_TEAM_ID, 'matches'], queryFn: () => api.listMatches(CADETE_TEAM_ID) })
  const summaryQuery = useQuery({ queryKey: ['team', CADETE_TEAM_ID, 'attendance', fromMatch, toMatch], queryFn: () => api.attendanceSummary(CADETE_TEAM_ID, fromMatch || undefined, toMatch || undefined) })
  const convocationMutation = useMutation({ mutationFn: ({ playerId, calledUp }: { playerId: string; calledUp: boolean }) => api.updateConvocation(CADETE_TEAM_ID, toMatch, playerId, calledUp), onSuccess: () => { setMessage('Convocatoria actualizada'); void queryClient.invalidateQueries({ queryKey: ['team', CADETE_TEAM_ID, 'attendance'] }) }, onError: () => setMessage('No se pudo guardar la convocatoria') })
  const absenceMutation = useMutation({
    mutationFn: async ({ playerId, absent }: { playerId: string; absent: boolean }) => { if (absent) await api.markAbsence(CADETE_TEAM_ID, playerId, trainingDate); else await api.removeAbsence(CADETE_TEAM_ID, playerId, trainingDate) },
    onSuccess: () => { setMessage('Asistencia actualizada'); void queryClient.invalidateQueries({ queryKey: ['team', CADETE_TEAM_ID, 'attendance'] }); void queryClient.invalidateQueries({ queryKey: ['team', CADETE_TEAM_ID, 'players'] }) },
    onError: (cause) => setMessage(cause instanceof ApiClientError ? cause.message : 'No se pudo guardar la asistencia'),
  })

  function isAbsent(player: Player): boolean {
    if (trainingDate === today()) return todayAbsencesQuery.data?.absentPlayerIds.includes(player.id) ?? false
    return summaryQuery.data?.players.find((item) => item.id === player.id)?.absences.some((absence) => absence.trainingDate === trainingDate) ?? false
  }

  return (
    <section className="page-content">
      <p className="eyebrow">Cadete masculino · 2026/2027</p>
      <h1>Asistencia</h1>
      <div className="settings-form attendance-toolbar">
        <p><strong>Entrenamiento de hoy: {displayDate(trainingDate)}</strong></p>
        <p className="helper-text">Pulsa «Ha faltado» para guardar la ausencia con la fecha del servidor. El botón es reversible.</p>
      </div>
      {message && <p className="form-notice" role="status">{message}</p>}
      {playersQuery.isLoading && <p className="status-message">Cargando jugadores…</p>}
      <div className="player-list">
        {playersQuery.data?.items.map((player) => {
          const absent = isAbsent(player)
          return <article className={`player-card ${absent ? 'absent' : ''}`} key={player.id}>
            <div className="player-number">{player.jerseyNumber ?? '—'}</div>
            <div className="player-info"><strong>{player.fullName}</strong><span>Nacido en {player.birthYear} · {displayDate(player.birthDate)}</span></div>
            <button className={absent ? 'absence-button marked' : 'absence-button'} type="button" aria-pressed={absent} onClick={() => absenceMutation.mutate({ playerId: player.id, absent: !absent })}>{absent ? 'Falta guardada' : 'Ha faltado'}</button>
          </article>
        })}
      </div>
      <div className="attendance-summary">
        <p className="eyebrow">Vista para convocatoria</p><h2>Faltas entre partidos</h2>
        <div className="match-selectors"><label>Partido inicial<select value={fromMatch} onChange={(event) => setFromMatch(event.target.value)}><option value="">Primer partido</option>{matchesQuery.data?.items.map((match) => <option key={match.id} value={match.id}>{displayDate(match.matchDate)} · vs {match.opponentName}</option>)}</select></label><label>Partido siguiente<select value={toMatch} onChange={(event) => setToMatch(event.target.value)}><option value="">Siguiente partido</option>{matchesQuery.data?.items.map((match) => <option key={match.id} value={match.id}>{displayDate(match.matchDate)} · vs {match.opponentName}</option>)}</select></label></div>
        {summaryQuery.data?.fromDate && summaryQuery.data.toDate && <p className="helper-text">Se cuentan entrenamientos posteriores al {displayDate(summaryQuery.data.fromDate)} y anteriores al {displayDate(summaryQuery.data.toDate)}.</p>}
        <div className="convocation-list">{summaryQuery.data?.players.map((player) => <div className="convocation-row" key={player.id}><span>{player.fullName}</span><strong>{player.absenceCount} {player.absenceCount === 1 ? 'falta' : 'faltas'}</strong>{player.calledUp !== null && toMatch && <button className={player.calledUp ? 'callup yes' : 'callup'} type="button" aria-pressed={player.calledUp} onClick={() => convocationMutation.mutate({ playerId: player.id, calledUp: !player.calledUp })}>{player.calledUp ? 'Convocado' : 'No convocado'}</button>}</div>)}</div>
      </div>
    </section>
  )
}

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ApiClientError, createApiClient } from '@club-basket/api-client'
import { useAuth } from '../auth/AuthProvider.js'
import { AttendanceHeatmap } from '../attendance/AttendanceHeatmap.js'

const api = createApiClient(import.meta.env.VITE_API_URL ?? '')
const ABSENCE_ROLES = ['club_admin', 'coordinator', 'coach', 'assistant']

function displayDate(value: string): string { return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) }

export function PlayerDetailPage() {
  const { playerId = '' } = useParams()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null)
  const [absenceMessage, setAbsenceMessage] = useState<string | null>(null)
  const detailQuery = useQuery({ queryKey: ['player', playerId, 'detail'], queryFn: () => api.playerDetail(playerId), enabled: Boolean(playerId) })
  const calendarQuery = useQuery({ queryKey: ['player', playerId, 'attendance'], queryFn: async () => {
    const calendar = await api.attendanceCalendar()
    return { ...calendar, teams: calendar.teams.map((team) => ({ ...team, players: team.players.filter((player) => player.playerId === playerId) })).filter((team) => team.players.length > 0) }
  }, enabled: Boolean(playerId) })
  const removeAbsenceMutation = useMutation({
    mutationFn: (trainingDate: string) => {
      const teamId = detailQuery.data?.team?.id
      if (!teamId) throw new ApiClientError(400, 'TEAM_REQUIRED', 'El jugador no tiene un equipo asignado')
      return api.removeAbsence(teamId, playerId, trainingDate)
    },
    onSuccess: () => { setPendingRemoval(null); setAbsenceMessage('Falta eliminada') },
    onError: (cause) => setAbsenceMessage(cause instanceof ApiClientError ? cause.message : 'No se ha podido quitar la falta'),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['player', playerId] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['team'] })
    },
  })

  if (detailQuery.isLoading) return <section className="page-content"><p className="status-message">Cargando jugador…</p></section>
  if (detailQuery.isError || !detailQuery.data) return <section className="page-content"><p className="status-message error">No se ha podido cargar el jugador.</p><Link className="secondary-button" to="/players">Volver a jugadores</Link></section>
  const { player, team, absences } = detailQuery.data
  const canRemoveAbsence = Boolean(team) && (user?.roles.some((role) => ABSENCE_ROLES.includes(role)) ?? false)
  return <section className="page-content">
    <Link className="back-link" to={team ? `/teams/${team.id}` : '/players'}>← {team?.name ?? 'Jugadores'}</Link>
    <p className="eyebrow">Ficha de jugador</p><h1>{player.fullName}</h1>
    <div className="detail-grid">
      <article className="settings-form detail-card"><p className="eyebrow">Datos deportivos</p><dl className="data-list"><div><dt>Equipo</dt><dd>{team?.name ?? 'Sin equipo'}</dd></div><div><dt>Dorsal</dt><dd>{player.jerseyNumber ?? '—'}</dd></div><div><dt>Estado</dt><dd>{player.status === 'active' ? 'Activo' : 'Inactivo'}</dd></div></dl></article>
      <article className="settings-form detail-card">
        <p className="eyebrow">Asistencia</p>
        <h2>{absences.length} {absences.length === 1 ? 'falta registrada' : 'faltas registradas'}</h2>
        {absences.length === 0 && <p className="helper-text">Este jugador no tiene faltas registradas.</p>}
        {absences.length > 0 && <ul className="absence-list">
          {absences.map((absence) => <li className="absence-row" key={`${absence.playerId}-${absence.trainingDate}`}>
            <span className="absence-date">{displayDate(absence.trainingDate)}</span>
            {canRemoveAbsence && <button className="absence-remove-button" type="button" disabled={removeAbsenceMutation.isPending} aria-label={`Quitar la falta del ${displayDate(absence.trainingDate)}`} onClick={() => { setAbsenceMessage(null); setPendingRemoval(absence.trainingDate) }}>Quitar</button>}
          </li>)}
        </ul>}
        {canRemoveAbsence && absences.length > 0 && <p className="helper-text">Puedes quitar una falta si se registró por error.</p>}
        {absenceMessage && <p className="form-notice" role="status">{absenceMessage}</p>}
      </article>
    </div>
    {calendarQuery.data?.teams[0] && <div className="detail-section"><h2>Últimos 90 días</h2><AttendanceHeatmap team={calendarQuery.data.teams[0]} calendar={calendarQuery.data} /></div>}
    {pendingRemoval && <div className="attendance-modal-backdrop" role="presentation" onClick={() => setPendingRemoval(null)}>
      <section className="attendance-modal" role="dialog" aria-modal="true" aria-labelledby="remove-absence-title" onClick={(event) => event.stopPropagation()}>
        <p className="eyebrow">Asistencia</p>
        <h2 id="remove-absence-title">Quitar la falta</h2>
        <p>¿Quieres quitar la falta del {displayDate(pendingRemoval)} de {player.fullName}?</p>
        <div className="attendance-modal-actions">
          <button className="secondary-button" type="button" onClick={() => setPendingRemoval(null)}>Cancelar</button>
          <button className="primary-button" type="button" disabled={removeAbsenceMutation.isPending} onClick={() => removeAbsenceMutation.mutate(pendingRemoval)}>{removeAbsenceMutation.isPending ? 'Quitando…' : 'Quitar falta'}</button>
        </div>
      </section>
    </div>}
  </section>
}

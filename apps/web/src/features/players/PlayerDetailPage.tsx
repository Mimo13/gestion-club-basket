import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { createApiClient } from '@club-basket/api-client'
import { AttendanceHeatmap } from '../attendance/AttendanceHeatmap.js'

const api = createApiClient(import.meta.env.VITE_API_URL ?? '')

function displayDate(value: string): string { return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) }

export function PlayerDetailPage() {
  const { playerId = '' } = useParams()
  const detailQuery = useQuery({ queryKey: ['player', playerId, 'detail'], queryFn: () => api.playerDetail(playerId), enabled: Boolean(playerId) })
  const calendarQuery = useQuery({ queryKey: ['player', playerId, 'attendance'], queryFn: async () => {
    const calendar = await api.attendanceCalendar()
    return { ...calendar, teams: calendar.teams.map((team) => ({ ...team, players: team.players.filter((player) => player.playerId === playerId) })).filter((team) => team.players.length > 0) }
  }, enabled: Boolean(playerId) })

  if (detailQuery.isLoading) return <section className="page-content"><p className="status-message">Cargando jugador…</p></section>
  if (detailQuery.isError || !detailQuery.data) return <section className="page-content"><p className="status-message error">No se ha podido cargar el jugador.</p><Link className="secondary-button" to="/players">Volver a jugadores</Link></section>
  const { player, team, absences } = detailQuery.data
  return <section className="page-content">
    <Link className="back-link" to={team ? `/teams/${team.id}` : '/players'}>← {team?.name ?? 'Jugadores'}</Link>
    <p className="eyebrow">Ficha de jugador</p><h1>{player.fullName}</h1>
    <div className="detail-grid">
      <article className="settings-form detail-card"><p className="eyebrow">Datos deportivos</p><dl className="data-list"><div><dt>Equipo</dt><dd>{team?.name ?? 'Sin equipo'}</dd></div><div><dt>Dorsal</dt><dd>{player.jerseyNumber ?? '—'}</dd></div><div><dt>Estado</dt><dd>{player.status === 'active' ? 'Activo' : 'Inactivo'}</dd></div></dl></article>
      <article className="settings-form detail-card"><p className="eyebrow">Asistencia</p><h2>{absences.length} {absences.length === 1 ? 'falta registrada' : 'faltas registradas'}</h2>{absences.slice(0, 5).map((absence) => <p className="detail-line" key={`${absence.playerId}-${absence.trainingDate}`}>{displayDate(absence.trainingDate)}</p>)}</article>
    </div>
    {calendarQuery.data?.teams[0] && <div className="detail-section"><h2>Últimos 90 días</h2><AttendanceHeatmap team={calendarQuery.data.teams[0]} calendar={calendarQuery.data} /></div>}
  </section>
}

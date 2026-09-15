import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { createApiClient } from '@club-basket/api-client'

const api = createApiClient(import.meta.env.VITE_API_URL ?? '')

export function TeamDetailPage() {
  const { teamId = '' } = useParams()
  const query = useQuery({ queryKey: ['team', teamId, 'detail'], queryFn: () => api.teamDetail(teamId), enabled: Boolean(teamId) })

  if (query.isLoading) return <section className="page-content"><p className="status-message">Cargando equipo…</p></section>
  if (query.isError || !query.data) return <section className="page-content"><p className="status-message error">No se ha podido cargar el equipo.</p><Link className="secondary-button" to="/teams">Volver a equipos</Link></section>
  const { team, players, coaches } = query.data
  return <section className="page-content">
    <Link className="back-link" to="/teams">← Equipos</Link>
    <p className="eyebrow">Detalle del equipo</p><h1>{team.name}</h1>
    <p className="page-intro">{team.category} · {team.gender === 'unspecified' ? 'Sin género indicado' : team.gender} · {team.status === 'active' ? 'Activo' : team.status}</p>
    <div className="detail-grid">
      <article className="settings-form detail-card"><p className="eyebrow">Cuerpo técnico</p><h2>{coaches.length} {coaches.length === 1 ? 'entrenador' : 'entrenadores'}</h2>{coaches.length > 0 ? <ul className="simple-list">{coaches.map((coach) => <li key={coach.id}>{coach.displayName}<span>{coach.email}</span></li>)}</ul> : <p className="helper-text">Todavía no hay entrenadores asignados.</p>}</article>
      <article className="settings-form detail-card"><p className="eyebrow">Plantilla</p><h2>{players.length} jugadores</h2><p className="helper-text">Pulsa un jugador para consultar sus datos y faltas.</p></article>
    </div>
    <div className="detail-section"><div className="section-heading"><h2>Operativa del equipo</h2></div><div className="team-action-links"><Link className="secondary-button" to={`/teams/${team.id}/players`}>Jugadores</Link><Link className="secondary-button" to={`/teams/${team.id}/attendance`}>Asistencia</Link><Link className="secondary-button" to={`/settings/training-schedules?team=${team.id}`}>Horarios</Link></div></div>
    <div className="detail-section"><div className="section-heading"><h2>Jugadores</h2><Link className="secondary-button" to={`/teams/${team.id}/players`}>Gestionar plantilla</Link></div><div className="player-list">{players.map((player) => <Link className="player-card player-card-link" key={player.id} to={`/players/${player.id}`}><div className="player-number">{player.jerseyNumber ?? '—'}</div><div className="player-info"><strong>{player.fullName}</strong><span>{player.birthDate} · {player.status === 'active' ? 'Activo' : 'Inactivo'}</span></div><span className="row-chevron">›</span></Link>)}</div></div>
  </section>
}

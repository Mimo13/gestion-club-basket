import { useQuery } from '@tanstack/react-query'
import { createApiClient } from '@club-basket/api-client'

const api = createApiClient(import.meta.env.VITE_API_URL ?? 'http://localhost:3000')

export function TeamsPage() {
  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: () => api.listTeams() })

  return (
    <section className="page-content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Estructura del club</p>
          <h1>Equipos</h1>
        </div>
        <button className="primary-button" type="button">Nuevo equipo</button>
      </div>

      {teamsQuery.isLoading && <p className="status-message">Cargando equipos…</p>}
      {teamsQuery.isError && <p className="status-message error">No se han podido cargar los equipos.</p>}
      {teamsQuery.data?.items.length === 0 && (
        <div className="empty-card">
          <span className="empty-icon">👥</span>
          <h2>Aún no hay equipos</h2>
          <p>Crea el primer equipo para comenzar a organizar la temporada.</p>
        </div>
      )}
      <div className="card-list">
        {teamsQuery.data?.items.map((team) => (
          <article className="team-card" key={team.id}>
            <div className="team-badge">{team.name.slice(0, 2).toUpperCase()}</div>
            <div>
              <h2>{team.name}</h2>
              <p>{team.category} · {team.gender === 'unspecified' ? 'Sin género indicado' : team.gender}</p>
            </div>
            <span className="team-status">{team.status === 'active' ? 'Activo' : team.status}</span>
          </article>
        ))}
      </div>
    </section>
  )
}

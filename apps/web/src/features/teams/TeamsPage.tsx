import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiClientError, createApiClient } from '@club-basket/api-client'

const api = createApiClient(import.meta.env.VITE_API_URL ?? 'http://localhost:3000')

export function TeamsPage() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [gender, setGender] = useState<'male' | 'female' | 'mixed' | 'unspecified'>('unspecified')
  const [error, setError] = useState<string | null>(null)
  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: () => api.listTeams() })
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: () => api.listCategories() })
  const seasonQuery = useQuery({ queryKey: ['seasons', 'current'], queryFn: () => api.currentSeason() })
  const createMutation = useMutation({
    mutationFn: () => api.createTeam({ name, categoryId, gender, seasonId: seasonQuery.data?.id ?? '' }),
    onSuccess: () => { setName(''); setCategoryId(''); setGender('unspecified'); setShowForm(false); void queryClient.invalidateQueries({ queryKey: ['teams'] }) },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    createMutation.mutate(undefined, { onError: (cause) => setError(cause instanceof ApiClientError ? cause.message : 'No se pudo crear el equipo') })
  }

  return (
    <section className="page-content">
      <div className="page-heading">
        <div><p className="eyebrow">Estructura del club</p><h1>Equipos</h1></div>
        <button className="primary-button" type="button" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancelar' : 'Nuevo equipo'}</button>
      </div>
      {showForm && <form className="settings-form category-form" onSubmit={submit}>
        <h2>Nuevo equipo</h2>
        <label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Cadete Masculino" required /></label>
        <label>Categoría<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required><option value="">Selecciona una categoría</option>{categoriesQuery.data?.items.map((item) => <option key={item.id} value={item.id}>{item.name}{item.birthYearLabel ? ` · ${item.birthYearLabel}` : ''}</option>)}</select></label>
        <label>Género<select value={gender} onChange={(event) => setGender(event.target.value as typeof gender)}><option value="unspecified">Sin especificar</option><option value="male">Masculino</option><option value="female">Femenino</option><option value="mixed">Mixto</option></select></label>
        {!seasonQuery.data && <p className="form-error">No hay una temporada configurada.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" type="submit" disabled={createMutation.isPending || !seasonQuery.data}>{createMutation.isPending ? 'Creando…' : 'Crear equipo'}</button>
      </form>}
      {teamsQuery.isLoading && <p className="status-message">Cargando equipos…</p>}
      {teamsQuery.isError && <p className="status-message error">No se han podido cargar los equipos.</p>}
      {teamsQuery.data?.items.length === 0 && <div className="empty-card"><span className="empty-icon">👥</span><h2>Aún no hay equipos</h2><p>Crea el primer equipo para comenzar a organizar la temporada.</p></div>}
      <div className="card-list">{teamsQuery.data?.items.map((team) => <article className="team-card" key={team.id}><div className="team-badge">{team.name.slice(0, 2).toUpperCase()}</div><div><h2>{team.name}</h2><p>{team.category} · {team.gender === 'unspecified' ? 'Sin género indicado' : team.gender}</p></div><span className="team-status">{team.status === 'active' ? 'Activo' : team.status}</span></article>)}</div>
    </section>
  )
}

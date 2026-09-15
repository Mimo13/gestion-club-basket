import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiClientError, createApiClient } from '@club-basket/api-client'
import type { Activity, CreateActivityInput } from '@club-basket/contracts'

const api = createApiClient(import.meta.env.VITE_API_URL ?? '')
const phaseLabels = { preliminary: 'Previa de acceso', regular_league: 'Liga regular', playoffs: 'Playoffs', cup: 'Copa', friendly: 'Amistoso', tournament: 'Otro torneo', other: 'Otra competición' } as const

type MatchForm = { teamId: string; startsAt: string; opponentName: string; isHome: boolean; competition: string; phase: keyof typeof phaseLabels; leagueTier: 'bronze' | 'silver' | 'gold' | '' }
function dateTimeInput(value: string): string { const date = new Date(value); const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 16) }
function emptyForm(teamId = ''): MatchForm { return { teamId, startsAt: dateTimeInput(new Date(Date.now() + 86400000).toISOString()), opponentName: '', isHome: true, competition: '', phase: 'regular_league', leagueTier: '' } }
function formFromActivity(activity: Activity): MatchForm { return { teamId: activity.teamId, startsAt: dateTimeInput(activity.startsAt), opponentName: activity.opponentName ?? '', isHome: activity.isHome ?? true, competition: activity.competition ?? '', phase: activity.matchPhase ?? 'regular_league', leagueTier: activity.leagueTier ?? '' } }
function displayDate(value: string): string { return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }

export function MatchDatesPage() {
  const queryClient = useQueryClient()
  const [teamId, setTeamId] = useState('')
  const [form, setForm] = useState<MatchForm | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const teamsQuery = useQuery({ queryKey: ['teams', 'match-dates'], queryFn: () => api.listTeams({ status: 'active' }) })
  const activitiesQuery = useQuery({ queryKey: ['match-dates', teamId], queryFn: () => api.listActivities({ teamId: teamId || undefined, limit: 100 }), enabled: Boolean(teamId) })
  const saveMutation = useMutation({
    mutationFn: () => {
      if (!form) throw new Error('Formulario vacío')
      const input: CreateActivityInput = { type: 'match', teamId: form.teamId, startsAt: new Date(form.startsAt).toISOString(), endsAt: null, venueName: null, notes: null, opponentName: form.opponentName, isHome: form.isHome, competition: form.competition || null, phase: form.phase, leagueTier: form.leagueTier || null }
      return editingId ? api.updateActivity(editingId, input) : api.createActivity(input)
    },
    onSuccess: () => { setForm(null); setEditingId(null); setError(null); void queryClient.invalidateQueries({ queryKey: ['match-dates'] }); void queryClient.invalidateQueries({ queryKey: ['activities'] }) },
    onError: (cause) => setError(cause instanceof ApiClientError ? cause.message : 'No se pudo guardar el partido'),
  })
  const matches = activitiesQuery.data?.items.filter((activity) => activity.type === 'match') ?? []

  function selectTeam(next: string) { setTeamId(next); setForm(null); setEditingId(null); setError(null) }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(null); saveMutation.mutate() }

  return <section className="page-content">
    <div className="page-heading"><div><p className="eyebrow">Configuración de competición</p><h1>Fechas de partidos</h1></div><button className="primary-button" type="button" onClick={() => { setEditingId(null); setForm(emptyForm(teamId)); setError(null) }} disabled={!teamId}>Nuevo partido</button></div>
    <p className="page-intro">Programa partidos, cambia fechas si se solicita un cambio y organiza la temporada por fases.</p>
    <div className="settings-form team-selector-form"><label>Equipo<select value={teamId} onChange={(event) => selectTeam(event.target.value)}><option value="">Selecciona un equipo</option>{teamsQuery.data?.items.map((team) => <option key={team.id} value={team.id}>{team.name} · {team.category}</option>)}</select></label></div>
    <div className="phase-guide"><div><strong>Previa</strong><span>Decide acceso a Bronce, Plata u Oro.</span></div><div><strong>Liga regular</strong><span>Partidos de la competición asignada.</span></div><div><strong>Playoffs</strong><span>Fase final si el equipo se clasifica.</span></div><div><strong>Opcionales</strong><span>Copa, amistosos y otros torneos.</span></div></div>
    {!teamId && <div className="empty-card"><h2>Selecciona un equipo</h2><p>Elige un equipo para consultar y modificar sus fechas.</p></div>}
    {form && <form className="settings-form activity-form" onSubmit={submit}><div className="form-heading"><h2>{editingId ? 'Modificar partido' : 'Nuevo partido'}</h2><button className="text-button" type="button" onClick={() => setForm(null)}>Cerrar</button></div><label>Equipo<select value={form.teamId} onChange={(event) => setForm({ ...form, teamId: event.target.value })} required>{teamsQuery.data?.items.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><div className="form-grid-2"><label>Fecha y hora<input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} required /></label><label>Rival<input value={form.opponentName} onChange={(event) => setForm({ ...form, opponentName: event.target.value })} required /></label></div><label>Fase<select value={form.phase} onChange={(event) => setForm({ ...form, phase: event.target.value as MatchForm['phase'] })}>{Object.entries(phaseLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>{form.phase === 'preliminary' || form.phase === 'regular_league' ? <label>Nivel de liga<select value={form.leagueTier} onChange={(event) => setForm({ ...form, leagueTier: event.target.value as MatchForm['leagueTier'] })}><option value="">Sin decidir</option><option value="bronze">Bronce</option><option value="silver">Plata</option><option value="gold">Oro</option></select></label> : <p className="helper-text">El nivel de liga sólo se aplica a la previa y a la liga regular.</p>}<label>Competición<input value={form.competition} onChange={(event) => setForm({ ...form, competition: event.target.value })} placeholder="Ej. Liga Provincial" /></label><label className="checkbox-label"><input type="checkbox" checked={form.isHome} onChange={(event) => setForm({ ...form, isHome: event.target.checked })} /> Partido en casa</label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Guardando…' : 'Guardar partido'}</button></form>}
    {teamId && activitiesQuery.isLoading && <p className="status-message">Cargando fechas…</p>}
    {teamId && matches.length === 0 && !activitiesQuery.isLoading && <div className="empty-card"><h2>No hay partidos programados</h2><p>Añade el primero para comenzar a organizar la competición.</p></div>}
    <div className="match-date-list">{matches.map((match) => <article className="match-date-card" key={match.id}><div><span className="activity-type">{match.matchPhase ? phaseLabels[match.matchPhase] : 'Liga regular'}{match.leagueTier ? ` · ${match.leagueTier === 'bronze' ? 'Bronce' : match.leagueTier === 'silver' ? 'Plata' : 'Oro'}` : ''}</span><h2>vs {match.opponentName}</h2><p>{displayDate(match.startsAt)} · {match.isHome ? 'Local' : 'Visitante'}</p>{match.competition && <small>{match.competition}</small>}</div><button className="secondary-button" type="button" onClick={() => { setEditingId(match.id); setForm(formFromActivity(match)); setError(null) }}>Cambiar fecha</button></article>)}</div>
  </section>
}

export { phaseLabels }

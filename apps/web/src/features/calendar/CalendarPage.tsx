import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiClientError, createApiClient } from '@club-basket/api-client'
import type { Activity, CreateActivityInput, UpdateActivityInput } from '@club-basket/contracts'
import { useAuth } from '../auth/AuthProvider.js'
import { dateInputValue, getCalendarRange, groupActivitiesByDate, type CalendarView } from './calendar-utils.js'

const api = createApiClient(import.meta.env.VITE_API_URL ?? 'http://localhost:3000')

type CalendarFilter = 'all' | string
type ActivityForm = { type: 'training' | 'match'; teamId: string; startsAt: string; endsAt: string; venueName: string; notes: string; opponentName: string; isHome: boolean; competition: string }

function dateTimeInputValue(value: string): string {
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function toIso(value: string): string { return new Date(value).toISOString() }
function displayDateTime(value: string): string { return new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
function displayDate(value: string): string { return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) }

function emptyForm(teamId = ''): ActivityForm {
  const start = new Date()
  start.setMinutes(Math.ceil(start.getMinutes() / 30) * 30, 0, 0)
  const end = new Date(start.getTime() + 90 * 60_000)
  return { type: 'training', teamId, startsAt: dateTimeInputValue(start.toISOString()), endsAt: dateTimeInputValue(end.toISOString()), venueName: '', notes: '', opponentName: '', isHome: true, competition: '' }
}

function formFromActivity(activity: Activity): ActivityForm {
  return { type: activity.type, teamId: activity.teamId, startsAt: dateTimeInputValue(activity.startsAt), endsAt: activity.endsAt ? dateTimeInputValue(activity.endsAt) : '', venueName: activity.venueName ?? '', notes: activity.notes ?? '', opponentName: activity.opponentName ?? '', isHome: activity.isHome ?? true, competition: activity.competition ?? '' }
}

function toInput(form: ActivityForm): CreateActivityInput {
  const base = { teamId: form.teamId, startsAt: toIso(form.startsAt), endsAt: form.endsAt ? toIso(form.endsAt) : null, venueName: form.venueName || null, notes: form.notes || null }
  return form.type === 'match' ? { ...base, type: 'match', opponentName: form.opponentName, isHome: form.isHome, competition: form.competition || null } : { ...base, type: 'training' }
}

export function CalendarPage() {
  const { user } = useAuth()
  const canManage = user?.role === 'club_admin' || user?.role === 'coordinator' || user?.role === 'coach'
  const queryClient = useQueryClient()
  const today = dateInputValue(new Date())
  const [selectedTeamId, setSelectedTeamId] = useState<CalendarFilter>('all')
  const [selectedSeasonId, setSelectedSeasonId] = useState('all')
  const [calendarView, setCalendarView] = useState<CalendarView>('week')
  const [anchorDate, setAnchorDate] = useState(today)
  const calendarRange = getCalendarRange(calendarView, anchorDate)
  const [form, setForm] = useState<ActivityForm | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const teamsQuery = useQuery({ queryKey: ['teams', 'calendar', selectedSeasonId], queryFn: () => api.listTeams({ status: 'active', seasonId: selectedSeasonId === 'all' ? undefined : selectedSeasonId }) })
  const seasonsQuery = useQuery({ queryKey: ['seasons'], queryFn: () => api.listSeasons() })
  const activitiesQuery = useQuery({ queryKey: ['activities', selectedTeamId, selectedSeasonId, calendarView, calendarRange.fromDate, calendarRange.toDate], queryFn: () => api.listActivities({ teamId: selectedTeamId === 'all' ? undefined : selectedTeamId, seasonId: selectedSeasonId === 'all' ? undefined : selectedSeasonId, fromDate: calendarRange.fromDate, toDate: calendarRange.toDate, limit: 100 }) })
  const activityGroups = groupActivitiesByDate(activitiesQuery.data?.items ?? [])
  const saveMutation = useMutation({
    mutationFn: (input: CreateActivityInput | UpdateActivityInput) => editingId ? api.updateActivity(editingId, input as UpdateActivityInput) : api.createActivity(input as CreateActivityInput),
    onSuccess: () => { setForm(null); setEditingId(null); setError(null); void queryClient.invalidateQueries({ queryKey: ['activities'] }) },
    onError: (cause) => setError(cause instanceof ApiClientError ? cause.message : 'No se pudo guardar la actividad'),
  })
  const cancelMutation = useMutation({
    mutationFn: (activity: Activity) => api.updateActivity(activity.id, { ...toInput(formFromActivity(activity)), status: 'cancelled' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['activities'] }),
    onError: (cause) => setError(cause instanceof ApiClientError ? cause.message : 'No se pudo cancelar la actividad'),
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form) return
    setError(null)
    saveMutation.mutate(toInput(form) as CreateActivityInput | UpdateActivityInput)
  }

  function openCreate() { setEditingId(null); setForm(emptyForm( selectedTeamId === 'all' ? teamsQuery.data?.items[0]?.id ?? '' : selectedTeamId)); setError(null) }
  function openEdit(activity: Activity) { setEditingId(activity.id); setForm(formFromActivity(activity)); setError(null) }

  return (
    <section className="page-content">
      <div className="page-heading"><div><p className="eyebrow">Planificación del club</p><h1>Agenda</h1></div>{canManage && <button className="primary-button" type="button" onClick={openCreate} disabled={!teamsQuery.data?.items.length}>Nueva actividad</button>}</div>
      <div className="settings-form calendar-filters">
        <div className="form-grid-2"><label>Temporada<select value={selectedSeasonId} onChange={(event) => { setSelectedSeasonId(event.target.value); setSelectedTeamId('all') }}><option value="all">Todas las temporadas</option>{seasonsQuery.data?.items.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select></label><label>Equipo<select value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)}><option value="all">Todos los equipos</option>{teamsQuery.data?.items.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label></div>
        <div className="calendar-view-picker" aria-label="Vista de agenda">{(['day', 'week', 'month'] as const).map((view) => <button className={calendarView === view ? 'view-button active' : 'view-button'} type="button" key={view} onClick={() => setCalendarView(view)}>{view === 'day' ? 'Día' : view === 'week' ? 'Semana' : 'Mes'}</button>)}</div>
        <label>Fecha de referencia<input type="date" value={anchorDate} onChange={(event) => setAnchorDate(event.target.value)} /></label>
        <p className="helper-text">Mostrando del {displayDate(calendarRange.fromDate)} al {displayDate(calendarRange.toDate)}.</p>
      </div>
      {form && <form className="settings-form activity-form" onSubmit={submit}><div className="form-heading"><h2>{editingId ? 'Editar actividad' : 'Nueva actividad'}</h2><button className="text-button" type="button" onClick={() => setForm(null)}>Cerrar</button></div><label>Tipo<select value={form.type} disabled={Boolean(editingId)} onChange={(event) => setForm({ ...form, type: event.target.value as ActivityForm['type'] })}><option value="training">Entrenamiento</option><option value="match">Partido</option></select></label><label>Equipo<select value={form.teamId} onChange={(event) => setForm({ ...form, teamId: event.target.value })} required><option value="">Selecciona un equipo</option>{teamsQuery.data?.items.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><div className="form-grid-2"><label>Empieza<input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} required /></label><label>Termina<input type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></label></div>{form.type === 'match' && <><label>Rival<input value={form.opponentName} onChange={(event) => setForm({ ...form, opponentName: event.target.value })} required /></label><label>Competición<input value={form.competition} onChange={(event) => setForm({ ...form, competition: event.target.value })} /></label><label className="checkbox-label"><input type="checkbox" checked={form.isHome} onChange={(event) => setForm({ ...form, isHome: event.target.checked })} /> Partido en casa</label></>}<label>Pabellón o lugar<input value={form.venueName} onChange={(event) => setForm({ ...form, venueName: event.target.value })} /></label><label>Notas<textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={3} /></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="category-actions"><button className="primary-button" type="submit" disabled={saveMutation.isPending || !form.teamId}>{saveMutation.isPending ? 'Guardando…' : 'Guardar actividad'}</button><button className="secondary-button" type="button" onClick={() => setForm(null)}>Cancelar</button></div></form>}
      {teamsQuery.isError && <p className="status-message error">No se han podido cargar los equipos para filtrar la agenda.</p>}
      {activitiesQuery.isLoading && <p className="status-message">Cargando agenda…</p>}
      {activitiesQuery.isError && <p className="status-message error">No se ha podido cargar la agenda.</p>}
      {activitiesQuery.data?.items.length === 0 && <div className="empty-card"><span className="empty-icon">◷</span><h2>No hay actividades en este intervalo</h2><p>Prueba a ampliar las fechas o selecciona todos los equipos.</p></div>}
      <div className="activity-list">{activityGroups.map((group) => <section className="activity-day" key={group.date}><h2 className="activity-day-heading">{displayDate(group.date)}</h2>{group.activities.map((activity) => { const isMatch = activity.type === 'match'; const cancelled = activity.status === 'cancelled' || activity.matchStatus === 'cancelled'; return <article className={`activity-card ${isMatch ? 'match' : 'training'} ${cancelled ? 'cancelled' : ''}`} key={activity.id}><div className="activity-date"><strong>{displayDateTime(activity.startsAt)}</strong>{activity.endsAt && <span>Hasta {new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(new Date(activity.endsAt))}</span>}</div><div className="activity-main"><span className="activity-type">{isMatch ? 'Partido' : 'Entrenamiento'}</span><h2>{isMatch ? `vs ${activity.opponentName}` : 'Entrenamiento'}</h2><p>{activity.teamName}{activity.venueName ? ` · ${activity.venueName}` : ''}</p>{isMatch && <p className="activity-detail">{activity.isHome ? 'Local' : 'Visitante'}{activity.competition ? ` · ${activity.competition}` : ''}</p>}{activity.notes && <p className="activity-detail">{activity.notes}</p>}</div><div className="activity-actions"><span className="activity-status">{cancelled ? 'Cancelado' : activity.status === 'completed' || activity.matchStatus === 'completed' ? 'Completado' : 'Planificado'}</span>{canManage && !cancelled && <><button className="text-button" type="button" onClick={() => openEdit(activity)}>Editar</button><button className="text-button danger-button" type="button" onClick={() => cancelMutation.mutate(activity)} disabled={cancelMutation.isPending}>Cancelar</button></>}</div></article> })}</section>)}</div>
    </section>
  )
}

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiClientError, createApiClient } from '@club-basket/api-client'
import type { TrainingSchedule } from '@club-basket/contracts'

const api = createApiClient(import.meta.env.VITE_API_URL ?? '')
const weekdays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
type ScheduleForm = { weekday: number; startsAt: string; endsAt: string; venueName: string }

function emptySchedule(weekday = 0): ScheduleForm { return { weekday, startsAt: '17:00', endsAt: '18:30', venueName: '' } }
function scheduleToForm(schedule: TrainingSchedule): ScheduleForm { return { weekday: schedule.weekday, startsAt: schedule.startsAt, endsAt: schedule.endsAt, venueName: schedule.venueName ?? '' } }

export function TrainingSchedulesPage() {
  const queryClient = useQueryClient()
  const [teamId, setTeamId] = useState('')
  const [schedules, setSchedules] = useState<ScheduleForm[]>([])
  const [error, setError] = useState<string | null>(null)
  const teamsQuery = useQuery({ queryKey: ['teams', 'training-schedules'], queryFn: () => api.listTeams({ status: 'active' }) })
  const schedulesQuery = useQuery({ queryKey: ['team', teamId, 'training-schedules'], queryFn: () => api.listTrainingSchedules(teamId), enabled: Boolean(teamId) })
  const saveMutation = useMutation({
    mutationFn: () => api.replaceTrainingSchedules(teamId, schedules.map((schedule) => ({ ...schedule, venueName: schedule.venueName || null }))),
    onSuccess: () => { setError(null); void queryClient.invalidateQueries({ queryKey: ['team', teamId, 'training-schedules'] }) },
    onError: (cause) => setError(cause instanceof ApiClientError ? cause.message : 'No se pudieron guardar los horarios'),
  })

  useEffect(() => { if (schedulesQuery.data) setSchedules(schedulesQuery.data.items.map(scheduleToForm)) }, [schedulesQuery.data])
  useEffect(() => { if (!teamId && teamsQuery.data?.items[0]) setTeamId(teamsQuery.data.items[0].id) }, [teamId, teamsQuery.data])

  function selectTeam(next: string) { setTeamId(next); setSchedules([]); setError(null) }
  function addSchedule() { if (schedules.length < 14) setSchedules([...schedules, emptySchedule(schedules.length % 5)]) }
  function updateSchedule(index: number, value: Partial<ScheduleForm>) { setSchedules(schedules.map((schedule, current) => current === index ? { ...schedule, ...value } : schedule)) }

  return <section className="page-content">
    <p className="eyebrow">Configuración del club</p><h1>Horarios de entrenamientos</h1>
    <p className="page-intro">Define hasta dos sesiones semanales por equipo. Los cambios se guardan como horario recurrente.</p>
    <div className="settings-form team-selector-form"><label>Equipo<select value={teamId} onChange={(event) => selectTeam(event.target.value)}><option value="">Selecciona un equipo</option>{teamsQuery.data?.items.map((team) => <option key={team.id} value={team.id}>{team.name} · {team.category}</option>)}</select></label></div>
    {!teamId && <div className="empty-card"><h2>Selecciona un equipo</h2><p>Elige un equipo para configurar sus entrenamientos.</p></div>}
    {teamId && <form className="settings-form schedule-form" onSubmit={(event) => { event.preventDefault(); setError(null); saveMutation.mutate() }}>
      <div className="section-heading"><div><h2>Sesiones semanales</h2><p className="helper-text">Puedes añadir varias sesiones el mismo día.</p></div><button className="secondary-button" type="button" onClick={addSchedule} disabled={schedules.length >= 14}>Añadir sesión</button></div>
      {schedulesQuery.isLoading && <p className="status-message">Cargando horarios…</p>}
      {schedules.length === 0 && !schedulesQuery.isLoading && <p className="empty-card">Este equipo todavía no tiene horarios configurados.</p>}
      <div className="schedule-list">{schedules.map((schedule, index) => <div className="schedule-row" key={`${schedule.weekday}-${index}`}><label>Día<select value={schedule.weekday} onChange={(event) => updateSchedule(index, { weekday: Number(event.target.value) })}>{weekdays.map((day, weekday) => <option value={weekday} key={day}>{day}</option>)}</select></label><label>Desde<input type="time" value={schedule.startsAt} onChange={(event) => updateSchedule(index, { startsAt: event.target.value })} required /></label><label>Hasta<input type="time" value={schedule.endsAt} onChange={(event) => updateSchedule(index, { endsAt: event.target.value })} required /></label><label>Lugar<input value={schedule.venueName} onChange={(event) => updateSchedule(index, { venueName: event.target.value })} placeholder="Pabellón" /></label><button className="text-button danger-button" type="button" onClick={() => setSchedules(schedules.filter((_, current) => current !== index))}>Quitar</button></div>)}</div>
      {error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Guardando…' : 'Guardar horarios'}</button>
    </form>}
  </section>
}

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiClientError, createApiClient } from '@club-basket/api-client'
import type { TodayAttendance, Team } from '@club-basket/contracts'
import { DailyAttendance } from '../attendance/DailyAttendance.js'
import { useAuth } from '../auth/AuthProvider.js'
import { dateInputValue } from '../calendar/calendar-utils.js'

const api = createApiClient(import.meta.env.VITE_API_URL ?? '')

function dateAfter(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return dateInputValue(date)
}

function displayMatchDate(value: string): string {
  return new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function emptyTeamCalendar(team: Team): TodayAttendance {
  const trainingDate = dateInputValue(new Date())
  return { teamId: team.id, trainingDate, currentTime: '00:00', isTrainingDay: false, isCurrentTraining: false, schedule: null, players: [] }
}

export function DashboardPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [attendanceMessage, setAttendanceMessage] = useState<string | null>(null)
  const [attendanceModalMessage, setAttendanceModalMessage] = useState<string | null>(null)
  const assignedTeamIds = user?.teamIds ?? []
  const teamsQuery = useQuery({
    queryKey: ['dashboard', 'teams', assignedTeamIds],
    queryFn: () => api.listTeams({ status: 'active', limit: 100 }),
  })
  const dailyAttendanceQueryKey = ['dashboard', 'attendance', 'daily', assignedTeamIds]
  const dailyAttendanceQuery = useQuery({
    queryKey: dailyAttendanceQueryKey,
    queryFn: async () => Promise.all(assignedTeamIds.map((teamId) => api.todayAttendance(teamId))),
    enabled: assignedTeamIds.length > 0,
  })
  const matchesQuery = useQuery({
    queryKey: ['dashboard', 'matches', assignedTeamIds],
    queryFn: async () => {
      const responses = await Promise.all(assignedTeamIds.map((teamId) => api.listActivities({ teamId, fromDate: dateInputValue(new Date()), toDate: dateAfter(90), limit: 100 })))
      return { items: responses.flatMap((response) => response.items), total: responses.reduce((total, response) => total + response.total, 0), limit: 100, offset: 0 }
    },
    enabled: assignedTeamIds.length > 0,
  })

  const teams = teamsQuery.data?.items.filter((team) => assignedTeamIds.includes(team.id)) ?? []
  const dailyAttendances = dailyAttendanceQuery.data ?? []
  const automaticTeam = dailyAttendances.find((attendance) => attendance.isCurrentTraining)?.teamId ?? dailyAttendances.find((attendance) => attendance.isTrainingDay)?.teamId ?? teams[0]?.id ?? ''
  const activeTeamId = selectedTeamId && assignedTeamIds.includes(selectedTeamId) ? selectedTeamId : automaticTeam
  const activeAttendance = dailyAttendances.find((attendance) => attendance.teamId === activeTeamId) ?? (teams.find((team) => team.id === activeTeamId) ? emptyTeamCalendar(teams.find((team) => team.id === activeTeamId)!) : null)
  const teamNames = new Map(teams.map((team) => [team.id, team.name]))
  const canEditAttendance = user?.roles.some((role) => role === 'club_admin' || role === 'coordinator' || role === 'coach' || role === 'assistant') ?? false

  useEffect(() => {
    if (automaticTeam && !selectedTeamId) setSelectedTeamId(automaticTeam)
  }, [automaticTeam, selectedTeamId])

  const absenceMutation = useMutation({
    mutationFn: async ({ teamId, playerId, trainingDate, absent }: { teamId: string; playerId: string; trainingDate: string; absent: boolean }) => {
      if (absent) await api.markAbsence(teamId, playerId, trainingDate)
      else await api.removeAbsence(teamId, playerId, trainingDate)
    },
    onMutate: async ({ teamId, playerId, absent }) => {
      await queryClient.cancelQueries({ queryKey: dailyAttendanceQueryKey })
      const previous = queryClient.getQueryData<TodayAttendance[]>(dailyAttendanceQueryKey)
      queryClient.setQueryData<TodayAttendance[]>(dailyAttendanceQueryKey, (current) => current?.map((attendance) => attendance.teamId !== teamId ? attendance : {
        ...attendance,
        players: attendance.players.map((player) => player.id !== playerId ? player : { ...player, absentToday: absent, totalAbsences: Math.max(0, player.totalAbsences + (absent ? 1 : -1)) }),
      }))
      return { previous }
    },
    onSuccess: (_data, input) => setAttendanceMessage(input.absent ? 'Falta registrada' : 'Falta eliminada'),
    onError: (cause, _input, context) => {
      if (context?.previous) queryClient.setQueryData(dailyAttendanceQueryKey, context.previous)
      const message = cause instanceof ApiClientError ? cause.message : 'No se pudo guardar la asistencia'
      setAttendanceMessage(message)
      setAttendanceModalMessage(message)
    },
    onSettled: () => { void queryClient.invalidateQueries({ queryKey: dailyAttendanceQueryKey }) },
  })

  const upcomingMatches = (matchesQuery.data?.items ?? []).filter((activity) => assignedTeamIds.includes(activity.teamId) && activity.type === 'match' && activity.status !== 'cancelled' && activity.matchStatus !== 'cancelled')
  const isLoading = teamsQuery.isLoading || dailyAttendanceQuery.isLoading || matchesQuery.isLoading
  const hasNoAssignedTeams = !isLoading && assignedTeamIds.length === 0

  return <section className="page-content">
    <p className="eyebrow">Resumen del club</p>
    <h1>Inicio</h1>
    <p className="page-intro">Control de asistencia de hoy y próximos partidos de tus equipos.</p>
    {isLoading && <p className="status-message">Cargando resumen…</p>}
    <section className="dashboard-section" aria-labelledby="dashboard-attendance-title">
      <div className="section-heading"><div><p className="eyebrow">Seguimiento</p><h2 id="dashboard-attendance-title">Asistencia de hoy</h2></div></div>
      {teamsQuery.isError && <p className="status-message error">No se han podido cargar tus equipos.</p>}
      {dailyAttendanceQuery.isError && <p className="status-message error">No se ha podido cargar la asistencia de hoy.</p>}
      {attendanceMessage && <p className="form-notice" role="status">{attendanceMessage}</p>}
      {attendanceModalMessage && <div className="attendance-modal-backdrop" role="presentation" onClick={() => setAttendanceModalMessage(null)}><section className="attendance-modal" role="dialog" aria-modal="true" aria-labelledby="attendance-modal-title" onClick={(event) => event.stopPropagation()}><p className="eyebrow">Asistencia</p><h2 id="attendance-modal-title">No se ha podido guardar</h2><p>{attendanceModalMessage}</p><button className="primary-button" type="button" onClick={() => setAttendanceModalMessage(null)}>Entendido</button></section></div>}
      {!isLoading && hasNoAssignedTeams && <div className="empty-card"><span className="empty-icon">✓</span><h2>No tienes equipos asignados como entrenador</h2><p>Cuando se te asigne un equipo, su asistencia aparecerá aquí.</p></div>}
      {!isLoading && !teamsQuery.isError && !dailyAttendanceQuery.isError && activeAttendance && <>
        <div className="daily-team-selector"><label>Equipo<select value={activeTeamId} onChange={(event) => setSelectedTeamId(event.target.value)}>{teams.map((team) => <option key={team.id} value={team.id}>{team.name} · {team.category}</option>)}</select></label></div>
        <DailyAttendance attendance={activeAttendance} canEdit={canEditAttendance} isSaving={absenceMutation.isPending} onToggle={(playerId, absent) => absenceMutation.mutate({ teamId: activeAttendance.teamId, playerId, trainingDate: activeAttendance.trainingDate, absent })} />
      </>}
    </section>
    <section className="dashboard-section" aria-labelledby="dashboard-matches-title">
      <div className="section-heading"><div><p className="eyebrow">Competición</p><h2 id="dashboard-matches-title">Próximos partidos</h2></div></div>
      {matchesQuery.isError && <p className="status-message error">No se han podido cargar los próximos partidos.</p>}
      {!isLoading && !matchesQuery.isError && upcomingMatches.length === 0 && <div className="empty-card"><span className="empty-icon">🏀</span><h2>No hay partidos programados</h2><p>Cuando se programe un partido para uno de tus equipos aparecerá aquí.</p></div>}
      {upcomingMatches.length > 0 && <div className="upcoming-match-list">{upcomingMatches.map((match) => <article className="upcoming-match-card" key={match.id}><div className="upcoming-match-date"><strong>{displayMatchDate(match.startsAt)}</strong><span>{match.teamName || (teamNames.get(match.teamId) ?? 'Equipo')}</span></div><div className="upcoming-match-opponent"><span className="activity-type">{match.matchPhase === 'playoffs' ? 'Playoffs' : match.matchPhase === 'preliminary' ? 'Previa' : match.matchPhase === 'cup' ? 'Copa' : match.matchPhase === 'friendly' ? 'Amistoso' : 'Partido'}</span><strong>vs {match.opponentName}</strong><span>{match.isHome ? 'Local' : 'Visitante'}{match.competition ? ` · ${match.competition}` : ''}</span></div></article>)}</div>}
    </section>
  </section>
}

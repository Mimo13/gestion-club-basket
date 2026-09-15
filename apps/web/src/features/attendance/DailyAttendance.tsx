import type { TodayAttendance } from '@club-basket/contracts'

function displayDate(value: string): string {
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date(`${value}T12:00:00`))
}

function sortPlayers(players: TodayAttendance['players']): TodayAttendance['players'] {
  return [...players].sort((first, second) => (first.jerseyNumber ?? 100) - (second.jerseyNumber ?? 100) || first.fullName.localeCompare(second.fullName))
}

export function DailyAttendance({ attendance, canEdit, isSaving, onToggle }: { attendance: TodayAttendance; canEdit: boolean; isSaving?: boolean; onToggle: (playerId: string, absent: boolean) => void }) {
  const hasTraining = attendance.isTrainingDay && attendance.schedule
  const canMarkToday = canEdit && attendance.isTrainingDay
  return <section className="daily-attendance" aria-labelledby="daily-attendance-title">
    <div className="daily-attendance-heading">
      <div><p className="eyebrow">Control del día</p><h2 id="daily-attendance-title">{displayDate(attendance.trainingDate)}</h2></div>
      {attendance.schedule ? <span className="daily-training-time">{attendance.schedule.startsAt} – {attendance.schedule.endsAt}</span> : <span className="daily-training-time">Sin entrenamiento</span>}
    </div>
    {!attendance.isTrainingDay && <p className="daily-attendance-notice">Hoy no hay entrenamiento configurado para este equipo.</p>}
    {attendance.isTrainingDay && !attendance.isCurrentTraining && <p className="daily-attendance-notice">El entrenamiento de hoy es de {attendance.schedule?.startsAt} a {attendance.schedule?.endsAt}. Puedes registrar la asistencia correspondiente a la fecha de hoy.</p>}
    <div className="daily-player-list">
      {sortPlayers(attendance.players).map((player) => <article className={`daily-player-card ${player.absentToday ? 'absent' : ''}`} key={player.id}>
        <div className="daily-player-number">{player.jerseyNumber ?? '—'}</div>
        <div className="daily-player-info"><strong>{player.fullName}</strong><span>{player.totalAbsences} {player.totalAbsences === 1 ? 'falta histórica' : 'faltas históricas'}</span></div>
        {canEdit && <button className={player.absentToday ? 'daily-attendance-button marked' : 'daily-attendance-button'} type="button" aria-pressed={player.absentToday} disabled={!canMarkToday || isSaving} onClick={() => onToggle(player.id, !player.absentToday)}>{player.absentToday ? 'Falta registrada' : 'Marcar falta'}</button>}
      </article>)}
    </div>
  </section>
}

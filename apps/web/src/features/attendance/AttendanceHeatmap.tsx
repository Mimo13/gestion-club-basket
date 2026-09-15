import type { AttendanceCalendar } from '@club-basket/contracts'

type HeatmapTeam = AttendanceCalendar['teams'][number]

type AttendanceCell = HeatmapTeam['players'][number]['cells'][number]

type ToggleAbsence = (input: { playerId: string; trainingDate: string; absent: boolean }) => void

function cellClass(cell: AttendanceCell): string {
  return cell.count > 0 ? 'attendance-table-cell absence' : 'attendance-table-cell present'
}

function displayDate(value: string): string {
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00`))
}

function displayWeekday(value: string): string {
  return new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(new Date(`${value}T12:00:00`))
}

export function AttendanceHeatmap({ team, calendar, onToggleAbsence, isSaving, highlightCenter = false }: { team: HeatmapTeam; calendar: AttendanceCalendar; onToggleAbsence?: ToggleAbsence; isSaving?: boolean; highlightCenter?: boolean }) {
  const dates = team.players[0]?.cells.map((cell) => cell.date) ?? []
  const centerDate = highlightCenter && dates.length === 13 ? dates[6] : undefined


  return (
    <article className="heatmap-card">
      <div className="heatmap-heading">
        <div><p className="eyebrow">Equipo</p><h2>{team.teamName}</h2></div>
        <span className="heatmap-period">{dates.length > 0 ? `${dates.length} entrenamientos · ` : ''}{displayDate(calendar.fromDate)} – {displayDate(calendar.toDate)}{centerDate ? ` · Centro: ${displayDate(centerDate)}` : ''}</span>
      </div>
      {team.players.length === 0 ? <p className="helper-text">No hay jugadores activos en este equipo.</p> : dates.length === 0 ? <p className="helper-text">No hay días de entrenamiento configurados para este equipo.</p> : <div className="attendance-table-scroll" tabIndex={0} aria-label={`Tabla de faltas de ${team.teamName}`}>
        <table className="attendance-table">
          <thead>
            <tr>
              <th scope="col">Jugador</th>
              {dates.map((date) => <th className={date === centerDate ? 'attendance-current-column' : undefined} scope="col" key={date} title={displayDate(date)}><span>{displayWeekday(date)}</span><strong>{new Date(`${date}T12:00:00`).getDate()}</strong></th>)}
            </tr>
          </thead>
          <tbody>
            {team.players.map((player) => <tr key={player.playerId}>
              <th scope="row"><a href={`/players/${player.playerId}`}>{player.fullName}</a><strong>{player.totalAbsences} {player.totalAbsences === 1 ? 'falta' : 'faltas'}</strong></th>
              {player.cells.map((cell) => {
                const label = `${displayDate(cell.date)}: ${cell.count} ${cell.count === 1 ? 'falta' : 'faltas'}`
                return <td className={cell.date === centerDate ? 'attendance-current-column' : undefined} key={cell.date}>{onToggleAbsence ? <button className={`${cellClass(cell)} attendance-table-button`} type="button" aria-label={`${player.fullName}, ${label}. Pulsar para ${cell.count > 0 ? 'quitar la falta' : 'registrar una falta'}`} title={`${label}. Pulsar para ${cell.count > 0 ? 'quitar la falta' : 'registrar una falta'}`} aria-pressed={cell.count > 0} disabled={isSaving} onClick={() => onToggleAbsence({ playerId: player.playerId, trainingDate: cell.date, absent: cell.count === 0 })}>{cell.count > 0 ? cell.count : ''}</button> : <span className={cellClass(cell)} title={label} aria-label={label}>{cell.count > 0 ? cell.count : ''}</span>}</td>
              })}
            </tr>)}
          </tbody>
        </table>
      </div>}
      <div className="heatmap-legend" aria-label="Leyenda de asistencia"><span className="legend-swatch legend-clear" /> <span>Sin falta</span><span className="legend-swatch legend-absence" /> <span>Con falta</span></div>
    </article>
  )
}

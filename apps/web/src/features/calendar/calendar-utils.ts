import type { Activity } from '@club-basket/contracts'

export type CalendarView = 'day' | 'week' | 'month'

function parseDateInput(value: string): Date {
  const [year = 0, month = 1, day = 1] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function dateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getCalendarRange(view: CalendarView, anchor: string): { fromDate: string; toDate: string } {
  const start = parseDateInput(anchor)
  const end = new Date(start)

  if (view === 'day') {
    return { fromDate: dateInputValue(start), toDate: dateInputValue(start) }
  }

  if (view === 'week') {
    const mondayOffset = (start.getDay() + 6) % 7
    start.setDate(start.getDate() - mondayOffset)
    end.setTime(start.getTime())
    end.setDate(start.getDate() + 6)
  } else {
    start.setDate(1)
    end.setMonth(start.getMonth() + 1, 0)
  }

  return { fromDate: dateInputValue(start), toDate: dateInputValue(end) }
}

export function groupActivitiesByDate(activities: Activity[]): Array<{ date: string; activities: Activity[] }> {
  const groups = new Map<string, Activity[]>()
  for (const activity of activities) {
    const date = dateInputValue(new Date(activity.startsAt))
    const current = groups.get(date) ?? []
    current.push(activity)
    groups.set(date, current)
  }

  return [...groups.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([date, groupedActivities]) => ({
      date,
      activities: groupedActivities.sort((first, second) => first.startsAt.localeCompare(second.startsAt)),
    }))
}

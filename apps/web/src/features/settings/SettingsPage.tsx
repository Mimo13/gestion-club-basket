import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider.js'

export function SettingsPage() {
  const { user } = useAuth()
  const canManageUsers = user?.roles.includes('club_admin') || user?.roles.includes('coordinator')
  const links = [
    { to: '/settings/categories', icon: '▦', title: 'Categorías', text: 'Organiza las categorías y sus temporadas.' },
    { to: '/settings/training-schedules', icon: '◷', title: 'Horarios de entrenamientos', text: 'Configura los días y horas de cada equipo.' },
    { to: '/settings/match-dates', icon: '🏀', title: 'Fechas de partidos', text: 'Programa partidos y cambia sus fechas o fases.' },
    ...(canManageUsers ? [{ to: '/admin/users', icon: '♙', title: 'Usuarios', text: 'Gestiona perfiles, equipos asignados e invitaciones.' }] : []),
    { to: '/account/password', icon: '◉', title: 'Cuenta', text: 'Cambia tu contraseña y gestiona tu acceso.' },
  ]

  return (
    <section className="page-content">
      <p className="eyebrow">Configuración del club</p>
      <h1>Ajustes</h1>
      <p className="page-intro">Accede a las secciones de configuración desde un solo lugar.</p>
      <div className="settings-links">
        {links.map((link) => <Link className="settings-link-card" key={link.to} to={link.to}>
          <span className="settings-link-icon" aria-hidden="true">{link.icon}</span>
          <span className="settings-link-copy"><strong>{link.title}</strong><small>{link.text}</small></span>
          <span className="row-chevron" aria-hidden="true">›</span>
        </Link>)}
      </div>
    </section>
  )
}

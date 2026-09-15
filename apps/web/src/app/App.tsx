import { useEffect, useRef, useState } from 'react'
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider.js'
import { ChangePasswordPage } from '../features/auth/ChangePasswordPage.js'
import { LoginPage } from '../features/auth/LoginPage.js'
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage.js'
import { UsersPage } from '../features/admin/UsersPage.js'
import { AttendancePage } from '../features/attendance/AttendancePage.js'
import { CalendarPage } from '../features/calendar/CalendarPage.js'
import { PlayersPage } from '../features/players/PlayersPage.js'
import { PlayerDetailPage } from '../features/players/PlayerDetailPage.js'
import { TeamsPage } from '../features/teams/TeamsPage.js'
import { TeamDetailPage } from '../features/teams/TeamDetailPage.js'
import { DashboardPage } from '../features/dashboard/DashboardPage.js'
import { MatchesPage } from '../features/matches/MatchesPage.js'
import { CategoriesPage } from '../features/settings/CategoriesPage.js'
import { MatchDatesPage } from '../features/settings/MatchDatesPage.js'
import { SettingsPage } from '../features/settings/SettingsPage.js'
import { TrainingSchedulesPage } from '../features/settings/TrainingSchedulesPage.js'

const primaryNavItems = [
  { to: '/teams', label: 'Equipos', icon: '●' },
  { to: '/calendar', label: 'Agenda', icon: '◷' },
  { to: '/', label: 'Inicio', icon: '⌂', end: true },
  { to: '/settings', label: 'Ajustes', icon: '⚙' },
  { to: '/account/password', label: 'Cuenta', icon: '◉' },
]

function HomePage() {
  return <section className="page-content"><p className="eyebrow">Resumen del club</p><h1>Buenos días</h1><div className="empty-card"><span className="empty-icon">🏀</span><h2>Tu actividad aparecerá aquí</h2><p>Consulta los equipos, la agenda y la configuración del club desde la navegación inferior.</p></div></section>
}

function BottomNavigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const dockRef = useRef<HTMLElement>(null)
  const [ballRotation, setBallRotation] = useState(0)
  const activeIndex = (() => {
    const path = location.pathname
    const index = primaryNavItems.findIndex((item) => item.end ? path === '/' : path === item.to || path.startsWith(`${item.to}/`))
    return index < 0 ? 2 : index
  })()

  useEffect(() => {
    setBallRotation((rotation) => rotation + 360)
  }, [location.pathname])

  useEffect(() => {
    const dock = dockRef.current
    const active = dock?.querySelector<HTMLElement>('[aria-current="page"]')
    if (dock && active) dock.style.setProperty('--active-left', `${active.offsetLeft + active.offsetWidth / 2}px`)
  }, [activeIndex, location.pathname])

  return <nav ref={dockRef} className="bottom-nav" aria-label="Navegación principal">
    <div className="nav-dock">
      <span className="nav-ball" aria-hidden="true" style={{ transform: `translate(-50%, -50%) rotate(${ballRotation}deg)` }} />
      {primaryNavItems.map((item, index) => <NavLink key={item.to} end={item.end} to={item.to} aria-current={index === activeIndex ? 'page' : undefined} className={index === activeIndex ? 'nav-item active' : 'nav-item'}>
        <span className="nav-icon" aria-hidden="true">{item.icon}</span><span className="nav-label">{item.label}</span>
      </NavLink>)}
    </div>
  </nav>
}

export function App() {
  const { user, isLoading, logout } = useAuth()
  const navigate = useNavigate()
  useEffect(() => { if (user && window.location.pathname === '/login') navigate('/', { replace: true }) }, [navigate, user])
  if (isLoading && window.location.pathname !== '/reset-password') return <main className="auth-page"><p className="status-message">Comprobando sesión…</p></main>
  if (!user && window.location.pathname === '/reset-password') return <ResetPasswordPage />
  if (!user) return <LoginPage />

  return <div className="app-shell">
    <header className="topbar"><div className="brand-lockup"><img className="brand-logo" src="/branding/logo-club-cartama.svg" alt="Club Baloncesto Cártama" /><div><p className="brand-kicker">CLUB BALONCESTO CÁRTAMA</p><strong>Gestión deportiva</strong></div></div><div className="profile-actions"><NavLink className="avatar-button" aria-label="Abrir cuenta" to="/account/password">{user.displayName.slice(0, 2).toUpperCase()}</NavLink><button className="logout-button" aria-label="Cerrar sesión" onClick={() => void logout()}>Salir</button></div></header>
    <main className="main-content"><Routes>
      <Route path="/" element={<DashboardPage />} /><Route path="/teams" element={<TeamsPage />} /><Route path="/teams/:teamId" element={<TeamDetailPage />} /><Route path="/teams/:teamId/players" element={<PlayersPage />} /><Route path="/teams/:teamId/attendance" element={<AttendancePage />} /><Route path="/players" element={<PlayersPage />} /><Route path="/players/:playerId" element={<PlayerDetailPage />} /><Route path="/attendance" element={<AttendancePage />} /><Route path="/matches" element={<MatchesPage />} /><Route path="/calendar" element={<CalendarPage />} /><Route path="/settings" element={<SettingsPage />} /><Route path="/settings/categories" element={<CategoriesPage />} /><Route path="/settings/training-schedules" element={<TrainingSchedulesPage />} /><Route path="/settings/match-dates" element={<MatchDatesPage />} /><Route path="/account/password" element={<ChangePasswordPage />} /><Route path="/admin/users" element={<UsersPage />} /><Route path="*" element={<HomePage />} />
    </Routes></main>
    <BottomNavigation />
  </div>
}

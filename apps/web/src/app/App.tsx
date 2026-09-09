import { NavLink, Route, Routes } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthProvider.js'
import { ChangePasswordPage } from '../features/auth/ChangePasswordPage.js'
import { LoginPage } from '../features/auth/LoginPage.js'
import { ResetPasswordPage } from '../features/auth/ResetPasswordPage.js'
import { UsersPage } from '../features/admin/UsersPage.js'
import { CategoriesPage } from '../features/settings/CategoriesPage.js'
import { TeamsPage } from '../features/teams/TeamsPage.js'

const navItems = [
  { to: '/', label: 'Inicio', icon: '⌂' },
  { to: '/teams', label: 'Equipos', icon: '●' },
  { to: '/calendar', label: 'Agenda', icon: '◷' },
  { to: '/account/password', label: 'Cuenta', icon: '◉' },
]

function HomePage() {
  return (
    <section className="page-content">
      <p className="eyebrow">Resumen del club</p>
      <h1>Buenos días</h1>
      <div className="empty-card">
        <span className="empty-icon">🏀</span>
        <h2>Tu actividad aparecerá aquí</h2>
        <p>Cuando configuremos los equipos y entrenamientos, tendrás las próximas tareas al alcance de la mano.</p>
      </div>
    </section>
  )
}

export function App() {
  const { user, isLoading, logout } = useAuth()

  if (isLoading && window.location.pathname !== '/reset-password') {
    return <main className="auth-page"><p className="status-message">Comprobando sesión…</p></main>
  }
  if (!user && window.location.pathname === '/reset-password') return <ResetPasswordPage />
  if (!user) return <LoginPage />

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="brand-kicker">CLUB BASKET</p>
          <strong>Gestión deportiva</strong>
        </div>
        <div className="profile-actions">
          {(user.role === 'club_admin' || user.role === 'coordinator') && <NavLink className="admin-link" to="/settings/categories">Ajustes</NavLink>}
          {user.role === 'club_admin' && <NavLink className="admin-link" to="/admin/users">Usuarios</NavLink>}
          <NavLink className="avatar-button" aria-label="Abrir cuenta" to="/account/password">{user.displayName.slice(0, 2).toUpperCase()}</NavLink>
          <button className="logout-button" aria-label="Cerrar sesión" onClick={() => void logout()}>Salir</button>
        </div>
      </header>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/account/password" element={<ChangePasswordPage />} />
          <Route path="/admin/users" element={<UsersPage />} />
          <Route path="/settings/categories" element={<CategoriesPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>

      <nav className="bottom-nav" aria-label="Navegación principal">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

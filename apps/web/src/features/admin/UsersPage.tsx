import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Role, UserStatus } from '@club-basket/contracts'
import { ApiClientError, createApiClient } from '@club-basket/api-client'

const api = createApiClient(import.meta.env.VITE_API_URL ?? 'http://localhost:3000')
const roles: Role[] = ['club_admin', 'coordinator', 'coach', 'assistant', 'viewer']

export function UsersPage() {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<Role>('coach')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const usersQuery = useQuery({ queryKey: ['admin', 'users'], queryFn: () => api.listUsers() })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
  const inviteMutation = useMutation({
    mutationFn: () => api.inviteUser({ email, displayName, role }),
    onSuccess: () => { setEmail(''); setDisplayName(''); setMessage('Usuario invitado correctamente.'); invalidate() },
    onError: (cause) => setError(cause instanceof ApiClientError ? cause.message : 'No se pudo invitar al usuario'),
  })
  const roleMutation = useMutation({ mutationFn: ({ userId, role }: { userId: string; role: Role }) => api.updateUserRole(userId, role), onSuccess: invalidate })
  const statusMutation = useMutation({ mutationFn: ({ userId, status }: { userId: string; status: UserStatus }) => api.updateUserStatus(userId, status), onSuccess: invalidate })

  return (
    <section className="page-content">
      <p className="eyebrow">Administración</p>
      <h1>Usuarios y permisos</h1>
      <form className="settings-form invite-form" onSubmit={(event) => { event.preventDefault(); setError(null); setMessage(null); void inviteMutation.mutateAsync() }}>
        <h2>Invitar usuario</h2>
        <label>Nombre<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required /></label>
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Rol<select value={role} onChange={(event) => setRole(event.target.value as Role)}>{roles.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <button className="primary-button" type="submit" disabled={inviteMutation.isPending}>{inviteMutation.isPending ? 'Invitando…' : 'Enviar invitación'}</button>
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-notice" role="status">{message}</p>}
      </form>
      {usersQuery.isLoading && <p className="status-message">Cargando usuarios…</p>}
      {usersQuery.isError && <p className="status-message error">No se han podido cargar los usuarios.</p>}
      <div className="card-list">
        {usersQuery.data?.items.map((user) => (
          <article className="user-card" key={user.id}>
            <div className="user-card-heading"><div><h2>{user.displayName}</h2><p>{user.email}</p></div><span className={`user-status ${user.status}`}>{user.status}</span></div>
            <label>Rol<select value={user.role} onChange={(event) => void roleMutation.mutate({ userId: user.id, role: event.target.value as Role })}>{roles.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <button className="secondary-button" type="button" onClick={() => void statusMutation.mutate({ userId: user.id, status: user.status === 'active' ? 'disabled' : 'active' })}>{user.status === 'active' ? 'Desactivar acceso' : 'Activar acceso'}</button>
          </article>
        ))}
      </div>
    </section>
  )
}

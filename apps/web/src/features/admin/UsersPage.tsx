import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Role, UserStatus } from '@club-basket/contracts'
import { ApiClientError, createApiClient } from '@club-basket/api-client'

const api = createApiClient(import.meta.env.VITE_API_URL ?? '')
const roles: Role[] = ['club_admin', 'coordinator', 'coach', 'assistant', 'viewer']
const roleLabels: Record<Role, string> = { club_admin: 'Super-admin', coordinator: 'Coordinador', coach: 'Entrenador', assistant: 'Ayudante', viewer: 'Consulta' }

export function UsersPage() {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<Role[]>(['coach'])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const usersQuery = useQuery({ queryKey: ['admin', 'users'], queryFn: () => api.listUsers(), retry: false })
  const teamsQuery = useQuery({ queryKey: ['teams', 'admin-assignment'], queryFn: () => api.listTeams({ status: 'active' }), retry: false })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
  const inviteMutation = useMutation({
    mutationFn: () => api.inviteUser({ email, displayName, roles: selectedRoles }),
    onSuccess: () => { setEmail(''); setDisplayName(''); setSelectedRoles(['coach']); setMessage('Usuario invitado correctamente.'); invalidate() },
    onError: (cause) => setError(cause instanceof ApiClientError ? cause.message : 'No se pudo invitar al usuario'),
  })
  const rolesMutation = useMutation({ mutationFn: ({ userId, roles: nextRoles }: { userId: string; roles: Role[] }) => api.updateUserRoles(userId, nextRoles), onSuccess: invalidate })
  const teamsMutation = useMutation({ mutationFn: ({ userId, teamIds }: { userId: string; teamIds: string[] }) => api.updateUserTeamIds(userId, teamIds), onSuccess: invalidate })
  const statusMutation = useMutation({ mutationFn: ({ userId, status }: { userId: string; status: UserStatus }) => api.updateUserStatus(userId, status), onSuccess: invalidate })
  const toggleRole = (role: Role, current: Role[], onChange: (next: Role[]) => void) => onChange(current.includes(role) ? current.filter((item) => item !== role) : [...current, role])

  return (
    <section className="page-content">
      <p className="eyebrow">Administración</p>
      <h1>Usuarios y permisos</h1>
      <form className="settings-form invite-form" onSubmit={(event) => { event.preventDefault(); setError(null); setMessage(null); void inviteMutation.mutateAsync() }}>
        <h2>Invitar usuario</h2>
        <label>Nombre<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required /></label>
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <fieldset className="role-picker"><legend>Perfiles</legend>{roles.map((item) => <label className="checkbox-label" key={item}><input type="checkbox" checked={selectedRoles.includes(item)} onChange={() => toggleRole(item, selectedRoles, setSelectedRoles)} />{roleLabels[item]}</label>)}</fieldset>
        <button className="primary-button" type="submit" disabled={inviteMutation.isPending || selectedRoles.length === 0}>{inviteMutation.isPending ? 'Invitando…' : 'Enviar invitación'}</button>
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-notice" role="status">{message}</p>}
      </form>
      {usersQuery.isLoading && <p className="status-message">Cargando usuarios…</p>}
      {usersQuery.isError && <p className="status-message error">No se han podido cargar los usuarios.</p>}
      <div className="card-list">
        {usersQuery.data?.items.map((managedUser) => (
          <article className="user-card" key={managedUser.id}>
            <div className="user-card-heading"><div><h2>{managedUser.displayName}</h2><p>{managedUser.email}</p></div><span className={`user-status ${managedUser.status}`}>{managedUser.status}</span></div>
            <fieldset className="role-picker"><legend>Perfiles</legend>{roles.map((item) => <label className="checkbox-label" key={item}><input type="checkbox" checked={managedUser.roles.includes(item)} onChange={() => { const next = managedUser.roles.includes(item) ? managedUser.roles.filter((role) => role !== item) : [...managedUser.roles, item]; if (next.length > 0) void rolesMutation.mutate({ userId: managedUser.id, roles: next }) }} />{roleLabels[item]}</label>)}</fieldset>
            {managedUser.roles.includes('coach') && <fieldset className="role-picker"><legend>Equipos como entrenador</legend>{teamsQuery.data?.items.map((team) => <label className="checkbox-label" key={team.id}><input type="checkbox" checked={managedUser.teamIds.includes(team.id)} onChange={() => { const teamIds = managedUser.teamIds.includes(team.id) ? managedUser.teamIds.filter((id) => id !== team.id) : [...managedUser.teamIds, team.id]; void teamsMutation.mutate({ userId: managedUser.id, teamIds }) }} />{team.name}</label>)}</fieldset>}
            <button className="secondary-button" type="button" onClick={() => void statusMutation.mutate({ userId: managedUser.id, status: managedUser.status === 'active' ? 'disabled' : 'active' })}>{managedUser.status === 'active' ? 'Desactivar acceso' : 'Activar acceso'}</button>
          </article>
        ))}
      </div>
    </section>
  )
}

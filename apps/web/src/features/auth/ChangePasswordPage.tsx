import { useState, type FormEvent } from 'react'
import { ApiClientError } from '@club-basket/api-client'
import { useAuth } from './AuthProvider.js'

export function ChangePasswordPage() {
  const { changePassword } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setError(null)
    try {
      await changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setMessage('Contraseña actualizada. Las demás sesiones han sido cerradas.')
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'No se pudo cambiar la contraseña')
    }
  }

  return (
    <section className="page-content">
      <p className="eyebrow">Cuenta</p>
      <h1>Cambiar contraseña</h1>
      <form className="auth-form settings-form" onSubmit={submit}>
        <label>Contraseña actual<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
        <label>Nueva contraseña<input type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-notice" role="status">{message}</p>}
        <button className="primary-button" type="submit">Guardar contraseña</button>
      </form>
    </section>
  )
}

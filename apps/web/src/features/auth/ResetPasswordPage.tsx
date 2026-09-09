import { useState, type FormEvent } from 'react'
import { ApiClientError } from '@club-basket/api-client'
import { authApi } from './auth-api.js'

export function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get('token') ?? ''
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setError(null)
    try {
      await authApi.resetPassword(token, password)
      setMessage('Contraseña actualizada. Ya puedes iniciar sesión.')
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'No se pudo actualizar la contraseña')
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="reset-title">
        <p className="eyebrow">Club Basket</p>
        <h1 id="reset-title">Nueva contraseña</h1>
        <form className="auth-form" onSubmit={submit}>
          <label>Nueva contraseña<input type="password" autoComplete="new-password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {message && <p className="form-notice" role="status">{message}</p>}
          <button className="primary-button auth-submit" type="submit">Guardar contraseña</button>
        </form>
      </section>
    </main>
  )
}

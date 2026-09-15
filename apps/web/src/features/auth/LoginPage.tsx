import { useState, type FormEvent } from 'react'
import { ApiClientError } from '@club-basket/api-client'
import { useAuth } from './AuthProvider.js'

export function LoginPage() {
  const { login, requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setIsSubmitting(true)
    try {
      await login(email, password)
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'No se pudo iniciar sesión')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleForgotPassword() {
    setError(null)
    setNotice(null)
    if (!email) {
      setError('Escribe tu email para solicitar la recuperación.')
      return
    }
    try {
      await requestPasswordReset(email)
      setNotice('Si existe una cuenta, recibirás instrucciones para recuperar la contraseña.')
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'No se pudo solicitar la recuperación')
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="auth-logo"><img src="/branding/logo-club-cartama.svg" alt="Club Baloncesto Cártama" /></div>
        <p className="eyebrow">Club Baloncesto Cártama</p>
        <h1 id="login-title">Iniciar sesión</h1>
        <p className="auth-intro">Accede a la gestión de tus equipos y actividades.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Contraseña
            <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {notice && <p className="form-notice" role="status">{notice}</p>}
          <button className="primary-button auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando…' : 'Entrar'}
          </button>
          <button className="text-button" type="button" onClick={() => void handleForgotPassword()}>He olvidado mi contraseña</button>
        </form>
      </section>
    </main>
  )
}

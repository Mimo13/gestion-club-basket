import { useState, type FormEvent } from 'react'
import { ApiClientError } from '@club-basket/api-client'
import { useAuth } from './AuthProvider.js'

export function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await login(email, password)
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'No se pudo iniciar sesión')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <div className="auth-logo" aria-hidden="true">🏀</div>
        <p className="eyebrow">Club Basket</p>
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
          <button className="primary-button auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  )
}

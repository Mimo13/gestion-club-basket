import nodemailer from 'nodemailer'
import { env } from '../../config/env.js'

export async function sendPasswordResetEmail(input: { to: string; token: string }): Promise<void> {
  if (!env.SMTP_HOST || !env.SMTP_FROM) {
    if (env.NODE_ENV !== 'production') return
    throw new Error('SMTP no está configurado para enviar recuperación de contraseña')
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER && env.SMTP_PASSWORD ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  })
  const url = `${env.PASSWORD_RESET_URL}?token=${encodeURIComponent(input.token)}`
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: input.to,
    subject: 'Recuperación de contraseña · Club Basket',
    text: `Puedes cambiar tu contraseña usando este enlace: ${url}\n\nEl enlace caduca en una hora.`,
  })
}

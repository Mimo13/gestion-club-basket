import { closeDatabase } from '../../database/client.js'
import { createUserWithMembership } from './auth-repository.js'
import { hashPassword } from './password.js'

const args = process.argv.slice(2)
while (args[0] === '--') args.shift()

const [email, displayName, password, clubId = '00000000-0000-0000-0000-000000000001'] = args

if (!email || !displayName || !password) {
  console.error('Uso: pnpm --filter @club-basket/api create-admin -- email nombre contraseña [clubId]')
  process.exit(1)
}
if (password.length < 12) {
  console.error('La contraseña debe tener al menos 12 caracteres.')
  process.exit(1)
}

try {
  const user = await createUserWithMembership({
    email,
    displayName,
    passwordHash: await hashPassword(password),
    clubId,
    roles: ['club_admin'],
  })
  console.log(`Administrador creado: ${user.email} (${user.id})`)
} finally {
  await closeDatabase()
}

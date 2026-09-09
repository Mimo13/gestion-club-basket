# Seguridad e identidad

## Estado actual

El módulo de identidad inicial utiliza sólo componentes controlados por la aplicación:

- usuarios y membresías almacenados en PostgreSQL;
- contraseñas derivadas con `scrypt`, salt aleatorio y comparación constante;
- sesiones revocables en la tabla `user_sessions`;
- cookie `HttpOnly` para web;
- token bearer sólo cuando un cliente móvil solicita `client: mobile`; la cookie no se emite para clientes móviles;
- permisos asociados a la membresía del usuario en el club.

El token de sesión nunca se guarda en claro en PostgreSQL: se almacena un HMAC-SHA-256 del token usando `SESSION_SECRET`.

## Crear administrador

```bash
pnpm --filter @club-basket/api create-admin -- admin@club.test "Administrador del club" "contraseña-de-al-menos-12-caracteres"
```

No pasar esta contraseña en tickets, commits, logs o chats compartidos. En producción, `SESSION_SECRET` y `DATABASE_URL` deben estar fuera del repositorio, con permisos restringidos.

## Endpoints

- `POST /api/v1/auth/login`: valida credenciales y crea sesión.
- `GET /api/v1/auth/session`: obtiene el usuario de la sesión actual.
- `POST /api/v1/auth/logout`: revoca la sesión.

## Roles iniciales

- `club_admin`: administración completa del club.
- `coordinator`: gestión operativa de equipos y actividades.
- `coach`: trabajo sobre sus equipos; se ampliará el alcance exacto.
- `assistant`: apoyo operativo limitado.
- `viewer`: consulta sin escritura.

La API debe comprobar el rol y el club en cada caso de uso. La UI sólo refleja la autorización y no la sustituye.

## Pendiente antes de producción

- limitación de intentos de login y backoff;
- recuperación/cambio de contraseña;
- protección CSRF explícita para mutaciones si el frontend se sirve en otro origen;
- limpieza programada de sesiones expiradas;
- política de expiración y renovación de sesiones;
- auditoría de login, logout, fallos y cambios de permisos;
- revisión de protección de datos y consentimiento para menores.

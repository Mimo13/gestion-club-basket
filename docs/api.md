# API REST inicial

La API vive bajo `/api/v1` y es consumible por el frontend web y por la futura aplicación React Native. Los cuerpos y respuestas se validan con los contratos de `packages/contracts`.

## Convenciones

- JSON en UTF-8.
- Fechas y horas en ISO 8601 con zona horaria; la base de datos almacena `timestamptz`.
- Identificadores UUID.
- Paginación mediante `limit` y `offset`; `limit` se limita a 100.
- Errores con la forma `{ "error": { "code": "...", "message": "...", "details": ... } }`.
- La autorización se comprueba en el backend; ningún cliente podrá asumir que ocultar un botón equivale a tener permiso.
- En web la sesión usa cookie `HttpOnly`; en móvil el login puede devolver un token bearer cuando se indica `client: mobile`.

## Identidad

### `POST /api/v1/auth/login`

Entrada:

```json
{ "email": "admin@club.test", "password": "una-contraseña-larga", "client": "web" }
```

`client` puede ser `web` o `mobile`. Web recibe una cookie de sesión `HttpOnly`; mobile recibe además `accessToken` en la respuesta para guardarlo en el almacenamiento seguro del dispositivo.

Respuesta `200`: usuario autenticado y fecha de expiración.

### `GET /api/v1/auth/session`

Devuelve el usuario asociado a la cookie o al header `Authorization: Bearer <token>`. Responde `401` si no existe una sesión válida.

### `POST /api/v1/auth/logout`

Revoca la sesión actual y elimina la cookie. Requiere `x-csrf-token` cuando se autentica mediante cookie. Responde `204`.

### Recuperación y cambio de contraseña

- `POST /api/v1/auth/forgot-password`: solicita un enlace sin revelar si el email existe.
- `POST /api/v1/auth/reset-password`: consume un token de un solo uso.
- `POST /api/v1/auth/change-password`: cambia la contraseña autenticada y mantiene sólo la sesión actual.

### Administración

- `GET /api/v1/admin/users`: lista usuarios del club; requiere `club_admin`.
- `POST /api/v1/admin/users`: invita usuario; requiere `club_admin` y CSRF.
- `PATCH /api/v1/admin/users/:userId/role`: cambia rol.
- `PATCH /api/v1/admin/users/:userId/status`: activa/desactiva usuario.

Las mutaciones web de administración requieren `x-csrf-token`. La API móvil puede usar `Authorization: Bearer` y no depende de cookie CSRF.

## Endpoints implementados en el esqueleto

### `GET /api/v1/health`

Respuesta `200`:

```json
{
  "status": "ok",
  "service": "api",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

### `GET /api/v1/teams`

Requiere autenticación. Sólo devuelve equipos del club asociado a la sesión.

> El esqueleto actual usa el primer club de la membresía para resolver el contexto. El selector de club llegará con el módulo multi-club.

Query opcional:

- `seasonId`: UUID.
- `status`: `active`, `inactive` o `archived`.
- `limit`: entero de 1 a 100, por defecto 50.
- `offset`: entero desde 0, por defecto 0.

Respuesta `200`:

```json
{
  "items": [
    {
      "id": "00000000-0000-0000-0000-000000000003",
      "clubId": "00000000-0000-0000-0000-000000000001",
      "seasonId": "00000000-0000-0000-0000-000000000002",
      "name": "Senior A",
      "category": "Senior",
      "gender": "unspecified",
      "status": "active",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

### Categorías y Settings

- `GET /api/v1/categories`: lista las categorías activas del club autenticado para selectores operativos.
- `GET /api/v1/settings/categories`: lista todas las categorías del club; requiere `club_admin` o `coordinator`.
- `POST /api/v1/settings/categories`: crea una categoría; requiere rol de gestión y CSRF en sesión web.
- `PATCH /api/v1/settings/categories/:categoryId`: modifica sus datos o estado; requiere rol de gestión y CSRF en sesión web.

Las categorías pertenecen siempre al club de la sesión. Desactivar una categoría no la elimina ni modifica los equipos históricos.

### `POST /api/v1/teams`

Requiere autenticación y rol `club_admin` o `coordinator`.

Entrada:

```json
{
  "seasonId": "00000000-0000-0000-0000-000000000002",
  "name": "Senior A",
  "category": "Senior",
  "gender": "unspecified"
}
```

Respuesta `201`: equipo creado.

## Próximos grupos de endpoints

| Grupo | Rutas previstas | Alcance |
|---|---|---|
| Identidad | `/auth/login`, `/auth/logout`, `/auth/session` | Sesiones web y tokens móviles |
| Clubes | `/clubs`, `/seasons` | Configuración y temporadas |
| Personas | `/people`, `/players`, `/coaches` | Personas, plantillas y cuerpos técnicos |
| Actividades | `/training-sessions`, `/matches` | Agenda y partidos |
| Asistencia | `/activities/:id/attendance` | Registro por actividad |
| Convocatorias | `/matches/:id/roster` | Disponibilidad y lista de partido |
| Estadísticas | `/matches/:id/stats`, `/players/:id/stats` | Registro y agregados |
| Ficheros | `/attachments` | Metadatos y descargas autorizadas |
| Auditoría | `/audit-events` | Sólo acceso administrativo |

## Reglas de diseño

- Un endpoint no debe contener consultas SQL complejas junto con validación y presentación.
- Cada módulo tendrá rutas, schemas, casos de uso y repositorios separados cuando crezca.
- Los contratos se publicarán desde `packages/contracts`; la futura app móvil no debe duplicar DTOs.
- Las operaciones de escritura deben ser idempotentes cuando el cliente pueda repetirlas por mala cobertura.
- Las listas grandes deben paginarse y filtrar en base de datos.
- Los endpoints administrativos y de datos personales deben registrar una acción de auditoría.

# Modelo de datos inicial

La migración `apps/api/src/database/migrations/001_initial_schema.sql` crea el modelo inicial en PostgreSQL.

## Núcleo del club

```text
clubs ──< club_memberships >── users
  └──< seasons ──< teams
```

- Un club tiene temporadas.
- Una temporada tiene equipos.
- Un usuario puede tener una relación con uno o varios clubes, con un rol por club.
- La temporada actual se limita a una por club mediante índice parcial.

## Personas y equipos

```text
people ── players ── teams
  └── team_coaches ── teams
```

`people` concentra datos personales. `players` añade la dimensión deportiva. El histórico de cambios de equipo se ampliará con una tabla de asignaciones cuando se valide el flujo de altas/bajas; `current_team_id` sólo representa el estado actual del MVP.

## Actividades

```text
teams ──< activities ──< attendance >── players
                  └── matches ──< match_player_stats >── players
```

Una actividad puede ser entrenamiento o partido. La tabla `matches` extiende una actividad con rival, competición y marcador. La asistencia se registra por actividad y jugador, evitando duplicados.

## Principios de PostgreSQL

- UUID para referencias externas.
- `timestamptz` para eventos; las conversiones de presentación usan la zona horaria del club.
- ENUM sólo para estados estables y pequeños; categorías deportivas permanecen como texto configurable.
- Restricciones `CHECK`, claves únicas y claves foráneas protegen invariantes en la base de datos.
- Borrado en cascada sólo en datos dependientes; equipos y temporadas usan restricciones para evitar perder histórico accidentalmente.
- Índices iniciales cubren club/temporada, equipo/fecha, jugador/asistencia y auditoría.
- Toda migración se ejecuta dentro de una transacción y se registra en `schema_migrations`.

## Primeras ampliaciones previstas

1. Historial de pertenencia de jugadores a equipos.
2. Convocatorias diferenciadas de asistencia.
3. Consentimientos y contactos autorizados.
4. Sesiones, refresh tokens y recuperación de cuenta.
5. Adjuntos con hash, tamaño, tipo MIME y política de retención.
6. Campos de temporada/competición específicos de cada federación.

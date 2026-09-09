# Modelo de datos inicial

La migración `apps/api/src/database/migrations/001_initial_schema.sql` crea el modelo inicial en PostgreSQL.

## Núcleo del club

```text
clubs ──< club_memberships >── users
  └──< seasons ──< teams ──> categories
  └──< categories
```

- Un club tiene temporadas.
- Una temporada tiene equipos.
- Cada club mantiene su propio catálogo de categorías, que puede activarse o desactivarse desde Settings.
- Un equipo puede referenciar una categoría del mismo club; se conserva el texto de categoría para compatibilidad con el MVP.
- Un usuario puede tener una relación con uno o varios clubes, con un rol por club.
- La temporada actual se limita a una por club mediante índice parcial.

## Personas y equipos

```text
people ── players ── teams
  └── team_coaches ── teams
```

`people` concentra datos personales. `players` añade la dimensión deportiva. El histórico de cambios de equipo se ampliará con una tabla de asignaciones cuando se valide el flujo de altas/bajas; `current_team_id` sólo representa el estado actual del MVP.

## Actividades y asistencia

```text
teams ──< activities ──< attendance >── players
  └──< training_sessions ──< training_absences >── players
  └──< matches ──< match_convocations >── players
```

Una actividad puede ser entrenamiento o partido. La tabla `matches` extiende una actividad con rival, competición y marcador. Para el control rápido del equipo, `training_sessions` identifica cada fecha de entrenamiento y `training_absences` guarda quién faltó. La ausencia es reversible y su fecha se registra como fecha local de entrenamiento. `match_convocations` queda preparada para distinguir la convocatoria del partido. El resumen de asistencia cuenta las faltas entre dos partidos consecutivos.

## Principios de PostgreSQL

- UUID para referencias externas.
- `timestamptz` para eventos; las conversiones de presentación usan la zona horaria del club.
- ENUM sólo para estados estables y pequeños; categorías deportivas permanecen como texto configurable.
- Restricciones `CHECK`, claves únicas y claves foráneas protegen invariantes en la base de datos.
- Borrado en cascada sólo en datos dependientes; equipos y temporadas usan restricciones para evitar perder histórico accidentalmente.
- Índices iniciales cubren club/temporada, equipo/fecha, jugador/asistencia y auditoría.
- Toda migración se ejecuta dentro de una transacción y se registra en `schema_migrations`.

## Categorías

La tabla `categories` contiene el catálogo configurable por club. Incluye nombre, rango orientativo de edad, rango de año de nacimiento, texto de presentación, orden y estado (`active`/`inactive`). La migración inicial de categorías carga los valores de `docs/categorias.md` para el club base.

Los roles `club_admin` y `coordinator` pueden consultar y modificar el catálogo desde `/settings/categories`. Las categorías inactivas no aparecen en los selectores operativos, pero se conservan para no romper el histórico.

## Primeras ampliaciones previstas

1. Historial de pertenencia de jugadores a equipos.
2. Convocatorias diferenciadas de asistencia.
3. Consentimientos y contactos autorizados.
4. Sesiones, refresh tokens y recuperación de cuenta.
5. Adjuntos con hash, tamaño, tipo MIME y política de retención.
6. Campos de temporada/competición específicos de cada federación.

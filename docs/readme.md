# Gestión de equipos de baloncesto

Aplicación para gestionar equipos, jugadores, entrenamientos, partidos, convocatorias, asistencia y estadísticas de un club de baloncesto.

> **Estado del proyecto:** fase de definición preliminar. La arquitectura y el modelo de datos todavía deben validarse con usuarios del club.

## Propuesta técnica

- **Frontend web:** React + TypeScript + Vite.
- **Backend:** Node.js + TypeScript, organizado como monolito modular y expuesto mediante API REST versionada.
- **Base de datos:** PostgreSQL con migraciones versionadas.
- **Despliegue:** instalación directa en Linux mediante scripts del repositorio; sin Docker.
- **Desarrollo local:** macOS soportado mediante script de preparación, sin ser plataforma de producción.
- **Servicios:** Node.js y PostgreSQL instalados como servicios nativos del sistema; API/worker gestionados con systemd en Linux.
- **Proxy/HTTPS:** Caddy o Nginx instalado directamente en Linux.
- **Móvil futuro:** React Native/Expo, reutilizando contratos, cliente API, lógica de dominio y tokens de diseño.
- **Almacenamiento:** únicamente directorios locales del servidor Linux, con backup independiente.

No se considera Cloudflare Workers, KV Storage, Docker ni una autenticación propietaria como dependencia del producto. La migración se realizará clonando una etiqueta del repositorio, restaurando los datos exportados y ejecutando el instalador Linux.

## Funcionalidades previstas

- **Club y temporadas:** configuración, categorías y temporadas.
- **Equipos:** CRUD, cuerpo técnico y plantillas.
- **Personas y jugadores:** datos deportivos, dorsal, posiciones y contactos autorizados.
- **Entrenamientos:** calendario, ubicación y control de asistencia.
- **Partidos:** calendario, rival, convocatorias, acta y estadísticas.
- **Dashboard:** actividades próximas y métricas útiles para cada rol.
- **Usuarios y permisos:** administrador, coordinador, entrenador, asistente y acceso limitado opcional.
- **Auditoría y backups:** trazabilidad de cambios y restauración documentada.

## Experiencia de uso

La aplicación se diseñará **mobile-first**: las tareas habituales de un entrenador deben funcionar cómodamente en un teléfono con controles táctiles grandes, navegación sencilla y sin depender de hover. En tablet y escritorio se aprovecharán el espacio adicional, las tablas y las vistas de calendario.

La futura aplicación React Native no compartirá necesariamente todos los componentes visuales web, pero sí reutilizará la lógica y los contratos para reducir duplicación y mantener un comportamiento coherente.

## Inicio del desarrollo

En macOS, una vez creados los scripts del proyecto:

```bash
bash scripts/install-macos.sh
pnpm install
pnpm dev
```

En el servidor Linux actual:

```bash
git clone <URL_DEL_REPOSITORIO>
cd club-basket
bash scripts/install-linux.sh
```

El instalador comprobará versiones, preparará Node.js, pnpm, PostgreSQL, el almacenamiento local, migraciones, servicios `systemd` y el proxy. No utilizará Docker. Los comandos y variables definitivos se documentarán en `docs/desarrollo.md` y `docs/instalacion-portable.md`.

## Documentación

- [Informe preliminar y arquitectura](./informe-preliminar.md)
- [Roadmap de implementación](../roadmap.md)

Documentación recomendada para las siguientes fases:

- `docs/decisiones/` — decisiones de arquitectura (ADR).
- `docs/modelo-datos.md` — entidades, relaciones e índices.
- `docs/desarrollo.md` — instalación y convenciones.
- `docs/despliegue.md` — despliegue Linux, actualización y rollback mediante scripts.
- `docs/instalacion-portable.md` — requisitos y uso de los instaladores Linux/macOS.
- `docs/backups.md` — copias y restauración del PostgreSQL y almacenamiento local.
- `docs/api.md` — contratos REST/OpenAPI.
- `docs/ux-mobile.md` — flujos mobile-first y accesibilidad táctil.
- `docs/seguridad.md` — identidad, sesiones, permisos y recuperación de contraseña.

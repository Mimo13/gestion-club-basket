# Roadmap preliminar: gestión de equipos de baloncesto

> **Estado:** en ejecución incremental · **Versión:** 0.3 · **Horizonte orientativo:** 5-6 meses para una v1 usable, sujeto a validación con el club.

## Seguimiento de implementación

- **Implementado en el código actual:** autenticación web, recuperación y cambio de contraseña, administración básica de usuarios, categorías configurables, equipos, plantilla/asistencia y contratos compartidos iniciales.
- **Completado en el paso anterior:** la pantalla de Asistencia ya permite seleccionar cualquier equipo activo y carga jugadores, partidos, faltas y convocatorias según el equipo seleccionado; se eliminó la dependencia del equipo Cadete fijo.
- **Completado en este paso:** contratos compartidos, endpoint autenticado `GET /api/v1/activities`, cliente API y pantalla `/calendar` con filtro por equipo e intervalo de fechas; la agenda muestra entrenamientos y partidos con estado, rival, sede, competición y notas.
- **Verificación:** `pnpm -r typecheck`, tests de contratos (3), tests de API (7) y `pnpm --filter @club-basket/web build` pasan correctamente. El build mantiene únicamente el aviso existente de bundle superior a 500 kB.
- **Completado en este paso:** creación y edición de entrenamientos y partidos desde `/calendar`, cancelación segura, permisos para administración/coordinación/cuerpo técnico, validación compartida y auditoría de cambios.
- **Pendiente conocido:** `apps/web` todavía no tiene pruebas de componentes; quedan por cubrir filtros avanzados por temporada, vistas día/semana/mes y pruebas E2E móviles.

### Continuación recomendada

1. Añadir pruebas de componentes web para selector de equipo, agenda, estados de carga/error/vacío y registro reversible de asistencia.
2. Completar filtros de agenda por temporada y vistas día/semana/mes adaptadas a móvil.
3. Implementar gestión de personas y jugadores para eliminar los datos de plantilla de prueba y permitir altas/bajas desde la aplicación.

Para continuar: revisar primero `apps/web/src/features/calendar/CalendarPage.tsx` y `packages/contracts/src/index.ts`; el siguiente incremento debe añadir pruebas de componentes y mejorar las vistas de agenda sin introducir todavía estadísticas avanzadas.


La propuesta anterior basada en Cloudflare Workers/KV y Docker queda reemplazada. El producto se desarrollará para el servidor Linux actual mediante instalación nativa, con PostgreSQL como base de datos portable, almacenamiento local Linux y un frontend React independiente del backend. macOS se utilizará para desarrollo local.

## 1. Principios del roadmap

- Priorizar los flujos que entrenadores y coordinadores usan cada semana.
- Diseñar primero para móvil y touch; adaptar después a tablet y escritorio.
- Mantener web y backend separables desde el inicio.
- Compartir contratos, tipos y lógica de dominio con la futura aplicación React Native.
- Evitar microservicios prematuros: backend modular, una API y una base de datos relacional.
- No bloquear el producto en Cloudflare, Docker ni en otro proveedor.
- Mantener producción en Linux y soportar macOS sólo como entorno local de desarrollo.
- Entregar cada fase con pruebas, documentación y una forma de recuperar los datos.

## 2. Fases y entregables

| Fase | Duración orientativa | Resultado | Estado |
|---|---:|---|---|
| 0. Descubrimiento y validación | 1-2 semanas | Alcance, roles, flujos y riesgos priorizados | Pendiente |
| 1. Base portable del proyecto | 2 semanas | Monorepo, scripts Linux/macOS, CI, PostgreSQL y API mínima | Pendiente |
| 2. Identidad y estructura del club | 2-3 semanas | Login, roles, club, temporadas y equipos | Pendiente |
| 3. Operativa diaria MVP | 4-5 semanas | Jugadores, entrenamientos, partidos y asistencia | Pendiente |
| 4. Convocatorias y estadísticas | 3-4 semanas | Actas, convocatorias y métricas iniciales | Pendiente |
| 5. UX responsive y consolidación | 3 semanas | Mobile-first validado en móvil/tablet/escritorio | Pendiente |
| 6. Producción y recuperación | 2-3 semanas | Despliegue, backups, monitorización y runbooks | Pendiente |
| 7. React Native | Después de validar web | App móvil compartiendo contratos y dominio | Posterior |

## 3. Fase 0 — Descubrimiento y validación

### Objetivos

- Entrevistar al menos a un administrador/coordinador y a dos entrenadores.
- Describir los flujos reales de asistencia, convocatoria y acta.
- Confirmar si habrá uno o varios clubes y si existen familias/jugadores con acceso.
- Definir datos sensibles, consentimientos, retención y necesidades de exportación.
- Crear wireframes móviles de las tareas prioritarias.

### Entregables

- [ ] Lista priorizada de historias de usuario.
- [ ] Matriz de roles y permisos.
- [ ] Glosario del dominio.
- [ ] Wireframes de dashboard, actividad, asistencia y convocatoria.
- [ ] Decisiones pendientes registradas como ADR.
- [ ] Criterios de aceptación para el MVP.

No se debe empezar por un dashboard complejo sin validar primero el trabajo del entrenador durante un entrenamiento o partido.

## 4. Fase 1 — Base portable

### Backend y datos

- [ ] Crear monorepo con `pnpm workspaces`.
- [ ] Crear `apps/api`, `apps/web` y paquetes compartidos.
- [ ] Configurar TypeScript estricto, lint, formato y scripts comunes.
- [ ] Crear `scripts/install-linux.sh` idempotente para Debian/Ubuntu LTS.
- [ ] Crear `scripts/install-macos.sh` para desarrollo local mediante Homebrew.
- [ ] Crear `scripts/update-linux.sh` para actualizar sin Docker y con rollback documentado.
- [ ] Crear unidades `systemd` para API y worker.
- [ ] Configurar Caddy/Nginx directamente en Linux.
- [ ] Añadir `.env.example` y validación de configuración al arrancar.
- [ ] Configurar migraciones y health checks.
- [ ] Crear endpoint `/api/v1/health`.

### Frontend

- [ ] Crear React + Vite con React Router.
- [ ] Crear tokens de diseño para color, espaciado, tipografía y tamaños táctiles.
- [ ] Crear layout responsive y navegación móvil provisional.
- [ ] Configurar TanStack Query, React Hook Form y validación Zod.

### Calidad

- [ ] CI con install reproducible, typecheck, lint, tests y build.
- [ ] Test de levantar la pila en limpio.
- [ ] Documentar instalación local en `docs/desarrollo.md`.
- [ ] Documentar requisitos y ejecución de scripts en `docs/instalacion-portable.md`.
- [ ] Probar instalación desde un clon limpio en macOS y Linux soportados.

## 5. Fase 2 — Identidad y estructura del club

- [ ] Usuarios, sesiones y cierre de sesión.
- [ ] Roles `club_admin`, `coordinator`, `coach`, `assistant` y `viewer` si procede.
- [ ] Club, temporadas y configuración inicial.
- [ ] Equipos, categorías, género, estado y cuerpo técnico.
- [ ] Guardas de autorización en backend y navegación role-aware en frontend.
- [ ] Auditoría de acciones administrativas.
- [ ] Tests de permisos por caso de uso, no sólo por endpoint.

## 6. Fase 3 — Operativa diaria MVP

### Personas y plantillas

- [ ] Jugadores con datos básicos, dorsal, posiciones y estado.
- [ ] Entrenadores y relación con equipos.
- [ ] Gestión de altas, bajas y cambios de equipo sin perder histórico.

### Entrenamientos

- [x] Crear y editar entrenamientos.
- [x] Mostrar la actividad próxima por equipo.
- [ ] Marcar asistencia, retraso, ausencia justificada y observaciones.
- [ ] Permitir corregir una marca y dejar trazabilidad cuando sea necesario.

### Partidos

- [x] Crear calendario de partidos y rival.
- [x] Vista inicial de agenda por intervalo y equipo adaptada a móvil.
- [ ] Filtrar por equipo y temporada.
- [x] Estados de partido: planificado, jugado, suspendido y cancelado.

### UX y pruebas

- [ ] Flujo completo de asistencia usable con una mano.
- [ ] Estados vacíos, carga, error y confirmación.
- [ ] Tests E2E en viewport móvil y tablet.

## 7. Fase 4 — Convocatorias y estadísticas

- [ ] Convocatoria y disponibilidad de jugadores.
- [ ] Lista de partido y alineación según las necesidades de la categoría.
- [ ] Acta básica: resultado, minutos y estadísticas acordadas con el club.
- [ ] Estadísticas por jugador, partido, equipo y temporada.
- [ ] Cálculos puros con tests independientes del framework.
- [ ] Exportación CSV/PDF sólo después de estabilizar el modelo.
- [ ] Dashboard orientado a decisiones: próximas actividades, asistencia y alertas.

## 8. Fase 5 — Consolidación mobile-first

- [ ] Revisar todos los controles con objetivos táctiles de 44-48 px como mínimo.
- [ ] Sustituir tablas no usables en móvil por tarjetas o listas apiladas.
- [ ] Revisar navegación inferior, filtros y formularios largos.
- [ ] Verificar teclado, foco, contraste, lector de pantalla y orientación horizontal.
- [ ] Optimizar carga inicial, caché de consultas e imágenes.
- [ ] Añadir paginación o virtualización sólo donde los datos lo justifiquen.
- [ ] Revisar componentes para evitar ficheros grandes y dependencias circulares.

## 9. Fase 6 — Producción y recuperación

- [ ] `docs/despliegue.md` con instalación Linux en un servidor limpio.
- [ ] `docs/instalacion-portable.md` con los scripts de instalación, actualización y migración.
- [ ] HTTPS y proxy documentados.
- [ ] Migraciones seguras y procedimiento de rollback.
- [ ] Backup diario de PostgreSQL y directorios locales.
- [ ] Scripts `backup-linux.sh` y `restore-linux.sh`.
- [ ] Restauración probada en otro servidor Linux.
- [ ] Logs estructurados, health checks y alertas básicas.
- [ ] Política de secretos y rotación.
- [ ] Checklist de actualización sin pérdida de datos.
- [ ] Prueba de carga básica sobre los flujos principales.

## 10. Fase 7 — Aplicación React Native

No comenzar la app nativa antes de estabilizar los contratos de la API y validar el flujo web.

- [ ] Extraer o consolidar `packages/contracts`, `api-client`, `domain`, `auth` y `design-tokens`.
- [ ] Crear `apps/mobile` con React Native/Expo.
- [ ] Implementar login y actividad próxima.
- [ ] Implementar asistencia y convocatoria con controles nativos grandes.
- [ ] Compartir reglas y tests de dominio, no forzar todos los componentes web.
- [ ] Añadir almacenamiento seguro, gestión de refresh token y estrategia offline si se confirma como requisito.

## 11. Estructura objetivo resumida

```text
club-basket/
├── apps/web/                 # React + Vite
├── apps/api/                 # Node.js + TypeScript
├── apps/mobile/              # React Native, fase posterior
├── packages/contracts/       # DTOs, tipos y schemas
├── packages/api-client/      # Cliente reutilizable web/móvil
├── packages/domain/          # Reglas puras y estadísticas
├── packages/auth/            # Modelos y helpers de sesión
├── packages/design-tokens/   # Lenguaje visual común
├── scripts/                  # Instalación, actualización y backups
├── infra/                    # systemd, proxy y configuración operativa
├── docs/                     # Decisiones y manuales
└── tests/                    # Integración y E2E
```

## 12. Definición de terminado para la v1

La v1 no se considerará terminada por tener muchas pantallas, sino cuando:

- un entrenador pueda consultar su próxima actividad y registrar asistencia desde móvil;
- un coordinador pueda administrar equipos, temporadas y calendario;
- el sistema aplique permisos correctamente en API y UI;
- los datos se guarden en PostgreSQL y puedan exportarse/restaurarse;
- el proyecto se despliegue en el servidor Linux actual clonando el repositorio y ejecutando un script;
- la instalación se repita en un segundo servidor Linux sin Docker y sin intervención manual no documentada;
- existan tests para los flujos críticos y documentación de operación;
- no haya dependencias esenciales de Cloudflare u otro proveedor concreto;
- la base compartida permita iniciar React Native sin duplicar contratos ni reglas de negocio.

## 13. Riesgos a vigilar

| Riesgo | Mitigación |
|---|---|
| Intentar construir todas las estadísticas desde el inicio | Acordar un conjunto mínimo por categoría y fase |
| Interfaz de escritorio adaptada tarde al móvil | Probar cada flujo en móvil desde el primer sprint |
| Permisos sólo en el frontend | Autorizar siempre en casos de uso del backend |
| Backups que nunca se restauran | Simulacro de restauración periódico |
| Pérdida o saturación del disco local | Retención, alertas de capacidad y backup fuera del servidor |
| Variaciones entre distribuciones Linux | Soportar inicialmente una matriz pequeña Debian/Ubuntu LTS y verificarla en CI |
| Acoplamiento a almacenamiento local | Mantener rutas configurables y exportación desde el principio |
| Monorepo demasiado complejo | Empezar con workspaces y añadir herramientas sólo cuando aporten valor |
| Compartir UI web y nativa a la fuerza | Compartir dominio, contratos y tokens; separar componentes de plataforma |
| Ficheros y módulos difíciles de mantener | Revisión por responsabilidad y tests de módulos pequeños |

## 14. Dependencia externa: repositorio GitHub

Antes de comenzar la implementación se creará un repositorio privado o público en GitHub, según la decisión del propietario del proyecto. El código fuente, scripts y documentación se sincronizarán allí; los secretos, datos reales, backups y ficheros subidos por usuarios quedarán fuera del repositorio.

Datos necesarios para ejecutar esta tarea:

- URL o nombre exacto del repositorio de destino.
- Cuenta u organización de GitHub propietaria.
- Visibilidad: privado o público.
- Rama inicial y, si aplica, método de autenticación disponible para publicar cambios.

La sincronización inicial debe incluir `.gitignore`, `.env.example`, documentación, scripts y una primera etiqueta/versionado. No se ejecutará ningún `git push` ni se creará el repositorio hasta disponer de autorización y del destino concreto. Una vez facilitados esos datos, la creación y sincronización inicial del repositorio será el primer paso operativo.

## 15. Referencia

La motivación y las decisiones iniciales están desarrolladas en [docs/informe-preliminar.md](docs/informe-preliminar.md).

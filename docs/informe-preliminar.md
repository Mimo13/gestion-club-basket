# Informe preliminar del proyecto

> **Estado:** borrador de partida · **Versión:** 0.2
>
> Este documento sustituye la propuesta inicial basada en Cloudflare y sirve como base para decidir el producto y la implementación definitiva. No pretende cerrar todavía todas las decisiones técnicas.

## 1. Objetivo y alcance

Construir una aplicación para que un club de baloncesto pueda gestionar, desde móvil, tablet y ordenador:

- clubes, temporadas, categorías y equipos;
- jugadores, entrenadores y resto de personas vinculadas al club;
- entrenamientos, partidos, convocatorias y asistencia;
- actas y estadísticas de los partidos;
- calendarios, avisos y tareas operativas;
- usuarios, roles, permisos y trazabilidad de cambios.

La primera versión debe resolver muy bien el trabajo cotidiano de entrenadores y coordinadores. Las funciones avanzadas —estadísticas históricas complejas, notificaciones externas, importaciones y aplicaciones nativas— se incorporarán después de validar el flujo principal.

### Objetivos no funcionales

1. **Portabilidad:** poder instalar la aplicación en el servidor actual y trasladarla después a otro servidor Linux compatible sin reescribir la aplicación. macOS se soportará como entorno local de desarrollo, no como plataforma de producción.
2. **Mobile-first:** las acciones habituales deben poder completarse con una mano y con controles táctiles cómodos.
3. **Mantenibilidad:** separar responsabilidades y evitar componentes, módulos o ficheros monolíticos.
4. **Evolución multiplataforma:** reutilizar tipos, validaciones, cliente API y lógica de negocio para una futura aplicación React Native.
5. **Seguridad y recuperación:** disponer de autenticación, permisos, auditoría y copias de seguridad verificables desde el inicio.

## 2. Cambio principal de arquitectura

### Decisión preliminar

Se propone un **monolito modular autoalojado, sin Docker ni contenedores**. La aplicación se instalará directamente sobre un servidor Linux mediante un script versionado dentro del repositorio. No se utilizarán Cloudflare Workers, KV Storage ni autenticación propietaria de un proveedor.

El monolito modular mantiene una única aplicación de backend sencilla de operar, pero con límites claros entre módulos. Si en el futuro un módulo necesita separarse, podrá hacerlo sin rehacer todo el sistema.

```text
Usuarios
   │ HTTPS
   ▼
Reverse proxy instalado en Linux (Caddy o Nginx)
   ├── frontend web React compilado (archivos estáticos)
   └── API backend Node.js/TypeScript como servicio systemd
             ├── PostgreSQL instalado en Linux
             ├── almacenamiento local de ficheros en Linux
             └── worker opcional como servicio systemd

Copias de seguridad: volcado PostgreSQL + ficheros + configuración cifrada
```

### Servicios iniciales

| Servicio | Responsabilidad | Despliegue inicial | Dependencia |
|---|---|---|---|
| `web` | Interfaz React para navegador | Build estático servido por Caddy/Nginx | Linux y servidor HTTP estándar |
| `api` | Autenticación, permisos, reglas y API | Proceso Node.js gestionado por systemd | Node.js LTS |
| `db` | Datos transaccionales | PostgreSQL instalado como servicio del sistema | PostgreSQL estándar |
| `proxy` | HTTPS, rutas y archivos estáticos | Caddy o Nginx instalado en el sistema | Linux |
| `worker` | Correos, exportaciones y tareas largas | Proceso Node.js opcional gestionado por systemd | Node.js LTS |
| `storage` | Fotos, documentos y exportaciones | Directorio local del servidor Linux | Sistema de ficheros Linux |

En desarrollo, el script de macOS instalará Node.js y PostgreSQL mediante Homebrew. En producción sólo se soportará Linux, inicialmente Debian/Ubuntu LTS, para reducir variantes y hacer el instalador verificable.

### Por qué no empezar con microservicios

El dominio todavía se está descubriendo y el tamaño inicial del proyecto no justifica la complejidad operativa de varios backends, colas y despliegues independientes. Los módulos internos, los contratos API y la separación de datos proporcionarán una ruta de extracción futura si aparece una necesidad real.

## 3. Stack tecnológico propuesto

### Frontend web

- **React + TypeScript**.
- **Vite** para producir una aplicación estática independiente del backend y del proveedor de hosting.
- **React Router** para navegación.
- **TanStack Query** para caché, estados de carga, reintentos e invalidación de datos remotos.
- **React Hook Form + Zod** para formularios y validaciones compartidas.
- CSS responsive con tokens de diseño; Tailwind CSS puede utilizarse si el equipo lo prefiere, pero no debe ocultar las reglas de accesibilidad.
- Componentes accesibles y orientados a touch. La librería visual debe permitir reemplazar componentes web por equivalentes nativos.

### Backend

- **Node.js + TypeScript**.
- Framework HTTP modular, preferentemente **Fastify**, con validación de entrada y documentación OpenAPI. Express también es válido si el equipo ya tiene experiencia con él.
- API REST versionada (`/api/v1`) como contrato inicial entre web, móvil y backend.
- Servicios de dominio separados de controladores HTTP.
- Zod o JSON Schema para validar entrada y salida; las reglas de negocio no deben vivir únicamente en el frontend.

### Persistencia

- **PostgreSQL** como base de datos principal.
- Migraciones versionadas ejecutables desde la CLI.
- ORM o query builder con SQL portable; la elección final entre Drizzle, Prisma o equivalente se hará durante el setup y se documentará.
- No se usará una base de datos clave-valor como fuente principal: el dominio tiene relaciones, filtros, historiales y consultas agregadas que se benefician del modelo relacional.

### Aplicación móvil futura

- **React Native**, preferentemente con Expo si no aparecen requisitos nativos que lo impidan.
- Compartirá paquetes de tipos, esquemas, cliente API, autenticación, hooks de dominio, utilidades y tokens de diseño.
- No se intentará compartir todo el JSX web: las diferencias entre DOM, accesibilidad web, navegación y controles nativos hacen más mantenible compartir lógica que forzar una UI única.

## 4. Estructura de repositorio propuesta

Se recomienda un monorepo ligero con `pnpm workspaces`. No es obligatorio añadir Turborepo desde el primer día; se incorporará sólo si los tiempos de build lo justifican. La instalación no dependerá de Docker: se ejecutarán los scripts del repositorio y los gestores de paquetes nativos del sistema.

```text
club-basket/
├── apps/
│   ├── web/                         # React + Vite para navegador
│   ├── api/                         # Backend Node.js modular
│   └── mobile/                      # Fase posterior: React Native/Expo
├── packages/
│   ├── contracts/                   # Tipos, Zod schemas y DTOs
│   ├── api-client/                  # Cliente HTTP agnóstico de plataforma
│   ├── domain/                      # Tipos y reglas puras reutilizables
│   ├── auth/                        # Modelos y helpers de sesión
│   ├── design-tokens/               # Colores, espacios, tamaños y tipografía
│   ├── web-ui/                      # Componentes exclusivamente web
│   └── mobile-ui/                   # Componentes exclusivamente nativos (futuro)
├── scripts/
│   ├── install-linux.sh             # Instalación/actualización en Linux
│   ├── install-macos.sh             # Entorno local de desarrollo en macOS
│   ├── backup-linux.sh              # Backup de PostgreSQL y ficheros
│   └── restore-linux.sh             # Restauración verificada
├── infra/
│   ├── systemd/                     # Unidades de API y worker
│   ├── proxy/                       # Configuración Caddy/Nginx
│   └── backups/                     # Políticas y rutas de backup
├── docs/
├── tests/
│   ├── e2e/                         # Flujos de navegador
│   └── integration/                 # API y base de datos
├── .env.example
├── package.json
└── pnpm-workspace.yaml
```

### Regla para mantener ficheros pequeños

- Un fichero debe tener una responsabilidad principal.
- Las pantallas se dividirán en `page`, `loader/query`, `form`, `components` y `models` cuando crezcan.
- Los componentes de UI no accederán directamente a PostgreSQL ni construirán URLs de API.
- Los controladores HTTP sólo traducirán la petición; la lógica estará en casos de uso/servicios.
- Las funciones puras de estadísticas y permisos irán separadas y tendrán tests unitarios.
- Como guía, revisar cualquier fichero que supere aproximadamente 250-300 líneas o un componente con más de una responsabilidad. No es un límite mecánico, sino una señal de refactorización.
- Evitar índices mágicos y `any`; los contratos compartidos deben ser la fuente de verdad.

## 5. Backend por módulos

La organización se hará por funcionalidad, no por una carpeta global con todos los controladores o modelos.

```text
apps/api/src/
├── app.ts
├── server.ts
├── config/
├── shared/
│   ├── errors/
│   ├── http/
│   ├── auth/
│   └── database/
└── modules/
    ├── identity/                  # usuarios, sesiones, roles
    ├── clubs/                     # club, temporadas y configuración
    ├── teams/                     # equipos y cuerpos técnicos
    ├── people/                    # jugadores, entrenadores y contactos
    ├── training/                  # entrenamientos y asistencia
    ├── matches/                   # partidos, convocatorias y actas
    ├── statistics/                # estadísticas calculadas
    ├── notifications/             # avisos, inicialmente interno
    └── audit/                     # trazabilidad
```

Cada módulo podrá contener `routes`, `schemas`, `service`, `repository`, `mapper` y tests. No todos los módulos necesitan todas las carpetas.

## 6. Modelo de datos preliminar

La base de datos debe ser relacional, con identificadores UUID, fechas almacenadas en UTC y campos de auditoría (`created_at`, `updated_at`, y usuario que modifica cuando aplique).

Entidades iniciales:

- `clubs`: club y configuración general.
- `club_memberships`: relación de usuarios con un club y su rol.
- `users`: identidad, estado y preferencias.
- `seasons`: temporadas del club.
- `teams`: equipo, categoría, género, temporada y estado.
- `people`: datos comunes de jugadores, entrenadores y contactos.
- `players`: información deportiva del jugador.
- `coaches`: relación de entrenadores con equipos.
- `venues`: instalaciones y pistas.
- `training_sessions`: fecha, duración, ubicación y equipo.
- `matches`: rival, local/visitante, competición, estado y resultado.
- `match_rosters`: convocatorias y disponibilidad.
- `attendance`: asistencia y retrasos a entrenamientos o partidos.
- `match_player_stats`: estadísticas por jugador y partido.
- `attachments`: fotografías, documentos o actas; el binario se guardará en un directorio local de Linux y PostgreSQL conservará sus metadatos y permisos.
- `audit_events`: cambios relevantes y acciones administrativas.

La primera migración debe incluir restricciones, índices para las consultas reales y reglas de borrado. No se decidirá el esquema definitivo sólo a partir de formularios: antes se validarán los flujos de entrenador, coordinador y administrador.

## 7. Autenticación, roles y seguridad

- El backend será la única autoridad para autenticación y autorización.
- En web se priorizarán cookies `HttpOnly`, `Secure` y `SameSite` con protección CSRF adecuada.
- En React Native se utilizarán tokens de acceso y refresh tokens almacenados en almacenamiento seguro del dispositivo.
- Las contraseñas se almacenarán con un algoritmo resistente como Argon2id; nunca en texto plano.
- Se podrán añadir proveedores externos (OIDC, Google, etc.) mediante un adaptador, sin acoplar el dominio a ellos.
- Roles iniciales: `club_admin`, `coordinator`, `coach`, `assistant` y, si se necesita acceso limitado, `viewer`.
- Las comprobaciones de permisos deben existir en los casos de uso del backend. Ocultar un botón no es una medida de seguridad.
- Todas las operaciones destructivas tendrán confirmación, registro y, cuando sea viable, archivado en lugar de borrado físico.
- Validar tamaño y tipo de ficheros, limitar intentos de login, registrar errores sin exponer datos sensibles y mantener secretos fuera del repositorio.

## 8. Experiencia mobile-first y táctil

### Principios

1. Diseñar primero para una anchura aproximada de 360-430 px y después ampliar a tablet y escritorio.
2. Priorizar las tareas de hoy: próximo entrenamiento, próximo partido, convocatorias y asistencia.
3. Usar controles táctiles de al menos 44-48 px, separación suficiente y estados visuales claros.
4. No depender de `hover`, menús contextuales diminutos o arrastrar como única forma de operar.
5. Mantener acciones importantes visibles y ofrecer confirmación cuando una acción cambie muchos registros.

### Patrones recomendados

- Navegación inferior en móvil con 4-5 destinos principales; navegación lateral o superior en pantallas grandes.
- Listas como tarjetas o filas apiladas en móvil; tablas completas sólo cuando el ancho lo permita.
- Botón de acción principal accesible con el pulgar, sin tapar contenido ni teclado.
- Formularios por pasos o secciones cortas, con teclado adecuado y guardado explícito.
- Selector de fecha/hora compatible con teclado y pantalla táctil.
- Filtros en una hoja inferior o panel desplegable en móvil, no una barra horizontal imposible de usar.
- Estados `loading`, vacío, error, guardado y desconectado siempre visibles.
- Soporte de orientación horizontal en tablet y de teclado/ratón en escritorio.
- Contraste WCAG AA, foco visible, textos ampliables y etiquetas accesibles.

### Flujo prioritario de MVP

1. Entrenador abre la aplicación y ve su equipo y la próxima actividad.
2. Abre el entrenamiento o partido.
3. Marca asistencia con pulsaciones grandes y estados fáciles de corregir.
4. Guarda y recibe confirmación.
5. En un partido, consulta la convocatoria y registra el acta/estadísticas esenciales.

Este flujo debe probarse con usuarios reales antes de ampliar el dashboard.

## 9. Portabilidad, instalación y recuperación

### Regla de portabilidad

La unidad de migración será el repositorio Git y un conjunto de exportaciones de datos. No se distribuirán máquinas virtuales ni imágenes Docker. La instalación debe poder repetirse en un Linux limpio ejecutando un fichero versionado del repositorio.

- Toda configuración se expresará mediante variables de entorno documentadas en `.env.example`.
- Los secretos se crearán en el servidor y nunca se subirán a GitHub.
- Las rutas de datos serán configurables, con una ruta predeterminada bajo `/var/lib/club-basket/` en Linux.
- El frontend se compilará como archivos estáticos.
- La API y el worker se ejecutarán como usuarios sin privilegios y unidades `systemd`.
- Las versiones de Node.js, pnpm, PostgreSQL y del sistema soportadas quedarán fijadas en la documentación.

### Scripts previstos

| Script | Plataforma | Responsabilidad |
|---|---|---|
| `scripts/install-linux.sh` | Linux Debian/Ubuntu LTS | Comprueba requisitos, instala dependencias nativas, prepara rutas, configura servicios y ejecuta migraciones |
| `scripts/install-macos.sh` | macOS | Prepara el entorno local de desarrollo mediante Homebrew, PostgreSQL y Node.js; no configura producción |
| `scripts/update-linux.sh` | Linux | Descarga una versión concreta, instala dependencias, compila, migra y reinicia de forma controlada |
| `scripts/backup-linux.sh` | Linux | Genera un backup de PostgreSQL, ficheros locales y configuración sin secretos en claro |
| `scripts/restore-linux.sh` | Linux | Valida y restaura un backup con confirmación explícita |

Los scripts deben ser idempotentes, detenerse ante errores (`set -Eeuo pipefail`), mostrar lo que van a cambiar, aceptar rutas mediante variables/argumentos y no borrar datos automáticamente. Las operaciones destructivas requerirán una confirmación explícita.

### Instalación inicial en el servidor actual

1. Instalar una distribución Linux soportada, inicialmente Debian/Ubuntu LTS.
2. Crear un usuario de servicio sin privilegios y un usuario administrativo separado.
3. Clonar el repositorio de GitHub en una ruta de despliegue.
4. Ejecutar `bash scripts/install-linux.sh` con los parámetros del entorno.
5. Crear el fichero de secretos y la configuración local fuera del repositorio.
6. Instalar Node.js LTS, pnpm, PostgreSQL y Caddy/Nginx si no están disponibles.
7. Crear el directorio de almacenamiento local y sus permisos.
8. Ejecutar migraciones y crear el primer administrador.
9. Compilar el frontend y la API.
10. Registrar las unidades `systemd`, activar HTTPS y comprobar health checks, login y backup.

El script no debe asumir una instalación concreta del servidor ni sobrescribir una base de datos existente. Antes de modificar un sistema con datos, debe realizarse un backup.

### Migración a otro servidor Linux

1. Instalar el sistema operativo y dependencias indicadas en la matriz de compatibilidad.
2. Clonar la misma etiqueta del repositorio.
3. Ejecutar el instalador en modo preparación, sin arrancar todavía la aplicación pública.
4. Restaurar el volcado PostgreSQL y el directorio de ficheros en las rutas configuradas.
5. Copiar o regenerar los secretos según la política de seguridad.
6. Ejecutar migraciones pendientes y comprobar permisos de los directorios.
7. Cambiar DNS/proxy cuando las comprobaciones sean correctas.
8. Ejecutar la lista de verificación posterior a la migración.

### Copias de seguridad mínimas

- Backup diario de PostgreSQL mediante `pg_dump` en formato restaurable.
- Backup del directorio local de ficheros y de la configuración necesaria para reconstruir el servicio.
- Cifrado y copia fuera del servidor principal; no guardar el único backup en el mismo disco.
- Retención configurable y prueba periódica de restauración en otro Linux.
- Documentar RPO/RTO antes de producción. Como punto de partida: RPO de 24 horas y RTO de 4 horas para el MVP.

## 10. Calidad, pruebas y observabilidad

- Unit tests para permisos, validaciones, cálculos estadísticos y reglas de convocatoria.
- Integration tests contra PostgreSQL para repositorios y casos de uso.
- E2E para login, asistencia, convocatorias y responsive móvil/tablet.
- Typecheck, lint y build obligatorios en CI.
- OpenAPI generado desde contratos revisados; la API se versionará de forma compatible.
- Logs estructurados sin contraseñas, tokens ni datos personales innecesarios.
- Health checks separados para proceso, API y base de datos.
- Métricas mínimas: errores 5xx, latencia, intentos de login, tareas pendientes y estado de backups.
- Error tracking opcional y sustituible; no debe ser requisito para ejecutar el producto.

## 11. Decisiones pendientes

Antes de congelar la arquitectura se deben validar:

1. ¿Un servidor manejará un club o habrá varios clubes aislados?
2. ¿Se necesita acceso para familias/jugadores en la primera versión?
3. ¿Se enviarán notificaciones por email, push, WhatsApp u otro canal?
4. ¿Se guardarán fotografías y documentos? ¿Qué retención y consentimiento requieren?
5. ¿Se requiere funcionamiento offline para pabellones con mala cobertura?
6. ¿Qué proveedor de email, si se usa alguno, será aceptable? El almacenamiento de ficheros queda inicialmente limitado al disco local de Linux.
7. ¿Qué política de capacidad, retención y rotación se aplicará al almacenamiento local?
8. ¿Qué ORM/query builder encaja mejor con la experiencia del equipo?
9. ¿Cuáles son las estadísticas mínimas de cada categoría y competición?
10. ¿Qué navegador y versión mínima deben soportarse?
11. ¿Qué política de protección de datos, consentimientos y exportación de datos aplica al club?

Estas preguntas deben resolverse como decisiones registradas, no como detalles implícitos en el código.

## 12. Recomendación de documentación futura

Además de este informe y el roadmap, conviene crear cuando comience la implementación:

- `docs/decisiones/`: ADRs cortos para decisiones que puedan cambiar.
- `docs/api.md` o publicación de OpenAPI.
- `docs/modelo-datos.md`: diagrama y reglas de integridad.
- `docs/desarrollo.md`: instalación local, comandos y convenciones.
- `docs/despliegue.md`: instalación Linux, actualización y rollback con scripts.
- `docs/instalacion-portable.md`: requisitos y uso de los instaladores Linux/macOS.
- `docs/backups.md`: backup, restauración y simulacro.
- `docs/seguridad.md`: secretos, roles, sesiones y protección de datos.
- `docs/ux-mobile.md`: flujos, breakpoints, touch targets y criterios de accesibilidad.
- `docs/runbooks/`: procedimientos para incidencias frecuentes.

## 13. Criterio para pasar de preliminar a definitivo

La arquitectura podrá considerarse suficientemente validada cuando:

- el flujo de asistencia y convocatoria se haya probado con entrenadores;
- exista un prototipo navegable mobile-first en web;
- la API permita ejecutar el mismo flujo sin depender de la interfaz;
- se pueda levantar el entorno Linux desde cero clonando el repositorio y ejecutando el instalador con `.env.example`;
- una copia de PostgreSQL se haya restaurado en otra instalación;
- los contratos compartidos estén listos para iniciar React Native;
- los riesgos y decisiones pendientes de la sección anterior tengan responsable y fecha.

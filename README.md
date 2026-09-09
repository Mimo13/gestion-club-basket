# Club Basket

Aplicación para la gestión operativa de equipos de baloncesto.

## Estado

Esqueleto inicial: monorepo pnpm, API Fastify/PostgreSQL, frontend React/Vite mobile-first, contratos compartidos, primera migración y scripts de instalación nativa.

## Requisitos

- Node.js 22 LTS o superior.
- pnpm 11.
- PostgreSQL 16 o compatible.
- Linux Debian/Ubuntu LTS para producción.
- macOS + Homebrew para desarrollo local.

## Desarrollo local

```bash
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm dev
```

La API queda en `http://localhost:3000` y el frontend en `http://localhost:5173`.

## Producción Linux

```bash
git clone https://github.com/Mimo13/gestion-club-basket.git /opt/club-basket
cd /opt/club-basket
sudo bash scripts/install-linux.sh
```

No se utiliza Docker. La API se ejecuta como servicio `systemd`, el frontend se sirve como archivos estáticos desde Nginx y PostgreSQL se usa como servicio nativo del sistema.

## Estructura

- `apps/api`: API y migraciones PostgreSQL.
- `apps/web`: aplicación React mobile-first.
- `packages/contracts`: esquemas y DTOs compartidos.
- `packages/domain`: reglas puras reutilizables.
- `packages/api-client`: cliente para web y futura app móvil.
- `scripts`: instalación, actualización, backup y restauración.
- `infra`: systemd y Nginx.
- `docs`: decisiones y diseño.

## Documentación

- [Informe preliminar](docs/informe-preliminar.md)
- [Modelo de datos](docs/modelo-datos.md)
- [API](docs/api.md)
- [Seguridad e identidad](docs/seguridad.md)
- Categorías iniciales y configuración: `docs/categorias.md` y Settings > Categorías
- [Instalación portable](docs/instalacion-portable.md)
- [Plantilla cadete masculino](docs/plantilla-cadete-masculino.md)
- [Roadmap](roadmap.md)

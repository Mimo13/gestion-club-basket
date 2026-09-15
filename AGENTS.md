# Notas para agentes — Club Basket

Runbook completo: **`docs/despliegue-vps.md`**. Léelo antes de desplegar. Aquí está lo imprescindible.

## Contexto clave

- Este repositorio **es el servidor de producción**: `/root/proyectos/gestion-equipos`. No hay un ordenador de desarrollo aparte.
- Público: `https://cbc.the13.eu` — Nginx sirve estáticos desde `/var/www/club-basket` y hace proxy de `/api/` a `127.0.0.1:4174`.
- La API corre en **modo revisión** con `tsx` sobre el código fuente (unidad `club-basket-review-api.service`).
- La base de datos es PostgreSQL local (`127.0.0.1:5432`); es la que ve el club, así que **toda sentencia destructiva se confirma antes** y se ejecuta en transacción.

## Desplegar el frontend

```bash
pnpm --filter @club-basket/web build
cp -a /var/www/club-basket "/var/www/club-basket.backup-$(date +%Y%m%d-%H%M%S)"
rm -rf /var/www/club-basket/assets /var/www/club-basket/index.html
cp -a apps/web/dist/. /var/www/club-basket/
```

## Desplegar el backend

No hay build: la API ejecuta el fuente con `tsx`. Reiniciar la unidad:

```bash
systemctl restart club-basket-review-api.service
```

## No ejecutar

`scripts/update-linux.sh` asume una instalación en `/opt/club-basket` con `git checkout` del remoto y unidad persistente `club-basket-api.service`. En este VPS no existen: **no aplica**.

## Verificar antes de decir que está publicado

```bash
pnpm -r typecheck
pnpm -r test
curl -fsS https://cbc.the13.eu/ | grep assets/index-
curl -fsS https://cbc.the13.eu/api/v1/health
```

El HTML público debe referenciar el hash nuevo de `apps/web/dist/index.html` y el bundle debe contener los textos nuevos de la funcionalidad antes de informar al usuario. El aviso de bundle > 500 kB es conocido y no bloquea.

## Operaciones de datos

```bash
set -a; . ./.env; set +a
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT ..."
```

## Convenciones del proyecto

- Textos de interfaz en español (es-ES), tono claro y corto.
- Pruebas web con Vitest + Testing Library + jsdom (`apps/web/src/**/*.test.tsx`); la API usa tests de rutas con Fastify.
- Cliente HTTP en `packages/api-client`, esquemas Zod compartidos en `packages/contracts`; los cambios de API empiezan por los contratos.
- Nunca incluir credenciales en ficheros versionados. `docs/operacion-club-basket.md` está ignorado por Git y sí contiene datos sensibles.

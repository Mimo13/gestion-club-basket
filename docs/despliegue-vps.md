# Memoria operativa del despliegue de Club Basket

> Runbook permanente del VPS. No incluir credenciales, contraseñas, tokens ni valores de `.env` en este documento.

## VPS actual

- Repositorio de trabajo localizado en: `/root/proyectos/gestion-equipos`
- Dominio público: `https://cbc.the13.eu/`
- Configuración Nginx versionada en: `infra/nginx/club-basket-public.conf`
- Root estático real servido por Nginx: `/var/www/club-basket`
- El frontend público se sirve mediante Nginx como archivos estáticos.
- Nginx hace proxy de `/api/` hacia `127.0.0.1:4174` según la configuración pública actual.

## Recursos de marca

- Fuentes originales: `docs/LOGOS-CB-CARTAMA/`
- Logo utilizado por la web: `apps/web/public/branding/logo-club-cartama.svg`
- El logo se muestra en la cabecera autenticada y en login/recuperación de contraseña.
- Identidad visual documentada en: `docs/identidad-visual.md`
- Paleta principal: verde bosque `#123A1E`, verde club `#127834`, amarillo `#FAC30E`, dorado `#CE9126` y crema `#FAEAC7`.

## Build y publicación del frontend

Desde `/root/proyectos/gestion-equipos`:

```bash
pnpm --filter @club-basket/web build
cp -a apps/web/dist/. /var/www/club-basket/
```

La publicación sólo reemplaza los artefactos estáticos del frontend. No modifica la API ni la base de datos.

Después comprobar:

```bash
curl -fsSI https://cbc.the13.eu/
curl -fsSI https://cbc.the13.eu/branding/logo-club-cartama.svg
curl -fsS https://cbc.the13.eu/ | grep -E 'theme-color|Club Baloncesto Cártama|assets/index-'
curl -fsS https://cbc.the13.eu/api/v1/health
```

Si el HTML público continúa mostrando un hash de bundle anterior, la compilación todavía no se ha copiado a `/var/www/club-basket` o existe caché del navegador. El HTML debe referenciar los assets que genera `apps/web/dist/index.html` y el logo debe responder `200`.

## Servicios y configuración

- Nginx: servicio público y root `/var/www/club-basket`.
- API pública: proxy same-origin bajo `/api/` hacia `127.0.0.1:4174`.
- Unidad systemd activa en este VPS: `club-basket-review-api.service` (entorno de revisión pública controlada).
- El frontend público se sirve mediante Nginx como archivos estáticos.

- Las categorías activas de la temporada actual se materializan como equipos activos aunque todavía no tengan jugadores; la migración `011_seed_empty_category_teams.sql` es idempotente.
- La migración `012_match_phases_training_schedules.sql` añade fases de competición a los partidos y horarios recurrentes por equipo.
- La navegación inferior pública tiene cinco accesos: Equipos, Agenda, Inicio, Ajustes y Cuenta; el acceso activo usa un botón circular amarillo con animación de giro.
- Ajustes incluye Categorías, Horarios de entrenamientos, Fechas de partidos, Usuarios y Cuenta.
- Las fases de partidos disponibles son previa de acceso, liga regular, playoffs, copa, amistoso y otros torneos; la previa y la liga regular admiten Bronce, Plata u Oro.
- Configuración pública: `infra/nginx/club-basket-public.conf`.
- Reinicio de la API en este VPS: `systemctl restart club-basket-review-api.service`.
- El fichero `docs/operacion-club-basket.md` es local, está ignorado por Git y contiene información sensible; no debe versionarse ni compartirse.

Cuando el usuario diga “local”, en este proyecto debe interpretarse como el VPS donde se sirve la aplicación, no como un ordenador de desarrollo separado. Antes de afirmar que un cambio está publicado:

1. Compilar el frontend.
2. Copiar `apps/web/dist/` a `/var/www/club-basket/`.
3. Reiniciar la API con `systemctl restart club-basket-review-api.service` cuando haya cambios de backend.
4. Comprobar la URL pública y los nuevos assets por HTTPS.
5. Informar sólo después de confirmar que la versión pública responde con los artefactos nuevos.

## Comandos de verificación del proyecto

```bash
pnpm -r typecheck
pnpm -r test
pnpm --filter @club-basket/web build
```

El build puede mostrar el aviso existente de bundle superior a 500 kB; no impide la publicación.

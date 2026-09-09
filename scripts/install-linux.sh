#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="club-basket"
APP_USER="${APP_USER:-club-basket}"
APP_DIR="${APP_DIR:-/opt/${APP_NAME}}"
DATA_DIR="${DATA_DIR:-/var/lib/${APP_NAME}}"
ENV_FILE="${ENV_FILE:-/etc/${APP_NAME}/app.env}"

log() { printf '\n[%s] %s\n' "$APP_NAME" "$1"; }
fail() { printf '\nERROR: %s\n' "$1" >&2; exit 1; }
require_root() { [[ "${EUID}" -eq 0 ]] || fail "Ejecuta este script como root o con sudo."; }

require_root
[[ "${OSTYPE}" == linux* ]] || fail "Este instalador sólo admite Linux."
command -v apt-get >/dev/null || fail "Esta versión inicial requiere Debian/Ubuntu con apt-get."
command -v git >/dev/null || fail "git es obligatorio para instalar desde el repositorio."

log "Instalando dependencias del sistema"
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl git build-essential postgresql postgresql-contrib nginx

if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
command -v corepack >/dev/null && corepack enable || true
command -v pnpm >/dev/null || npm install --global pnpm@11.5.0

log "Creando usuario y directorios"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
install -d -o "$APP_USER" -g "$APP_USER" -m 0750 "$APP_DIR" "$DATA_DIR/storage"
install -d -m 0750 "$(dirname "$ENV_FILE")"

if [[ ! -f "$ENV_FILE" ]]; then
  install -m 0640 -o root -g "$APP_USER" /dev/null "$ENV_FILE"
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
API_HOST=127.0.0.1
API_PORT=3000
CORS_ORIGIN=https://cambiar-dominio
DATABASE_URL=postgresql://club_basket_app:CAMBIAR_PASSWORD@127.0.0.1:5432/club_basket
STORAGE_ROOT=$DATA_DIR/storage
SESSION_SECRET=CAMBIAR_POR_UN_SECRETO_ALEATORIO_LARGO
EOF
  log "Se ha creado $ENV_FILE. Edita sus secretos antes de iniciar la aplicación."
fi

if [[ ! -d "$APP_DIR/.git" ]]; then
  fail "APP_DIR=$APP_DIR no contiene un checkout Git. Clona el repositorio allí antes de ejecutar el instalador."
fi

log "Instalando dependencias y compilando"
cd "$APP_DIR"
runuser -u "$APP_USER" -- env HOME="$APP_DIR" pnpm install --frozen-lockfile=false
runuser -u "$APP_USER" -- env HOME="$APP_DIR" pnpm build

log "Preparando PostgreSQL"
DB_PASSWORD="$(awk -F= '$1 == "DATABASE_URL" { print $2 }' "$ENV_FILE" | sed -n 's#.*://[^:]*:\([^@]*\)@.*#\1#p')"
[[ -n "$DB_PASSWORD" && "$DB_PASSWORD" != "CAMBIAR_PASSWORD" ]] || fail "Configura una contraseña real en DATABASE_URL antes de preparar PostgreSQL."
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -v app_password="$DB_PASSWORD" -v app_user="club_basket_app" -v db_name="club_basket" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'app_user') THEN
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', :'app_user', :'app_password');
  ELSE
    EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'app_user', :'app_password');
  END IF;
END
$$;
SELECT format('CREATE DATABASE %I OWNER %I', :'db_name', :'app_user')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'db_name')\gexec
SQL

log "Aplicando migraciones"
runuser -u "$APP_USER" -- env HOME="$APP_DIR" bash -c "set -a; source '$ENV_FILE'; set +a; pnpm db:migrate"

log "Instalando servicios systemd y configuración nginx"
install -m 0644 infra/systemd/club-basket-api.service /etc/systemd/system/club-basket-api.service
install -m 0644 infra/nginx/club-basket.conf /etc/nginx/sites-available/club-basket.conf
ln -sfn /etc/nginx/sites-available/club-basket.conf /etc/nginx/sites-enabled/club-basket.conf
rm -f /etc/nginx/sites-enabled/default
systemctl daemon-reload
systemctl enable --now club-basket-api
nginx -t
systemctl reload nginx

log "Instalación terminada. Revisa $ENV_FILE y configura HTTPS antes de publicar el servicio."

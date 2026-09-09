#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/club-basket}"
APP_USER="${APP_USER:-club-basket}"
REF="${1:-main}"

[[ "${EUID}" -eq 0 ]] || { echo "Ejecuta con sudo/root." >&2; exit 1; }
[[ -d "$APP_DIR/.git" ]] || { echo "No existe un checkout en $APP_DIR." >&2; exit 1; }

cd "$APP_DIR"
"$APP_DIR/scripts/backup-linux.sh"
runuser -u "$APP_USER" -- git fetch --tags origin
runuser -u "$APP_USER" -- git checkout --force "$REF"
runuser -u "$APP_USER" -- pnpm install --frozen-lockfile=false
runuser -u "$APP_USER" -- pnpm build
runuser -u "$APP_USER" -- pnpm db:migrate
systemctl restart club-basket-api
systemctl reload nginx
curl --fail --silent http://127.0.0.1:3000/api/v1/health >/dev/null
echo "Actualización completada: $REF"

#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_DIR="${1:?Uso: restore-linux.sh /ruta/al/backup}"
DATA_DIR="${DATA_DIR:-/var/lib/club-basket}"
DB_NAME="${DB_NAME:-club_basket}"
DB_USER="${DB_USER:-club_basket_app}"

[[ "${EUID}" -eq 0 ]] || { echo "Ejecuta con sudo/root." >&2; exit 1; }
[[ -f "$BACKUP_DIR/database.dump" && -f "$BACKUP_DIR/storage.tar.gz" ]] || { echo "Backup incompleto." >&2; exit 1; }
read -r -p "Esto reemplazará los datos actuales de $DB_NAME. Escribe RESTAURAR: " confirmation
[[ "$confirmation" == RESTAURAR ]] || { echo "Cancelado."; exit 1; }

systemctl stop club-basket-api || true
runuser -u postgres -- dropdb --if-exists "$DB_NAME"
runuser -u postgres -- createdb --owner="$DB_USER" "$DB_NAME"
runuser -u postgres -- pg_restore --exit-on-error --no-owner --dbname="$DB_NAME" "$BACKUP_DIR/database.dump"
rm -rf "$DATA_DIR/storage"
install -d -o club-basket -g club-basket -m 0750 "$DATA_DIR/storage"
tar -xzf "$BACKUP_DIR/storage.tar.gz" -C "$DATA_DIR"
chown -R club-basket:club-basket "$DATA_DIR/storage"
systemctl start club-basket-api
echo "Restauración completada; verifica la aplicación y los permisos."

#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/club-basket}"
DATA_DIR="${DATA_DIR:-/var/lib/club-basket}"
DB_NAME="${DB_NAME:-club_basket}"
DB_USER="${DB_USER:-club_basket_app}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET="$BACKUP_DIR/$STAMP"

[[ "${EUID}" -eq 0 ]] || { echo "Ejecuta con sudo/root." >&2; exit 1; }
install -d -m 0700 "$TARGET"
pg_dump --format=custom --file="$TARGET/database.dump" --username="$DB_USER" "$DB_NAME"
tar --xattrs --acls -czf "$TARGET/storage.tar.gz" -C "$DATA_DIR" storage
printf '%s\n' "Backup creado en $TARGET" > "$TARGET/manifest.txt"
chmod 0600 "$TARGET"/*
echo "Backup creado: $TARGET"

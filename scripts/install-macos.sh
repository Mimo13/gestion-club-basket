#!/usr/bin/env bash
set -Eeuo pipefail

command -v brew >/dev/null || { echo "Instala Homebrew desde https://brew.sh antes de continuar." >&2; exit 1; }
brew update
brew install node@22 postgresql@16 2>/dev/null || true
brew services start postgresql@16
command -v corepack >/dev/null && corepack enable || true
command -v pnpm >/dev/null || npm install --global pnpm@11.5.0

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Se ha creado .env; revisa DATABASE_URL y SESSION_SECRET antes de usar la API."
fi

pnpm install
pnpm db:migrate
echo "Entorno macOS preparado. Arranca con: pnpm dev"

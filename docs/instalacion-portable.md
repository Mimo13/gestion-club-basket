# Instalación portable

La aplicación no utiliza Docker. La instalación se reconstruye desde el repositorio Git y datos exportados.

## Plataformas

- **Producción:** Debian/Ubuntu LTS en Linux, con systemd y PostgreSQL 16 o compatible.
- **Desarrollo:** macOS reciente con Homebrew y PostgreSQL 16 o compatible.
- **No soportado inicialmente:** Windows como servidor, contenedores y almacenamiento remoto de ficheros.

## Linux

En un servidor limpio, clonar la etiqueta deseada:

```bash
git clone https://github.com/Mimo13/gestion-club-basket.git /opt/club-basket
cd /opt/club-basket
sudo bash scripts/install-linux.sh
```

El script instala o verifica Node.js LTS, pnpm, PostgreSQL, Nginx y dependencias de compilación; crea el usuario de servicio, prepara `/var/lib/club-basket`, compila la aplicación, ejecuta migraciones y registra la API con systemd.

Antes de exponer el servidor:

1. Editar `/etc/club-basket/app.env`.
2. Sustituir contraseña y `SESSION_SECRET`.
3. Configurar `SMTP_HOST`, `SMTP_FROM` y credenciales SMTP para recuperación e invitaciones.
4. Revisar `PASSWORD_RESET_URL` para que apunte al dominio público.
5. Configurar `server_name` y HTTPS en Nginx.
6. Activar HTTPS y usar el dominio real antes de iniciar sesión.
7. Crear el primer administrador con el comando documentado abajo.
8. Ejecutar una copia de seguridad y probar `/api/v1/health`.
9. Verificar el timer `club-basket-identity-cleanup.timer`.

### Primer administrador

Después de aplicar migraciones, ejecutar desde la raíz del repositorio, sin incluir la contraseña en Git:

```bash
pnpm --filter @club-basket/api create-admin -- admin@club.test "Administrador del club" "CAMBIAR-ESTA-CONTRASEÑA-LARGA"
```

La contraseña debe tener al menos 12 caracteres. El comando guarda únicamente el hash derivado con `scrypt`. El valor debe sustituirse por una contraseña temporal real y no reutilizarse en producción.

## macOS

```bash
bash scripts/install-macos.sh
pnpm dev
```

El script instala Node.js y PostgreSQL con Homebrew y prepara `.env`. No crea servicios de producción ni unidades systemd.

## Migración

1. Clonar la misma etiqueta del repositorio en el nuevo Linux.
2. Ejecutar el instalador.
3. Parar la aplicación durante la restauración.
4. Restaurar el dump de PostgreSQL y `/var/lib/club-basket/storage`.
5. Mantener o regenerar los secretos según el plan de seguridad.
6. Ejecutar migraciones pendientes.
7. Verificar permisos, health check, login, equipos y ficheros.
8. Cambiar DNS sólo después de validar el servicio.

Los datos reales, backups, `.env`, claves y uploads no se guardan en GitHub.

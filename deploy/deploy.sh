#!/bin/bash
# FlipyERP Academy · despliegue con rollback.
# Uso (como el usuario academy):  bash /opt/academy/deploy/deploy.sh
#   DEPLOY_SHA=<commit>  fija el commit exacto a desplegar (p. ej. desde CI).
#
# Orden pensado para no romper producción: todo lo que puede fallar (instalar,
# tests, validar contenido, build) se hace ANTES de migrar y reiniciar. Si el
# health check falla tras reiniciar, se vuelve al commit anterior.
set -euo pipefail

ROOT="/opt/academy"
APP="$ROOT/atlas"
LOG="$ROOT/logs/deploy.log"
BACKUP_DIR="$ROOT/backups"
SERVICE="flipyerp-academy"
HEALTH_URL="http://127.0.0.1:8090/api/health"
DB="academy"

mkdir -p "$BACKUP_DIR" "$(dirname "$LOG")"

notify() {
    local msg="$1"
    if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_DEPLOY_CHAT_ID:-}" ]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d chat_id="$TELEGRAM_DEPLOY_CHAT_ID" -d text="$msg" -d parse_mode="HTML" > /dev/null 2>&1 || true
    fi
    echo "$msg" | sed 's/<[^>]*>//g' | tee -a "$LOG"
}

# Un solo despliegue a la vez.
exec 200>"$ROOT/.deploy.lock"
if ! flock -w 600 200; then
    echo "[ACADEMY] Otro despliegue en curso; abortando." | tee -a "$LOG"
    exit 1
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
cd "$ROOT"
PREV_COMMIT=$(git rev-parse HEAD)
notify "<b>Academy deploy</b> · inicio $(date '+%H:%M:%S') · anterior ${PREV_COMMIT:0:8}"

build_app() {
    cd "$APP"
    # NODE_ENV=production haría que npm omitiese las dependencias de build y test.
    NODE_ENV=development npm ci --include=dev --no-audit --no-fund 2>&1 | tail -n 3 | tee -a "$LOG"
    npm test 2>&1 | tail -n 8 | tee -a "$LOG"
    FLIPYERP_ROOT="${FLIPYERP_ROOT:-/opt/flipyerp/FlipyERP_v1.0.1}" node scripts/validate-content.cjs content 2>&1 | tail -n 3 | tee -a "$LOG"
    npm run build 2>&1 | tail -n 2 | tee -a "$LOG"
    cd "$ROOT"
}

echo "[1/6] Código..." | tee -a "$LOG"
git fetch origin 2>&1 | tee -a "$LOG"
if [ -n "${DEPLOY_SHA:-}" ]; then
    git cat-file -e "${DEPLOY_SHA}^{commit}" || { notify "<b>Academy: DEPLOY_SHA no válido</b>"; exit 1; }
    git reset --hard "$DEPLOY_SHA" 2>&1 | tee -a "$LOG"
else
    git reset --hard "origin/$(git rev-parse --abbrev-ref HEAD)" 2>&1 | tee -a "$LOG"
fi
NEW_COMMIT=$(git rev-parse HEAD)
if [ "$NEW_COMMIT" = "$PREV_COMMIT" ] && [ -z "${FORCE:-}" ]; then
    notify "Academy: nada que desplegar (${NEW_COMMIT:0:8}). Usa FORCE=1 para forzar."
    exit 0
fi

echo "[2/6] Instalar, probar, validar y compilar..." | tee -a "$LOG"
if ! build_app; then
    notify "<b>Academy: DEPLOY FALLIDO</b> en build/tests. Producción intacta; vuelvo a ${PREV_COMMIT:0:8}."
    git reset --hard "$PREV_COMMIT" 2>&1 | tee -a "$LOG"
    build_app || true
    exit 1
fi

echo "[3/6] Copia de la base de datos..." | tee -a "$LOG"
pg_dump "$DB" --format=custom --file="$BACKUP_DIR/pre_deploy_${TIMESTAMP}.dump" 2>&1 | tee -a "$LOG"

echo "[4/6] Migraciones..." | tee -a "$LOG"
set -a; . "$ROOT/academy.env"; set +a
if ! (cd "$APP" && node server/academy/cli.mjs migrate) 2>&1 | tee -a "$LOG"; then
    notify "<b>Academy: migración fallida</b>. Restaurando base de datos y código ${PREV_COMMIT:0:8}."
    pg_restore -d "$DB" --clean --if-exists "$BACKUP_DIR/pre_deploy_${TIMESTAMP}.dump" 2>&1 | tee -a "$LOG" || true
    git reset --hard "$PREV_COMMIT" 2>&1 | tee -a "$LOG"
    build_app || true
    sudo systemctl restart "$SERVICE"
    exit 1
fi

echo "[5/6] Reinicio y comprobación..." | tee -a "$LOG"
sudo systemctl restart "$SERVICE"
sleep 3
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" || echo "000")
if [ "$HTTP_CODE" != "200" ]; then
    notify "<b>Academy: health check fallido</b> (HTTP $HTTP_CODE). Rollback a ${PREV_COMMIT:0:8}."
    pg_restore -d "$DB" --clean --if-exists "$BACKUP_DIR/pre_deploy_${TIMESTAMP}.dump" 2>&1 | tee -a "$LOG" || true
    git reset --hard "$PREV_COMMIT" 2>&1 | tee -a "$LOG"
    build_app || true
    sudo systemctl restart "$SERVICE"
    exit 1
fi

echo "[6/6] Limpieza (se guardan las 10 últimas copias)..." | tee -a "$LOG"
ls -t "$BACKUP_DIR"/pre_deploy_*.dump 2>/dev/null | tail -n +11 | xargs -r rm -f

notify "<b>Academy: DEPLOY OK</b> · ${NEW_COMMIT:0:8} · $(date '+%H:%M:%S')"

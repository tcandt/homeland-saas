#!/usr/bin/env bash
# ==============================================================================
# Homeland System Update 60s Poller (Daemon / Cron)
# Tự động kiểm tra bản cập nhật mới trên VPS mỗi 60 giây
# ==============================================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INTERVAL=60

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Khởi chạy tiến trình kiểm tra cập nhật VPS (chu kỳ: ${INTERVAL}s)..."

while true; do
    cd "$DIR"
    git fetch origin main --quiet 2>/dev/null || true
    LOCAL=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    REMOTE=$(git rev-parse origin/main 2>/dev/null || echo "unknown")

    if [ "$LOCAL" != "$REMOTE" ] && [ "$REMOTE" != "unknown" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] 🚀 PHÁT HIỆN BẢN CẬP NHẬT MỚI: local ($LOCAL) -> remote ($REMOTE)"
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✓ Hệ thống đang ở phiên bản mới nhất ($LOCAL)."
    fi
    sleep "$INTERVAL"
done

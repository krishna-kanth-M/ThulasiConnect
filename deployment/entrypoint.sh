#!/bin/sh
set -e

echo "=== ThulasiConnect Cloud Production Container Startup ==="
echo "Port: ${PORT:-8000}"
echo "Environment: ${APP_ENV:-production}"

# Controlled migration invariant:
# Database migrations are executed separately via Render's preDeployCommand
# or a controlled release pipeline (`deployment/migrate.sh`), never during web container boot.

# Start FastAPI ASGI server with Uvicorn
echo "Starting Uvicorn ASGI server with WebSockets & Escalation Scheduler..."
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "${PORT:-8000}" \
  --proxy-headers \
  --forwarded-allow-ips "*"

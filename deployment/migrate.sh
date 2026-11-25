#!/bin/sh
# ==============================================================================
# ThulasiConnect Controlled Database Migration Script
# ==============================================================================
# Usage:
#   sh deployment/migrate.sh
#
# Purpose:
#   Executes database migrations in an isolated, controlled release process
#   prior to traffic routing or container deployment.
# ==============================================================================

set -e

echo "=== ThulasiConnect Controlled Migration Runner ==="
echo "Checking database connection and running Alembic migrations..."

# Ensure we are in the backend directory where alembic.ini resides
cd "$(dirname "$0")/../backend" || cd /app/backend

# Verify current database revision
echo "Current database revision:"
alembic current || true

# Execute migration to the latest revision
echo "Applying pending migrations (alembic upgrade head)..."
alembic upgrade head

# Verify post-migration status
echo "Post-migration revision:"
alembic current

echo "=== Database migrations completed successfully ==="

#!/bin/sh
set -e

# Sync VITE_BASE_PATH from BASE_PATH if not explicitly set
if [ -z "$VITE_BASE_PATH" ] && [ -n "$BASE_PATH" ]; then
  export VITE_BASE_PATH="$BASE_PATH"
fi

# Ensure docs directory exists
mkdir -p /app/docs

# Sync dependencies (named volumes may be stale after package.json changes)
echo "Syncing server dependencies..."
cd /app/server && npm install --no-audit --no-fund
echo "Syncing client dependencies..."
cd /app/client && NODE_ENV=development npm install --no-audit --no-fund

if [ "$NODE_ENV" = "production" ]; then
  echo "Building client for production (BASE_PATH=${VITE_BASE_PATH:-/})..."
  cd /app/client && npx vite build
  echo "Starting server in production mode..."
  cd /app/server && node src/index.js
else
  echo "Starting in development mode..."
  # Run both Vite dev server and Express API concurrently
  cd /app/client && npx vite --host 0.0.0.0 &
  cd /app/server && npx nodemon src/index.js
fi

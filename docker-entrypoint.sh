#!/bin/sh
# Seeds the app list on first start; later edits live in the /data volume.
set -e
if [ ! -f "$CONSOLE_CONFIG_FILE" ]; then
  cp /app/console.config.default.json "$CONSOLE_CONFIG_FILE"
fi
mkdir -p "$CONSOLE_DATA_DIR/builds"
exec "$@"

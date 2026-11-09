#!/bin/sh
# Apply pending migrations, then start the app (or whatever command was given).
# `migrate deploy` is a no-op when the database is current, so every restart is safe.
set -eu

pnpm prisma migrate deploy
exec "$@"

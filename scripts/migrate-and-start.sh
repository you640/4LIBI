#!/bin/sh
echo "[boot] PORT=$PORT HOST=$HOST"
if [ -z "$DATABASE_URL" ]; then
  echo "[FATAL] DATABASE_URL is empty in container"
  exit 1
fi
set +e
npx prisma migrate deploy
st=$?
if [ "$st" -ne 0 ]; then
  echo "[boot] migrate_recover status=$st"
  npx prisma migrate resolve --rolled-back 20260831_external_connections
  npx prisma migrate deploy
  st=$?
fi
set -e
if [ "$st" -ne 0 ]; then
  echo "[FATAL] prisma migrate deploy failed"
  exit 1
fi
echo "[boot] migrate_ok"
exec ./node_modules/.bin/tsx server/index.ts

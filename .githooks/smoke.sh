#!/bin/sh
# Boots an image and requires /health, mirroring the CI smoke test.
# Usage: .githooks/smoke.sh <image>   (SMOKE_PORT / SMOKE_NAME override defaults)
#
# Shared by .github/workflows/ci.yml and .githooks/pre-push so CI and the
# pre-push gate check exactly the same thing.
set -e

IMAGE="${1:-crm-api:local}"
NAME="${SMOKE_NAME:-crm-smoke}"
PORT="${SMOKE_PORT:-3000}"

docker rm -f "$NAME" > /dev/null 2>&1 || true
docker run -d --name "$NAME" -p "$PORT:3000" \
  -e DATABASE_URL=sqlite:// \
  -e SESSION_SECRET=ci-smoke-secret-not-for-production \
  "$IMAGE" > /dev/null

i=0
while [ "$i" -lt 30 ]; do
  if curl -sf "http://localhost:$PORT/health" > /dev/null; then
    echo "container is healthy ($IMAGE on port $PORT)"
    docker logs "$NAME"
    docker rm -f "$NAME" > /dev/null
    exit 0
  fi
  i=$((i + 1))
  sleep 1
done

echo "container never became healthy:"
docker logs "$NAME" || true
docker rm -f "$NAME" > /dev/null
exit 1

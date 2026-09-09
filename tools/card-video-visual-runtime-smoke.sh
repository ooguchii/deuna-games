#!/usr/bin/env bash
set -euo pipefail

if [[ "${CI:-}" != "true" || -z "${GITHUB_ENV:-}" ]]; then
  echo "Card video visual runtime smoke sólo puede ejecutarse en CI." >&2
  exit 1
fi

if [[ -z "${DEUNA_VISUAL_APP_PID:-}" || -z "${DEUNA_VISUAL_BASE_URL:-}" ]]; then
  echo "Falta el runtime visual base antes de preparar el fixture Card video." >&2
  exit 1
fi

export DEUNA_CARD_VIDEO_VISUAL_FIXTURE=1
npx tsx ./tools/card-video-visual-fixture.ts

kill "$DEUNA_VISUAL_APP_PID" 2>/dev/null || true
for _ in $(seq 1 50); do
  if ! kill -0 "$DEUNA_VISUAL_APP_PID" 2>/dev/null; then
    break
  fi
  sleep 0.1
done

export NODE_ENV=production
export HOSTNAME=127.0.0.1
export PORT=3000

node .next/standalone/server.js >> "$RUNNER_TEMP/deuna-visual-standalone.log" 2>&1 &
app_pid=$!
printf 'DEUNA_VISUAL_APP_PID=%s\n' "$app_pid" >> "$GITHUB_ENV"

for attempt in $(seq 1 90); do
  if curl --insecure --fail --silent --show-error "$DEUNA_VISUAL_BASE_URL/" > /dev/null; then
    DEUNA_CARD_VIDEO_VISUAL_FIXTURE=1 node ./tools/card-video-browser-smoke.mjs
    exit 0
  fi

  if ! kill -0 "$app_pid" 2>/dev/null; then
    cat "$RUNNER_TEMP/deuna-visual-standalone.log"
    exit 1
  fi

  sleep 1
done

cat "$RUNNER_TEMP/deuna-visual-standalone.log"
echo "::error::El runtime visual no reinició para el fixture Card video."
exit 1

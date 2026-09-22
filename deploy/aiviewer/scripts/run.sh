#!/usr/bin/env bash
set -euo pipefail

# Report missing names only, never credential values.
for name in AGORA_APP_ID DIFY_API_KEY DIFY_BASE_URL LOG_PATH SERVER_PORT \
  WORKERS_MAX WORKER_QUIT_TIMEOUT_SECONDS BYTEDANCE_ASR_APP_ID \
  BYTEDANCE_ASR_TOKEN BYTEDANCE_TTS_APPID BYTEDANCE_TTS_TOKEN \
  BYTEDANCE_TTS_RESOURCE_ID; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
done

mkdir -p "$LOG_PATH"
setsid task -t /app/Taskfile.deploy.yml api &
api_pid=$!
setsid task -t /app/Taskfile.deploy.yml frontend &
frontend_pid=$!

cleanup() {
  trap - EXIT INT TERM
  # Signal complete service process groups, including Node and worker children.
  kill -TERM -- "-$api_pid" "-$frontend_pid" 2>/dev/null || true
  for ((attempt = 0; attempt < 50; attempt++)); do
    if ! kill -0 -- "-$api_pid" "-$frontend_pid" 2>/dev/null; then
      break
    fi
    sleep 0.1
  done
  kill -KILL -- "-$api_pid" "-$frontend_pid" 2>/dev/null || true
  wait "$api_pid" "$frontend_pid" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 0' INT TERM

# Restart the whole container if either long-running service exits, even with 0.
wait -n "$api_pid" "$frontend_pid" || true
echo 'An application service exited; stopping the container.' >&2
exit 1

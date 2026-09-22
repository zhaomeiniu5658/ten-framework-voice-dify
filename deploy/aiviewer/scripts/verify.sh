#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose ps
docker compose exec -T app curl -fsS http://127.0.0.1:8080/health
docker compose exec -T app curl -fsS http://127.0.0.1:3000 -o /dev/null
curl -fLsS --max-time 20 -o /dev/null -w 'Interview HTTPS: %{http_code}\n' https://aiviewer.ai.maypharm.cn
curl -fLsS --max-time 20 -o /dev/null -w 'Existing new-api: %{http_code}\n' https://kuake.api.maypharm.cn
curl -fLsS --max-time 20 -o /dev/null -w 'Existing Dify: %{http_code}\n' http://101.200.145.196:8888
echo 'HTTP checks passed; also verify voice, Dify Chatflow, certificate renewal and restart recovery.'

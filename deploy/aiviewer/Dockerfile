FROM ghcr.io/ten-framework/ten_agent_build:0.7.14

WORKDIR /app
COPY ai_agents/.env.example /app/.env
COPY ai_agents/server/ /app/server/
COPY ai_agents/agents/ten_packages/extension/bytedance_llm_based_asr/ /app/agents/ten_packages/extension/bytedance_llm_based_asr/
COPY ai_agents/agents/ten_packages/extension/bytedance_tts_duplex/ /app/agents/ten_packages/extension/bytedance_tts_duplex/
COPY ai_agents/agents/ten_packages/extension/dify_llm2_python/ /app/agents/ten_packages/extension/dify_llm2_python/
COPY ai_agents/agents/ten_packages/extension/message_collector2/ /app/agents/ten_packages/extension/message_collector2/
COPY ai_agents/agents/examples/demo/frontend/ /app/agents/examples/demo/frontend/
COPY ai_agents/agents/examples/demo/Taskfile.yml /app/agents/examples/demo/Taskfile.yml
COPY ai_agents/agents/examples/demo/tenapp/go.* ai_agents/agents/examples/demo/tenapp/main.go ai_agents/agents/examples/demo/tenapp/manifest.json ai_agents/agents/examples/demo/tenapp/property.json /app/agents/examples/demo/tenapp/
COPY ai_agents/agents/examples/demo/tenapp/scripts/ /app/agents/examples/demo/tenapp/scripts/
COPY ai_agents/agents/examples/demo/tenapp/ten_packages/extension/main_cascade_python/ /app/agents/examples/demo/tenapp/ten_packages/extension/main_cascade_python/
COPY deploy/aiviewer/prepare.py /tmp/prepare-interview.py
COPY deploy/aiviewer/Taskfile.yml /app/Taskfile.deploy.yml

# Narrow the graph and dependencies in this image only; source config stays intact.
RUN python3 /tmp/prepare-interview.py /app/agents/examples/demo/tenapp \
    && chmod +x /app/agents/examples/demo/tenapp/scripts/*.sh
WORKDIR /app/agents/examples/demo
RUN task install > /tmp/interview-build.log 2>&1 \
    || { tail -n 80 /tmp/interview-build.log; exit 1; }
RUN AGENT_SERVER_URL=http://127.0.0.1:8080 NEXT_PUBLIC_EDIT_GRAPH_MODE=false \
    NEXT_TELEMETRY_DISABLED=1 task build-frontend-prod
RUN rm -f /app/.env
COPY deploy/aiviewer/scripts/run.sh /app/run-interview.sh

ENV NODE_ENV=production
EXPOSE 3000
CMD ["task", "-t", "/app/Taskfile.deploy.yml", "run"]

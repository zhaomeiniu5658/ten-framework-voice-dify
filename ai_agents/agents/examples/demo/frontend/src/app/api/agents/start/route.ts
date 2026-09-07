import axios from "axios";
import { type NextRequest, NextResponse } from "next/server";
import { getGraphProperties } from "./graph";

const DEFAULT_DIFY_BASE_URL = "http://dify-api-1:5001/v1";
const SECRET_KEYS = new Set([
  "api_key",
  "token",
  "secret",
  "password",
  "app_certificate",
]);

function redactForLog(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactForLog);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        SECRET_KEYS.has(key.toLowerCase()) ? "<REDACTED>" : redactForLog(entry),
      ])
    );
  }

  return value;
}

function normalizeDifyBaseUrl(baseUrl: string | undefined): string {
  const resolved = (baseUrl || DEFAULT_DIFY_BASE_URL).trim();
  if (resolved.includes("dify-nginx-1")) {
    return DEFAULT_DIFY_BASE_URL;
  }

  return resolved;
}
/**
 * Handles the POST request to start an agent.
 *
 * @param request - The NextRequest object representing the incoming request.
 * @returns A NextResponse object representing the response to be sent back to the client.
 */
export async function POST(request: NextRequest) {
  try {
    const {
      AGENT_SERVER_URL,
      DIFY_API_KEY,
      DIFY_BASE_URL,
      DIFY_CHATFLOW_API_KEY,
    } = process.env;

    // Check if environment variables are available
    if (!AGENT_SERVER_URL) {
      throw "Environment variables are not available";
    }

    const body = await request.json();
    const {
      request_id,
      channel_name,
      user_uid,
      graph_name,
      language,
      voice_type,
      character_id,
      prompt,
      greeting,
      properties: clientProperties,
      coze_token,
      coze_bot_id,
      coze_base_url,
      dify_api_key,
      dify_base_url,
      oceanbase_settings,
    } = body;
    const normalizedGraphName =
      graph_name === "va_openai_v2v_1_5" ? "va_openai_v2v" : graph_name;

    // Build graph overrides (server-side defaults), then merge any client-provided overrides.
    // This enables clients (e.g. the Live2D voice-assistant) to override TTS voice_id,
    // greetings, prompts, etc. even when the graph isn't explicitly handled in graph.ts.
    let properties: any = getGraphProperties(
      graph_name,
      language,
      voice_type,
      character_id,
      prompt,
      greeting,
      oceanbase_settings
    );

    if (clientProperties && typeof clientProperties === "object") {
      properties = {
        ...properties,
        ...(clientProperties as Record<string, unknown>),
      };
    }
    if (graph_name.includes("coze")) {
      properties.llm.token = coze_token;
      properties.llm.bot_id = coze_bot_id;
      properties.llm.base_url = coze_base_url;
    }
    if (graph_name.includes("dify")) {
      const resolvedDifyApiKey =
        (DIFY_CHATFLOW_API_KEY || dify_api_key || DIFY_API_KEY || "").trim();
      const resolvedDifyBaseUrl = normalizeDifyBaseUrl(
        dify_base_url || DIFY_BASE_URL
      );

      if (!resolvedDifyApiKey) {
        return NextResponse.json(
          {
            code: "1",
            data: null,
            msg: "Dify API key is not configured",
          },
          { status: 400 }
        );
      }

      properties.llm.api_key = resolvedDifyApiKey;
      properties.llm.base_url = resolvedDifyBaseUrl;
    }

    console.log(
      `Starting agent for request ID: ${JSON.stringify({
        request_id,
        channel_name,
        user_uid,
        graph_name: normalizedGraphName,
        // Get the graph properties based on the graph name, language, and voice type
        properties: redactForLog(properties),
      })}`
    );

    console.log(`AGENT_SERVER_URL: ${AGENT_SERVER_URL}/start`);

    // Send a POST request to start the agent
    const response = await axios.post(`${AGENT_SERVER_URL}/start`, {
      request_id,
      channel_name,
      user_uid,
      graph_name: normalizedGraphName,
      character_id,
      timeout: -1,
      // Get the graph properties based on the graph name, language, and voice type
      properties,
    });

    const responseData = response.data;

    return NextResponse.json(responseData, { status: response.status });
  } catch (error) {
    if (error instanceof Response) {
      const errorData = await error.json();
      return NextResponse.json(errorData, { status: error.status });
    } else {
      console.error(`Error starting agent: ${error}`);
      return NextResponse.json(
        { code: "1", data: null, msg: "Internal Server Error" },
        { status: 500 }
      );
    }
  }
}

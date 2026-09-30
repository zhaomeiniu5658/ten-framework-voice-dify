import axios from "axios";
import { resolveVolcengineVoice } from "@/lib/volcengine/voices";
import { createInterview } from "@/lib/interview/store";
import { z } from "zod";
import { type NextRequest, NextResponse } from "next/server";
import { getGraphProperties } from "./graph";

const DEFAULT_DIFY_BASE_URL = "http://dify-api-1:5001/v1";
const SECRET_KEYS = new Set([
  "api_key",
  "token",
  "secret",
  "password",
  "app_certificate",
  "candidate_name",
  "candidate_resume",
  "candidate_position",
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
    const candidate = z.object({ name: z.string().trim().max(80).default(""), resume: z.string().trim().max(20000).default(""), position: z.string().trim().max(80).optional(), interviewType: z.enum(["personality", "cra", "clinical_pm"]).default("cra") }).safeParse(body.candidate || {});
    if (!candidate.success) return NextResponse.json({ code: "1", msg: "本次面试者资料格式无效" }, { status: 400 });
    const {
      request_id,
      channel_name,
      user_uid,
      graph_name,
      language,
      voice_type,
      volcengine_voice_id,
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
    if (graph_name === "va_dify_azure") {
      try {
        const voice = await resolveVolcengineVoice(volcengine_voice_id, voice_type);
        properties.tts = { ...properties.tts, params: { ...properties.tts?.params,
          speaker: voice.id, resource_id: voice.resourceId,
        } };
      } catch (error) {
        return NextResponse.json({ code: "1", data: null, msg: error instanceof Error ? error.message : "音色选择无效" }, { status: 400 });
      }
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
        DIFY_BASE_URL || dify_base_url
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

      properties.llm.candidate_name = candidate.data.name;
      properties.llm.candidate_resume = candidate.data.resume;
      properties.llm.candidate_position = candidate.data.position || "";
      properties.llm.interview_type = candidate.data.interviewType;
      if (candidate.data.interviewType === "personality") {
        properties.main_control = {
          ...properties.main_control,
          greeting: "接下来我会通过几个日常工作和沟通场景，进一步了解你的工作习惯和行为偏好。这里没有标准答案，请按照你平时最自然、最常见的做法回答即可。",
          // Personality answers are usually short scenario choices. The
          // clinical-PM defaults (3s / 5.5s) make every answer feel stalled.
          // Keep a small pause to merge a trailing ASR fragment without
          // making the candidate wait several seconds before the next prompt.
          asr_final_debounce_ms: 900,
          asr_short_answer_debounce_ms: 1500,
        };
      }
      properties.llm.prompt = "";
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
    if (graph_name.includes("dify") && [0, "0"].includes(responseData.code)) {
      responseData.interview_session_id = await createInterview(candidate.data);
    }

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

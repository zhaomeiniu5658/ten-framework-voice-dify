import { createHash, createHmac } from "node:crypto";
import snapshot from "./catalog.json";

export type VolcengineVoice = {
  id: string;
  name: string;
  resourceId: string;
  language: string;
  category: string;
};

const DEFAULT_VOICE = "zh_male_baqiqingshu_uranus_bigtts";
function configuredResource() {
  const resource = process.env.BYTEDANCE_TTS_RESOURCE_ID || "seed-tts-2.0";
  return resource === "volc.service_type.10029" ? "seed-tts-1.0" : resource;
}
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const hmac = (key: string | Buffer, text: string) =>
  createHmac("sha256", key).update(text).digest();

// OpenAPI credentials are distinct from the speech App ID / access token.
async function listSpeakers(resourceId: string): Promise<VolcengineVoice[]> {
  const accessKey = process.env.VOLCENGINE_ACCESS_KEY_ID!;
  const secretKey = process.env.VOLCENGINE_SECRET_ACCESS_KEY!;
  const voices: VolcengineVoice[] = [];
  for (let page = 1; page <= 100; page++) {
    const body = JSON.stringify({ ResourceIDs: [resourceId], Page: page, Limit: 100 });
    const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const scope = `${date.slice(0, 8)}/cn-beijing/speech_saas_prod/request`;
    const signedHeaders = "host;x-content-sha256;x-date";
    const query = "Action=ListSpeakers&Version=2025-05-20";
    const canonical = ["POST", "/", query,
      `host:open.volcengineapi.com\nx-content-sha256:${hash(body)}\nx-date:${date}\n`,
      signedHeaders, hash(body)].join("\n");
    const key = hmac(hmac(hmac(hmac(secretKey, date.slice(0, 8)), "cn-beijing"), "speech_saas_prod"), "request");
    const signature = hmac(key, `HMAC-SHA256\n${date}\n${scope}\n${hash(canonical)}`).toString("hex");
    const response = await fetch(`https://open.volcengineapi.com/?${query}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Date": date,
        "X-Content-Sha256": hash(body),
        Authorization: `HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      },
      body, cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    const data = await response.json();
    if (!response.ok || data.ResponseMetadata?.Error || !Array.isArray(data.Result?.Speakers)) {
      throw new Error("Volcengine voice catalog unavailable");
    }
    for (const speaker of data.Result.Speakers) {
      if (typeof speaker.VoiceType !== "string" || !speaker.VoiceType) continue;
      if (snapshot.excludedDuplexVoices.includes(speaker.VoiceType)) continue;
      const known = snapshot.voices.find(v => v.id === speaker.VoiceType);
      voices.push({
        id: speaker.VoiceType,
        name: typeof speaker.Name === "string" ? speaker.Name : speaker.VoiceType,
        resourceId, language: known?.language || "", category: known?.category || "",
      });
    }
    if (page * 100 >= data.Result.Total || !data.Result.Speakers.length) return voices;
  }
  throw new Error("Volcengine voice catalog pagination exceeded");
}

type VoiceCatalog = {
  voices: VolcengineVoice[];
  source: "openapi" | "official-snapshot";
  updatedAt: string;
  notice: string;
};
let cached: { expires: number; data: VoiceCatalog } | undefined;
let pending: Promise<VoiceCatalog> | undefined;

export async function getVoiceCatalog(): Promise<VoiceCatalog> {
  if (cached && cached.expires > Date.now()) return cached.data;
  if (pending) return pending;
  pending = (async () => {
    let data: VoiceCatalog = {
      voices: snapshot.voices, source: "official-snapshot", updatedAt: snapshot.updatedAt,
      notice: "官方公开音色目录；可用性以当前火山账号已开通服务为准。",
    };
    if (process.env.VOLCENGINE_ACCESS_KEY_ID && process.env.VOLCENGINE_SECRET_ACCESS_KEY) {
      try {
        const lists = await Promise.all([listSpeakers(configuredResource())]);
        const voices = [...new Map(lists.flat().map(v => [v.id, v])).values()];
        if (!voices.length) throw new Error("Empty catalog");
        data = { voices, source: "openapi", updatedAt: new Date().toISOString(), notice: "已从火山引擎同步音色目录；可用性以账号已开通服务为准。" };
      } catch {
        data.notice = "实时同步暂不可用，正在使用官方音色目录。";
      }
    }
    // A public voice list does not grant access to another billed model service.
    data.voices = data.voices.filter(v => v.resourceId === configuredResource());
    cached = { expires: Date.now() + (data.source === "openapi" ? 3600000 : 60000), data };
    return data;
  })();
  try { return await pending; } finally { pending = undefined; }
}

export async function resolveVolcengineVoice(id: unknown, voiceType = "male") {
  const catalog = await getVoiceCatalog();
  const defaultId = voiceType === "female" ? "zh_female_shuangkuaisisi_uranus_bigtts" : DEFAULT_VOICE;
  const requested = id === undefined || id === ""
    ? (catalog.voices.find(v => v.id === defaultId)?.id || catalog.voices[0]?.id)
    : id;
  if (typeof requested !== "string") throw new Error("请选择有效的火山音色");
  const voice = catalog.voices.find(v => v.id === requested);
  if (!voice) throw new Error("该音色已不在目录中，请重新选择");
  return voice;
}

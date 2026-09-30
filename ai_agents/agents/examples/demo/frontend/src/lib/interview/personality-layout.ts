/** Presentation adapter for both existing Markdown reports and the current prompt. */
export type PersonalitySection = { title: string; text: string };
export const personalityAxes = [
  { name: "能量", left: "外向", right: "内向", color: "#429bb5", match: /外向|内向|能量|E\s*[\/／-]\s*I/i, leftMatch: /外向|\bE\b/i, rightMatch: /内向|\bI\b/i },
  { name: "心智", left: "关注可能性", right: "关注具体事实", color: "#e4af35", match: /具体|抽象|心智|感觉|直觉|S\s*[\/／-]\s*N/i, leftMatch: /抽象|直觉|可能性|整体|\bN\b/i, rightMatch: /具体|事实|实感|感觉|细节|\bS\b/i },
  { name: "天性", left: "逻辑分析", right: "情感与共识", color: "#56a58a", match: /逻辑|情感|天性|思考|T\s*[\/／-]\s*F/i, leftMatch: /逻辑|理性|思考|效率|\bT\b/i, rightMatch: /情感|共识|感受|\bF\b/i },
  { name: "应对方式", left: "计划安排", right: "灵活应变", color: "#9268a6", match: /计划|灵活|应对|判断|知觉|J\s*[\/／-]\s*P/i, leftMatch: /计划|安排|判断|\bJ\b/i, rightMatch: /灵活|应变|知觉|\bP\b/i },
];
const clean = (s: string) => s.replace(/\*\*/g, "").trim();
export function parsePersonalityReport(text: string) {
  const sections: PersonalitySection[] = [];
  for (const line of text.split("\n")) {
    if (/^#\s/.test(line)) continue;
    if (/^##\s/.test(line)) sections.push({ title: clean(line.replace(/^##\s/, "")), text: "" });
    else { if (!sections.length) sections.push({ title: "说明", text: "" }); sections[sections.length - 1].text += `${line}\n`; }
  }
  const get = (pattern: RegExp) => sections.filter(s => pattern.test(s.title)).map(s => s.text.trim()).filter(Boolean).join("\n\n");
  const overview = get(/类型概览|人格概览/);
  // A headline type is accepted only from an explicit result, never from an example in prose.
  const typeLine = overview.split("\n").map(clean).find(l => /^(?:[-*]\s*)?(?:初步)?(?:人格类型|类型倾向|本次类型|类型)[：:]/.test(l));
  const code = typeLine && !/不足|待确认|无法|不能|不确定/.test(typeLine) ? typeLine.match(/\b[EI][SN][TF][JP]\b/i)?.[0].toUpperCase() : undefined;
  const nameLine = overview.split("\n").map(clean).find(l => /^(?:[-*]\s*)?画像名称[：:]/.test(l));
  const name = code && nameLine ? nameLine.replace(/^(?:[-*]\s*)?画像名称[：:]\s*/, "") : "你的行为偏好画像";
  const summary = overview.split("\n").filter(l => !/^(?:[-*]\s*)?(?:初步)?(?:人格类型|类型倾向|本次类型|类型|画像名称)[：:]/.test(clean(l))).join("\n").trim();
  const dimensions = get(/四维偏好|人格特征/);
  const rows = dimensions.split("\n").filter(l => l.trim().startsWith("|") && !/^\|[\s:|\-]+\|$/.test(l.trim())).map(l => l.trim().replace(/^\||\|$/g, "").split("|").map(clean));
  const traits = personalityAxes.map(axis => {
    const row = rows.find(r => axis.match.test(r[0]) && r[1] !== "本次倾向");
    const preference = row?.[1] || "资料不足";
    const uncertain = /不足|无法|不确定|均衡|兼有|两者|待确认|不明显|无明显|未定/.test(preference);
    const left = axis.leftMatch.test(preference), right = axis.rightMatch.test(preference);
    const direction = uncertain || left === right ? "unknown" : left ? "left" : "right";
    return { ...axis, preference, direction, evidence: row?.[2] || "本次访谈尚未提供充分证据。", interpretation: row?.[3] || "暂不判断该维度倾向。" };
  });
  const known = /说明|类型概览|人格概览|四维偏好|人格特征|典型优势|你的强项|可能的盲点|你的短板|工作方式|职业道路|个人成长|人际关系|证据边界/;
  return { code, name, summary, traits, strengths: get(/典型优势|你的强项/), blindSpots: get(/可能的盲点|你的短板/), career: get(/工作方式|职业道路/), growth: get(/个人成长/), relationships: get(/人际关系/), boundaries: get(/证据边界/), extra: sections.filter(s => !known.test(s.title) && s.text.trim()) };
}

export function personalityCards(text: string): PersonalitySection[] {
  if (!text.trim()) return [];
  if (/^###\s/m.test(text)) {
    const parts = text.split(/(?=^###\s)/m);
    return parts.filter(s => s.trim()).map(part => {
      const heading = part.match(/^###\s+(.+)\n/);
      return { title: heading ? clean(heading[1]) : "行为观察", text: heading ? part.slice(heading[0].length).trim() : part.trim() };
    });
  }
  return text.split(/\n\s*\n|\n(?=[-*]\s)/).filter(s => s.trim()).map(part => {
    const item = part.trim().replace(/^[-*]\s/, "");
    const match = item.match(/^(?:\*\*([^*]+)\*\*|([^：:\n]{2,24})[：:])[：:]?\s*([\s\S]*)$/);
    return match ? { title: (match[1] || match[2]).replace(/[：:]$/, ""), text: match[3] } : { title: "行为观察", text: item };
  });
}

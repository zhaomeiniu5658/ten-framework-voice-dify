export type Turn = { role: "user" | "assistant"; text: string; time: number };
export type Candidate = { name: string; resume: string };
export const REPORT_VERSION = 2;
export const UNKNOWN_CANDIDATE = "未提供姓名";

export function hasCandidateAnswer(turns: Turn[]) {
  return turns.some(turn => {
    if (turn.role !== "user") return false;
    const text = turn.text.replace(/[\s，。！？、,.!?]/g, "");
    return text && !/^(?:好的?|嗯+|哦+|你好|您好|hello|hi|准备好了|开始吧|结束面试|停止面试|面试结束|今天面试到这里吧|结束|停止|再见)$/i.test(text);
  });
}

// Only explicit self-identification is used; never infer identity from interviewer text.
export function candidateFromTurns(turns: Turn[]): string | undefined {
  for (const turn of turns) {
    if (turn.role !== "user") continue;
    const match = turn.text.match(/(?:我叫|我的名字是|姓名[：:])\s*([\p{L}·]{2,20})(?=[\s，。,.！!]|$)/u)
      || turn.text.match(/(?:^|[，。,.])\s*我是\s*([\p{Script=Han}·]{2,4})(?=[，。,.]|$)/u);
    if (match && !/(?:经理|工程师|医生|护士|负责|候选人|面试者|面试官|研究|今天|刚才)/.test(match[1])) return match[1];
  }
}

export function transcriptFromItems(items: { type: string; data_type?: string; text: string; time: number; isFinal?: boolean }[]): Turn[] {
  return items.filter(item => item.data_type === "text" && item.text.trim())
    .filter(item => item.type === "user" || item.isFinal !== false)
    .map(item => ({ role: item.type === "user" ? "user" : "assistant", time: item.time,
      text: item.text + (item.type === "user" && item.isFinal === false ? "（断开时尚未确认的转写）" : "") }));
}

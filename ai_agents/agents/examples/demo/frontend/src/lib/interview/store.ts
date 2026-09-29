import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeInterview, type Turn } from "./report";
import { candidateFromTurns, hasCandidateAnswer, REPORT_VERSION, UNKNOWN_CANDIDATE, type Candidate } from "./session";

export type Interview = {
  id: string; status: "interviewing" | "completed" | "analyzing" | "ready" | "failed";
  candidateName?: string;
  candidate?: Candidate; reportVersion?: number;
  createdAt: string; endedAt?: string; updatedAt: string;
  transcript: Turn[]; markdown?: string; error?: string;
};
const root = process.env.INTERVIEW_REPORT_DIR || join(tmpdir(), "ten-interview-reports");
const validId = (id: string) => /^[a-f0-9-]{36}$/.test(id);
const active = new Map<string, Promise<void>>();
async function save(value: Interview) {
  await mkdir(root, { recursive: true, mode: 0o700 });
  const temporary = join(root, `${value.id}.${randomUUID()}.tmp`);
  await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
  await rename(temporary, join(root, `${value.id}.json`));
}
export async function createInterview(candidate: Candidate = { name: "", resume: "" }) {
  const now = new Date().toISOString();
  const value: Interview = { id: randomUUID(), status: "interviewing", createdAt: now,
    candidate: { ...candidate }, candidateName: candidate.name || UNKNOWN_CANDIDATE,
    reportVersion: REPORT_VERSION, updatedAt: now, transcript: [] };
  await save(value);
  return value.id;
}
export async function readInterview(id: string): Promise<Interview | null> {
  if (!validId(id)) return null;
  try {
    const value: Interview = JSON.parse(await readFile(join(root, `${id}.json`), "utf8"));
    if (value.reportVersion !== REPORT_VERSION) {
      // Legacy reports included a global demo resume. Do not present them as current evidence.
      value.candidate = { name: "", resume: "" };
      value.candidateName = candidateFromTurns(value.transcript) || UNKNOWN_CANDIDATE;
      value.markdown = undefined;
      value.status = hasCandidateAnswer(value.transcript) ? "failed" : "completed";
      value.endedAt ||= value.updatedAt || value.createdAt;
      value.error = value.status === "failed" ? "旧版报告包含演示资料，请根据该次面试记录重新分析。" : undefined;
    }
    if (value.status === "analyzing" && Date.now() - Date.parse(value.updatedAt) > 240000) {
      value.status = "failed";
      value.error = "分析任务中断，请点击重新分析。";
    }
    return value;
  } catch { return null; }
}
const finishing = new Map<string, Promise<Interview | null>>();
export async function finishInterview(id: string, turns: Turn[], retry = false) {
  const previous = finishing.get(id);
  if (previous) return previous;
  const task = finishOnce(id, turns, retry);
  finishing.set(id, task);
  try { return await task; } finally { finishing.delete(id); }
}
async function finishOnce(id: string, turns: Turn[], retry: boolean) {
  const value = await readInterview(id);
  if (!value) return null;
  if (value.status === "interviewing") {
    value.transcript = turns;
    value.endedAt = new Date().toISOString();
  } else if (value.status !== "failed" || !retry) return value;
  value.candidateName = candidateFromTurns(value.transcript) || value.candidate?.name || UNKNOWN_CANDIDATE;
  value.status = hasCandidateAnswer(value.transcript) ? "analyzing" : "completed";
  value.reportVersion = REPORT_VERSION;
  value.markdown = undefined;
  value.error = undefined;
  value.updatedAt = new Date().toISOString();
  await save(value);
  return value;
}
export async function runAnalysis(id: string) {
  if (active.has(id)) return active.get(id);
  const task = (async () => {
    const value = await readInterview(id);
    if (!value || value.status !== "analyzing") return;
    try {
      value.markdown = await analyzeInterview(value.transcript, value.endedAt!, {
        id: value.id, createdAt: value.createdAt, candidateName: value.candidateName || UNKNOWN_CANDIDATE,
        resume: value.candidate?.resume || "",
      });
      value.status = "ready";
    } catch (error) {
      value.status = "failed";
      value.error = error instanceof Error && !/fetch|abort|timeout/i.test(error.message)
        ? error.message : "后台分析暂时失败，请重新分析。";
    }
    value.updatedAt = new Date().toISOString();
    await save(value);
  })();
  active.set(id, task);
  try { await task; } finally { active.delete(id); }
}
export function publicReport(value: Interview) {
  return { id: value.id, status: value.status, markdown: value.status === "ready" ? value.markdown : undefined,
    candidateName: value.candidateName, createdAt: value.createdAt,
    error: value.error, endedAt: value.endedAt, turnCount: value.transcript.length };
}

export async function listInterviews() {
  let files: string[];
  try { files = await readdir(root); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  const records = await Promise.all(files.filter(f => f.endsWith(".json"))
    .map(f => readInterview(f.slice(0, -5))));
  return records.filter((r): r is Interview => r !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(r => ({ id: r.id, createdAt: r.createdAt, endedAt: r.endedAt,
      candidateName: r.candidateName || UNKNOWN_CANDIDATE, status: r.status,
      hasReport: r.status === "ready" && Boolean(r.markdown) }));
}

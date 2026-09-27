import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeInterview, type Turn } from "./report";

export type Interview = {
  id: string; status: "interviewing" | "analyzing" | "ready" | "failed";
  candidateName?: string;
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
export async function createInterview() {
  const now = new Date().toISOString();
  const value: Interview = { id: randomUUID(), status: "interviewing", createdAt: now,
    candidateName: "林予安（演示候选人）", updatedAt: now, transcript: [] };
  await save(value);
  return value.id;
}
export async function readInterview(id: string): Promise<Interview | null> {
  if (!validId(id)) return null;
  try {
    const value: Interview = JSON.parse(await readFile(join(root, `${id}.json`), "utf8"));
    if (value.status === "analyzing" && Date.now() - Date.parse(value.updatedAt) > 240000) {
      value.status = "failed";
      value.error = "分析任务中断，请点击重新分析。";
    }
    return value;
  } catch { return null; }
}
export async function finishInterview(id: string, turns: Turn[], retry = false) {
  const value = await readInterview(id);
  if (!value) return null;
  if (value.status === "interviewing") {
    value.transcript = turns;
    value.endedAt = new Date().toISOString();
  } else if (value.status !== "failed" || !retry) return value;
  value.status = "analyzing";
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
      value.markdown = await analyzeInterview(value.transcript, value.endedAt!);
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
  return { id: value.id, status: value.status, markdown: value.markdown,
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
      candidateName: r.candidateName || "未登记姓名（旧记录）", status: r.status }));
}

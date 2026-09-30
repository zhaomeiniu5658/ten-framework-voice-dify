import reference from "./reference.json";
import type { Turn } from "./session";
export const scoringAnchors: Record<string, [string, string]> = {
  成功愿望: ["偏好可达成的目标", "主动追求挑战性目标"], 权力动机: ["偏好独立完成分工", "主动组织和带领他人"],
  亲和动机: ["较少主动维护关系", "主动建立和维护关系"], 活力: ["偏好稳定工作节奏", "偏好活跃紧凑的工作节奏"],
  创新意识: ["偏好成熟做法", "主动探索新做法"], 洞察力: ["主要依据直接现象", "分析原因及内在联系"],
  决断的: ["倾向等待和反复权衡", "及时作出选择并承担决定"], 理性的: ["更依赖感受和关系考量", "更依赖事实和逻辑分析"],
  乐观的: ["更关注不利可能", "更关注改善机会"], 抗压性: ["压力下节奏容易受影响", "压力下仍能保持工作节奏"],
  情绪稳定性: ["情绪起伏较明显", "反应平稳"], 适应性: ["沿用习惯的应对方式", "按环境和对象调整做法"],
  社交自信: ["正式交流时更谨慎拘束", "正式交流时自然自如"], 影响的: ["较少主动说服他人", "主动表达理由推动共识"],
  同理心: ["主要从自身任务角度出发", "主动理解他人处境和感受"], 支持性: ["优先专注个人任务", "主动帮助他人"],
  责任感: ["偏好明确限定责任范围", "主动承担责任并跟进承诺"], 审慎的: ["先行动再调整", "行动前权衡影响和风险"],
  条理性: ["随现场情况灵活推进", "偏好计划流程和有序推进"], 意志力: ["遇阻较快放下或调整目标", "遇阻后持续投入并寻求办法"],
};
export const SCORING_GUIDE = `采用1—10分访谈行为倾向评分，不是常模标准分，不生成百分位。可用0.5分间隔。高低分代表两端行为倾向，不代表优劣、能力水平或录用结论。
1—3.5分偏低端，4—5分较偏低端，5.5—6.5分较偏高端，7—10分偏高端。极端的1或10分只用于多次具体情境一致的表现。分数不衡量回答字数或材料多少，不能因回答短而扣分。
仅依据本次候选人的实际行为自述打分。只有假设情境、泛泛自评或本次未涉及时填“未评分”，不能默认给0、5或其他分数。两端冲突时解释场景，无法判断则未评分。每个有效分数引用实际候选人回答的[T数字]。
评分锚点（低分端→高分端）：
${reference.dimensions.map(d => `${d.area}/${d.name}：${scoringAnchors[d.name].join(" → ")}`).join("\n")}`;
export function parseInterviewScore(value: string): number | null {
  const text = value.replace(/\*\*/g, "").trim();
  if (!/^(?:10|[1-9])(?:\.\d)?(?:\s*分)?$/.test(text)) return null;
  const n = Number(text.replace(/\s*分$/, ""));
  return n >= 1 && n <= 10 && Number.isInteger(n * 2) ? n : null;
}
export function hasInterviewScores(text = ""): boolean {
  return /^\|\s*方面\s*\|\s*维度\s*\|\s*访谈评分\s*\|/m.test(text);
}
export function validateInterviewScores(text: string, turns: Turn[]) {
  const block = text.match(/^##\s+总体结果[^\n]*\n([\s\S]*?)(?=^##\s|$(?![\s\S]))/m)?.[1] || "";
  const rows = block.split("\n").filter(l => l.trim().startsWith("|")).map(l => l.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim()));
  const records = rows.filter(r => reference.dimensions.some(d => d.name === r[1]));
  if (!hasInterviewScores(block) || records.length !== 20 || new Set(records.map(r => r[1])).size !== 20) throw new Error("报告评分表不完整，请重新分析。");
  for (const row of records) {
    if (row[2] === "未评分") continue;
    const citations = [...(row[4] || "").matchAll(/\[T(\d+)\]/g)].map(m => Number(m[1]) - 1);
    if (parseInterviewScore(row[2]) === null || !citations.length || citations.some(i => turns[i]?.role !== "user")) throw new Error("报告评分或回答引用无效，请重新分析。");
  }
}

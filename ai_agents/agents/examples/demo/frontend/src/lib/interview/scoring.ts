import reference from "./reference.json";
import type { Turn } from "./session";

// The two poles and dimension order follow the supplied reference report.
export const scoringAnchors: Record<string, [string, string]> = {
  成功愿望: ["做事心态平和；不强求取得高成就；更看重目标的可实现性；以豁达心态看待输赢", "进取，事业心强；想要取得高成就；愿意设定有挑战性的目标；将输赢看得很重"],
  权力动机: ["支配欲弱；不太愿意指挥他人行动；不喜欢干涉他人工作", "支配欲强；希望管理或激励团队成员；愿意承担领导风险与责任"],
  亲和动机: ["享受独处；与人交往时会保持一定的距离；不会花过多时间维护关系", "希望与人相处；喜欢与人结交并保持亲近；愿意花时间维护友好关系"],
  活力: ["喜欢平稳的节奏；避免同时并行太多事情；忙碌时容易感到疲劳", "喜欢快节奏的工作环境；精力充沛，喜欢参与很多事情；喜欢保持忙碌的状态"],
  创新意识: ["想法比较传统务实；喜欢采用成熟的策略或方法；相信经过验证的方法", "想象力丰富；喜欢尝试新事物或新方法；愿意提出原创性观点或方法"],
  洞察力: ["不习惯追根究底；没有深入挖掘内在联系的习惯；根据事物的直接表象做出判断", "尝试找出问题的本质；习惯深入分析事物内在联系；避免浮于表面现象的判断"],
  决断的: ["决策时常有顾虑；往往显得犹豫不决；避免做出最后的决策", "当机立断；毫不犹豫地做出行为决策；敢于快速做出决策"],
  理性的: ["重视人情与价值观；关注主观感受和人际关系；容易受人情世故影响", "追求理智、公正和客观；关注客观事实和依据；不受人情世故的影响"],
  乐观的: ["担心未来；总想到事情最坏的可能性；关注事情的负面影响", "积极乐观；认为事情会转好；对事物持积极、正向的态度"],
  抗压性: ["对压力敏感；容易担心、焦虑；工作表现会受到压力的影响", "压力耐受度高；冷静镇定；压力下依然可以正常完成工作"],
  情绪稳定性: ["情绪易受到外界影响；情绪的起伏和波动较大；情绪反应比较明显", "情绪平缓、稳定；情绪的起伏和波动较小；情绪反应不外露"],
  适应性: ["保持一致的行为习惯；喜欢相对固定的环境；应对他人的方式单一", "愿意改变自己的行为；主动适应多变的环境；对不同的人采用不同的方式"],
  社交自信: ["与人交往时紧张、焦虑；与人初次见面或在正式的社交场合中，会感到局促不安", "与人交往时轻松、自在；与人初次见面或在正式的社交场合中，都能自如应对"],
  影响的: ["尊重他人观点的独立性；不愿对他人施加影响；不喜欢左右他人的看法", "喜欢推销自己的观点；愿意对他人施加影响；用令人信服的观点说服他人"],
  同理心: ["难以理解他人的情绪和感受；习惯从自己的立场、视角思考和处理问题", "理解他人的情绪和感受；习惯换位思考，愿意站在对方的立场思考和处理问题"],
  支持性: ["避免卷入到他人的事情中；更关注自己任务的完成情况；较少主动提供帮助", "关心他人面临的问题；支持他人解决困难；愿意主动提供帮助"],
  责任感: ["对达成目标的使命感不强；避免承担很多职责外的任务；认为承诺过的事情也有可商量的余地", "尽职尽责；愿意主动承担责任；认为必须要按时完成承诺过的事情"],
  审慎的: ["行事略显草率；行动前不过多考虑后果；往往未考虑成熟便采取行动", "做事审慎周密；行动前深思熟虑，考虑周全；三思而后行，不冲动"],
  条理性: ["认为固定的程序会限制发挥；强调即兴发挥；喜欢根据情况随时做调整", "喜欢程序化的工作方式；重视计划和流程；希望按计划、有条不紊地工作"],
  意志力: ["遇到挫折容易放弃；努力的热情不够持续；克服困难的信念不强", "意志力强，不轻言放弃；为达成目标坚持不懈；努力克服各种困难实现目标"],
};
export const SCORING_GUIDE = `采用1—10分访谈行为倾向评分，允许一位小数，不是常模标准分，不生成百分位。高低分代表两端行为倾向，不代表优劣、能力水平或录用结论。
1≤分数<4为低分，4≤分数<5.5为中低，5.5≤分数<7为中高，7≤分数≤10为高分。极端的1或10分只用于多次情境一致的表现。中间分数根据实际行为相对两端特征的位置判断，不能根据回答长短或材料数量给分。
综合本次候选人对工作习惯、实际做法和场景选择的回答评分。假设选择应按其自述偏好理解，不能编造已发生经历。泛泛的自我夸奖、只有简历线索或本次未涉及的维度填“未评分”，不能默认给0、5或其他分数。每个有效分数在总体表回答索引列引用实际候选人回答的[T数字]。
评分锚点（固定顺序；低分特征 → 高分特征）：
${reference.dimensions.map(d => `${d.area}/${d.name}：${scoringAnchors[d.name].join(" → ")}`).join("\n")}`;

export function parseInterviewScore(value: string): number | null {
  const text = value.replace(/\*\*/g, "").trim();
  if (!/^(?:10(?:\.0)?|[1-9](?:\.\d)?)(?:\s*分)?$/.test(text)) return null;
  return Number(text.replace(/\s*分$/, ""));
}
export function hasInterviewScores(text = ""): boolean {
  return /^\|\s*方面\s*\|\s*维度\s*\|\s*访谈评分\s*\|/m.test(text);
}
function tableRows(text: string): string[][] {
  return text.split("\n").filter(l => l.trim().startsWith("|"))
    .map(l => l.trim().replace(/^\||\|$/g, "").split("|").map(c => c.replace(/\*\*/g, "").trim()));
}
export function validateInterviewScores(text: string, turns: Turn[]) {
  if (/证据(?:不?充分(?:度)?|不足)|证据边界/.test(text)) throw new Error("报告未使用评分格式，请重新分析。");
  const sections = text.split(/^##\s+/m).slice(1).map(s => ({ title: s.split("\n")[0].trim(), text: s.slice(s.indexOf("\n") + 1) }));
  const titles = ["前言", "阅读原则", "总体结果", "综合评价", "详细结果", "附录"];
  if (sections.length !== titles.length || sections.some((s, i) => !s.title.startsWith(titles[i]))) throw new Error("报告章节不完整，请重新分析。");
  const overview = sections[2].text;
  const rows = tableRows(overview);
  if (rows[0]?.join("|") !== "方面|维度|访谈评分|回答索引") throw new Error("报告评分表格式不正确，请重新分析。");
  const records = rows.slice(2);
  if (records.length !== 20) throw new Error("报告评分表不完整，请重新分析。");
  for (const [index, row] of records.entries()) {
    const dimension = reference.dimensions[index];
    if (row.length !== 4 || row[0] !== dimension.area || row[1] !== dimension.name) throw new Error("报告维度顺序不正确，请重新分析。");
    if (row[2] === "未评分") continue;
    const citations = [...row[3].matchAll(/\[T(\d+)\]/g)].map(m => Number(m[1]) - 1);
    if (parseInterviewScore(row[2]) === null || !citations.length || citations.some(i => turns[i]?.role !== "user" || !turns[i].text.trim())) throw new Error("报告评分或回答引用无效，请重新分析。");
  }
  const detailSections = sections[4].text.split(/^###\s+/m).slice(1);
  const areas = [...new Set(reference.dimensions.map(d => d.area))];
  if (detailSections.length !== 5) throw new Error("报告详细结果不完整，请重新分析。");
  for (const [index, section] of detailSections.entries()) {
    if (section.split("\n")[0].trim() !== `${areas[index]}方面`) throw new Error("报告详细结果方面不正确，请重新分析。");
    const detail = tableRows(section);
    if (detail[0]?.join("|") !== "维度|低分特征|访谈评分|高分特征" || detail.length !== 6) throw new Error("报告详细结果表格不完整，请重新分析。");
    for (const [i, row] of detail.slice(2).entries()) {
      const overall = records[index * 4 + i];
      const score = parseInterviewScore(row[2] || "");
      if (row.length !== 4 || row[0] !== overall[1] || !row[1] || !row[3] || (overall[2] === "未评分" ? row[2] !== "未评分" : score === null || score !== parseInterviewScore(overall[2]))) throw new Error("总体结果与详细结果评分不一致，请重新分析。");
    }
  }
  // References are retained in saved Markdown for traceability, omitted in the paper layout.
  for (const citation of text.matchAll(/\[T(\d+)\]/g)) {
    if (turns[Number(citation[1]) - 1]?.role !== "user") throw new Error("报告引用了非候选人回答，请重新分析。");
  }
}

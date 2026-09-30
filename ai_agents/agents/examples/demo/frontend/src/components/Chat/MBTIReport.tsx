import type { ReactNode } from "react";
import "./InterviewReport.css";
import { PersonalityReport } from "./PersonalityReport";

type Area = "motivation" | "thinking" | "emotion" | "interaction" | "execution" | "neutral";

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") ? <strong key={index} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong> : part,
  );
}

function areaFor(text: string): Area {
  if (text.includes("动机能量")) return "motivation";
  if (text.includes("思维决策")) return "thinking";
  if (text.includes("情感成熟度")) return "emotion";
  if (text.includes("人际互动")) return "interaction";
  if (text.includes("任务执行")) return "execution";
  return "neutral";
}

function cells(row: string): string[] {
  return row.trim().replace(/^\||\|$/g, "").split("|").map((value) => value.trim());
}

function isSeparator(line: string): boolean {
  return /^\|[\s:|\-]+\|$/.test(line.trim());
}

function ReportTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const areaIndex = headers.findIndex(h => h === "方面");
  const comparison = headers.some(h => h.includes("行为倾向A") || h.includes("低分特征"));
  if (comparison) return <div className="report-comparisons">
    {rows.map((row, index) => <div className="report-comparison" key={index}>
      {headers.map((header, i) => <div key={i} className={i < 2 ? "report-pole" : "report-evidence"}>
        <div className="report-cell-label">{inline(header)}</div><div>{inline(row[i] || "—")}</div>
      </div>)}
    </div>)}
  </div>;
  return <div className="report-table-scroll"><table className={`report-table ${headers.includes("证据充分度") ? "report-overview" : ""}`}>
    <thead><tr>{headers.map((h,i) => <th key={i}>{inline(h)}</th>)}</tr></thead>
    <tbody>{rows.map((row, index) => {
      const area = areaFor(row[areaIndex] || "");
      let span = 1;
      if (areaIndex >= 0) while (index + span < rows.length && rows[index + span][areaIndex] === row[areaIndex]) span++;
      return <tr key={index} data-area={area}>{headers.map((_, i) => {
        if (i === areaIndex && index > 0 && rows[index-1][i] === row[i]) return null;
        return <td key={i} rowSpan={i === areaIndex ? span : undefined} className={i === areaIndex ? "report-area-cell" : ""}>{inline(row[i] || "—")}</td>;
      })}</tr>;
    })}</tbody>
  </table></div>;
}

/** Safe Markdown subset with a paginated interview report layout. */
function MarkdownBody({ text }: { text: string }) {
  const lines = text.trim().split("\n");
  const nodes: ReactNode[] = [];
  let firstHeading = true;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("|") && isSeparator(lines[i + 1] || "")) {
      const headers = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(cells(lines[i++]));
      i--;
      nodes.push(<ReportTable key={`table-${i}`} headers={headers} rows={rows} />);
      continue;
    }
    if (/^#{1,2}\s/.test(line)) {
      nodes.push(<h2 key={i} className="report-subtitle">{inline(line.replace(/^#+\s/, ""))}</h2>);
      firstHeading = false;
    } else if (/^#{3,6}\s/.test(line)) {
      nodes.push(<h3 key={i} className="mt-6 border-b border-[#c9e4e3] pb-2 text-base font-semibold text-slate-900">{inline(line.replace(/^#+\s/, ""))}</h3>);
    } else if (/^[-*]\s/.test(line)) {
      nodes.push(<p key={i} className="flex gap-2 pl-2 text-slate-700"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3f9da8]" /> <span>{inline(line.slice(2))}</span></p>);
    } else if (/^---+$/.test(line)) {
      nodes.push(<hr key={i} className="my-6 border-[#d9e9e8]" />);
    } else {
      nodes.push(<p key={i} className={`${firstHeading ? "" : ""} ${line.startsWith(">") ? "border-l-2 border-slate-300 pl-3 text-xs text-slate-500" : "text-slate-700"}`}>{inline(line.replace(/^>\s?/, ""))}</p>);
    }
  }
  return <div className="report-prose">{nodes}</div>;
}

type ReportSection = { title: string; text: string };
export function ReportMarkdown({ text, candidateName, createdAt, position, interviewType }: { text: string; candidateName?: string; createdAt?: string; position?: string; interviewType?: string }) {
  const personality = interviewType === "personality";
  if (personality) return <PersonalityReport text={text} candidateName={candidateName} createdAt={createdAt} renderMarkdown={value => <MarkdownBody text={value} />} />;
  const sections: ReportSection[] = [];
  const displayPosition = position || "岗位待确认";
  const title = personality ? "性格测试报告" : `${displayPosition}面试评估报告`;
  for (const line of text.trim().split("\n")) {
    if (/^#\s/.test(line)) continue;
    if (/^##\s/.test(line)) sections.push({ title: line.replace(/^##\s/, ""), text: "" });
    else {
      if (!sections.length) sections.push({ title: "报告说明", text: "" });
      sections[sections.length - 1].text += line + "\n";
    }
  }
  const pages = sections.filter(s => s.text.trim() && !(s.title === "报告说明" && s.text.replace(/[*_>]/g, "").trim() === "基于面试行为证据的岗位评估"))
    .flatMap(section => {
      if (!section.title.startsWith("详细结果")) return [section];
      const chunks = section.text.split(/(?=^###\s)/m);
      return chunks.filter(c=>c.trim()).map(chunk => {
        const match = chunk.match(/^###\s+(.+)\n/);
        return { title: match ? `详细结果 · ${match[1]}` : section.title, text: match ? chunk.slice(match[0].length) : chunk };
      });
    });
  return <article className={`interview-paper-report ${personality ? "personality-report" : ""}`} aria-label={personality ? "性格测试报告" : `${displayPosition}面试评估报告`}>
    <section className="report-paper report-cover">
      <div className="report-cover-brand">AI INTERVIEW <span>{personality ? "行为偏好画像" : "面试评估"}</span></div>
      <div className="report-cover-title"><h1>{personality ? "人格类型画像" : displayPosition}</h1><div className="report-cover-rule"/><h2>{personality ? "性格测试报告" : "面试评估报告"}</h2><p>{personality ? "Personality Profile · Interview Report" : `${displayPosition} · Interview Report`}</p>
        <dl><dt>面试者</dt><dd>{candidateName || "未提供姓名"}</dd><dt>面试时间</dt><dd>{createdAt ? new Date(createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }) : "见本次面试记录"}</dd><dt>应聘岗位</dt><dd>{displayPosition}</dd><dt>评估依据</dt><dd>本次面试记录及本次提供的资料</dd><dt>报告范围</dt><dd>五方面 / 20 维度</dd></dl>
        <div className="report-cover-note">{personality ? "基于工作场景访谈的行为偏好画像" : "基于面试行为证据的岗位评估"}<br/>{personality ? "访谈倾向 · 非标准化人格测评" : "访谈分析 · 非标准化人格测验"}</div>
      </div>
      <footer className="report-cover-footer">AI 面试分析报告<span>仅供授权阅览</span></footer>
    </section>
    {pages.map((section, index) => <section className="report-paper" data-area={areaFor(section.title)} key={index}>
      <header className="report-running-header">{title}</header>
      <h2 className="report-page-title">{section.title}</h2>
      {section.title.startsWith("总体结果") && <p className="report-reading-note">以下呈现本次访谈中的行为证据与覆盖情况，不构成标准化测评分数。</p>}
      <MarkdownBody text={section.text}/>
      <footer className="report-page-footer"><span>AI 面试 · 行为证据分析</span><b>{index + 1}</b></footer>
    </section>)}
  </article>;
}
export const MBTIReport = ReportMarkdown;

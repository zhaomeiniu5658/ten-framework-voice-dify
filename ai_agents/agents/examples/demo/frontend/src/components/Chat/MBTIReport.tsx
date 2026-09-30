import type { ReactNode } from "react";
import "./InterviewReport.css";
import { PersonalityReport } from "./PersonalityReport";
import { parseInterviewScore, scoringAnchors } from "@/lib/interview/scoring";

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

const scoreTicks = Array.from({ length: 10 }, (_, i) => i + 1);
function ScoreAxis() {
  return <div className="report-score-axis" aria-hidden="true">{scoreTicks.map(n => <span key={n}>{n}</span>)}</div>;
}
function ScoreBar({ value, detail = false }: { value: string; detail?: boolean }) {
  const score = parseInterviewScore(value);
  return <div className={`report-score-track ${detail ? "report-score-track-detail" : ""}`} role="img" aria-label={score === null ? "未评分" : `访谈评分 ${score.toFixed(1)} 分，满分 10 分`}>
    {score === null ? <span className="report-score-unknown">未评分</span> : <>
      <span className="report-score-fill" style={{ width: `${(score - 1) / 9 * 100}%` }} />
      {!detail && <span className="report-score-number" style={{ left: `${(score - 1) / 9 * 100}%` }}>{score.toFixed(1)}</span>}
    </>}
  </div>;
}
function ScoreOverviewTable({ rows }: { rows: string[][] }) {
  return <div className="report-table-scroll"><div className="report-score-overview">
    <table aria-label="五方面20维度总体评分">
      <colgroup><col className="report-score-area-col"/><col className="report-score-dimension-col"/><col/></colgroup>
      <tbody>{rows.map((row, index) => {
        let span = 1;
        while (index + span < rows.length && rows[index + span][0] === row[0]) span++;
        return <tr key={index} data-area={areaFor(row[0] || "")}>
          {index === 0 || rows[index - 1][0] !== row[0] ? <th rowSpan={span} className="report-score-area"><span>{row[0]}</span></th> : null}
          <th className="report-score-dimension">{row[1]}</th>
          <td><ScoreBar value={row[2] || ""}/></td>
        </tr>;
      })}</tbody>
      <tfoot><tr><td colSpan={2}/><td><ScoreAxis/></td></tr></tfoot>
    </table>
  </div></div>;
}
function ScoreDetailTable({ rows }: { rows: string[][] }) {
  return <div className="report-table-scroll"><div className="report-score-details">
    <div className="report-score-detail-heading"><span>低分特征</span><span>高分特征</span></div>
    {rows.map((row, index) => {
      const score = parseInterviewScore(row[2] || "");
      const poles = scoringAnchors[row[0]] || [row[1], row[3]];
      return <div className="report-score-detail" key={index}>
        <div className="report-score-pole">{poles[0].split("；").map((line, i) => <div key={i}>{line}</div>)}</div>
        <div className="report-score-center">
          <div className="report-score-caption"><span>{row[0]}</span><span>{score === null ? "未评分" : score.toFixed(1)}</span></div>
          <ScoreBar value={row[2] || ""} detail/><ScoreAxis/>
        </div>
        <div className="report-score-pole">{poles[1].split("；").map((line, i) => <div key={i}>{line}</div>)}</div>
      </div>;
    })}
  </div></div>;
}

function ReportTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const areaIndex = headers.findIndex(h => h === "方面");
  if (headers.length >= 3 && headers[0] === "方面" && headers[1] === "维度" && headers[2] === "访谈评分") {
    return <ScoreOverviewTable rows={rows} />;
  }
  if (headers.includes("低分特征") && headers.includes("高分特征") && headers.includes("访谈评分")) {
    return <ScoreDetailTable rows={rows.map(row => ["维度", "低分特征", "访谈评分", "高分特征"].map(h => row[headers.indexOf(h)] || ""))} />;
  }
  const comparison = headers.some(h => h.includes("行为倾向A") || h.includes("低分特征"));
  if (comparison) return <div className="report-comparisons">
    {rows.map((row, index) => <div className="report-comparison" key={index}>
      {headers.map((header, i) => <div key={i} className={i < 2 ? "report-pole" : "report-evidence"}>
        <div className="report-cell-label">{inline(header)}</div><div>{inline(row[i] || "—")}</div>
      </div>)}
    </div>)}
  </div>;
  return <div className="report-table-scroll"><table className={`report-table ${headers.includes("维度描述") ? "report-dimensions" : ""}`}>
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
      nodes.push(<h3 key={i} className={line.includes("个性特征维度表") ? "report-dimensions-title" : "mt-6 border-b border-[#c9e4e3] pb-2 text-base font-semibold text-slate-900"}>{inline(line.replace(/^#+\s/, ""))}</h3>);
    } else if (/^(?:[-*]|\d+\.)\s/.test(line)) {
      nodes.push(<p key={i} className="report-list-item flex gap-2 pl-2 text-slate-700"><span className="report-list-marker mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3f9da8]" /> <span>{inline(line.replace(/^(?:[-*]|\d+\.)\s/, ""))}</span></p>);
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
  const displayPosition = interviewType === "clinical_pm" ? "临床PM" : interviewType === "cra" ? "CRA" : /PM|项目经理/i.test(position || "") ? "临床PM" : "CRA";
  const title = personality ? "性格测试报告" : `${displayPosition}面试评估报告`;
  for (const line of text.replace(/\[T\d+\]/g, "").trim().split("\n")) {
    if (/^#\s/.test(line)) continue;
    if (/^##\s/.test(line)) sections.push({ title: line.replace(/^##\s/, ""), text: "" });
    else {
      if (!sections.length) sections.push({ title: "报告说明", text: "" });
      sections[sections.length - 1].text += line + "\n";
    }
  }
  const pages = sections.filter(s => s.text.trim() && !(s.title === "报告说明" && s.text.replace(/[*_>]/g, "").trim() === "基于本次面试的行为倾向评估"))
    .flatMap(section => {
      if (!section.title.startsWith("详细结果")) return [section];
      const chunks = section.text.split(/(?=^###\s)/m);
      return chunks.filter(c=>c.trim()).map(chunk => {
        const match = chunk.match(/^###\s+(.+)\n/);
        return { title: match ? `详细结果 · ${match[1]}` : section.title, text: match ? chunk.slice(match[0].length) : chunk };
      });
    });
  return <article className="interview-paper-report professional-report" aria-label={personality ? "性格测试报告" : `${displayPosition}面试评估报告`}>
    <section className="report-paper report-cover">
      <div className="report-cover-brand">AI INTERVIEW <span>{personality ? "行为偏好画像" : "面试评估"}</span></div>
      <div className="report-cover-title"><h1>{personality ? "人格类型画像" : displayPosition}</h1><div className="report-cover-rule"/><h2>{personality ? "性格测试报告" : "面试评估报告"}</h2><p>{personality ? "Personality Profile · Interview Report" : `${displayPosition} · Interview Report`}</p>
        <dl><dt>面试者</dt><dd>{candidateName || "未提供姓名"}</dd><dt>面试时间</dt><dd>{createdAt ? new Date(createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }) : "见本次面试记录"}</dd><dt>面试类型</dt><dd>{displayPosition}</dd><dt>评估依据</dt><dd>本次面试记录及本次提供的资料</dd><dt>报告范围</dt><dd>五方面 / 20 维度</dd></dl>
        <div className="report-cover-note">{personality ? "基于工作场景访谈的行为偏好画像" : "基于本次面试的行为倾向评估"}<br/>{personality ? "访谈倾向 · 非标准化人格测评" : "访谈分析 · 非标准化人格测验"}</div>
      </div>
      <footer className="report-cover-footer">AI 面试分析报告<span>仅供授权阅览</span></footer>
    </section>
    {pages.map((section, index) => <section className="report-paper" data-area={areaFor(section.title)} data-section={section.title.split("：")[0]} key={index}>
      <header className="report-running-header">{title} · {candidateName || "未提供姓名"}</header>
      {section.title.startsWith("详细结果 · ") ? <>
        {section.title.includes("动机能量") && <h2 className="report-page-title">详细结果</h2>}
        <h3 className="report-area-title">{section.title.replace("详细结果 · ", "")}</h3>
      </> : section.title === "阅读原则" ? <p className="report-principles-heading">在阅读本报告前，您需要掌握以下原则：</p> : <h2 className={section.title.startsWith("综合评价") ? "report-summary-title" : "report-page-title"}>{section.title}</h2>}
      <MarkdownBody text={section.text}/>
      <footer className="report-page-footer"><span>AI 面试评估</span><b>{index + 1}</b></footer>
    </section>)}
  </article>;
}
export const MBTIReport = ReportMarkdown;

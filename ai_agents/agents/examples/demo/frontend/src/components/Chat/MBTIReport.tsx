import type { ReactNode } from "react";

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") ? <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong> : part);
}

/** Safe Markdown subset: no HTML, scripts, remote images or external embeds. */
export function ReportMarkdown({ text }: { text: string }) {
  const lines = text.trim().split("\n");
  const nodes: ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith("|") && /^\|[\s:|\-]+\|$/.test(lines[i + 1]?.trim() || "")) {
      const cells = (row: string) => row.trim().replace(/^\||\|$/g, "").split("|").map(v => v.trim());
      const headers = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(cells(lines[i++]));
      i--;
      nodes.push(<div key={i} className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[620px] border-collapse text-left text-sm">
        <thead className="bg-sky-50 text-sky-900"><tr>{headers.map((cell, n) => <th key={n} className="border-b border-slate-200 p-3 font-semibold">{inline(cell)}</th>)}</tr></thead>
        <tbody>{rows.map((row, n) => <tr key={n} className="even:bg-slate-50">{row.map((cell, c) => <td key={c} className="border-b border-slate-100 p-3 align-top">{inline(cell)}</td>)}</tr>)}</tbody>
      </table></div>);
    } else if (/^#\s/.test(line)) nodes.push(<h2 key={i} className="border-b-2 border-sky-700 pb-5 text-2xl font-semibold text-sky-900">{inline(line.slice(2))}</h2>);
    else if (/^##\s/.test(line)) nodes.push(<h3 key={i} className="border-l-4 border-sky-700 bg-sky-50 px-4 py-2 text-xl font-semibold text-sky-900">{inline(line.slice(3))}</h3>);
    else if (/^#{3,6}\s/.test(line)) nodes.push(<h4 key={i} className="pt-2 text-base font-semibold text-sky-800">{inline(line.replace(/^#+\s/, ""))}</h4>);
    else if (/^[-*]\s/.test(line)) nodes.push(<p key={i} className="pl-3">• {inline(line.slice(2))}</p>);
    else if (/^---+$/.test(line)) nodes.push(<hr key={i} className="border-slate-200" />);
    else nodes.push(<p key={i} className={line.startsWith(">") ? "border-l-2 border-slate-300 pl-3 text-xs text-slate-500" : ""}>{inline(line.replace(/^>\s?/, ""))}</p>);
  }
  return <article aria-label="临床PM AI面试分析报告" className="space-y-4 rounded-xl bg-white p-5 text-sm leading-7 text-slate-700 md:p-8">{nodes}</article>;
}
export const MBTIReport = ReportMarkdown;

"use client";
import * as React from "react";
import { History, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ReportMarkdown } from "@/components/Chat/MBTIReport";

type Status = "interviewing" | "analyzing" | "ready" | "failed";
type RecordItem = { id: string; createdAt: string; candidateName: string; status: Status };
const labels: Record<Status, string> = { interviewing: "面试中", analyzing: "分析中", ready: "已生成", failed: "分析失败" };
const date = (value: string) => new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai", year: "numeric", month: "long", day: "numeric",
  hour: "2-digit", minute: "2-digit", hour12: false,
}).format(new Date(value));

export default function InterviewHistoryDialog() {
  const [open, setOpen] = React.useState(false);
  const [records, setRecords] = React.useState<RecordItem[]>([]);
  const [selected, setSelected] = React.useState<RecordItem | null>(null);
  const [report, setReport] = React.useState<{status: Status; markdown?: string; error?: string} | null>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [revision, setRevision] = React.useState(0);
  React.useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true); setError(""); setReport(null);
    let timer: ReturnType<typeof setTimeout>;
    const read = async () => {
      try {
        const response = await fetch(selected ? `/api/interviews/${selected.id}` : "/api/interviews", {cache: "no-store", signal: controller.signal});
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "读取失败，请重试。");
        if (controller.signal.aborted) return;
        if (selected) setReport(data); else setRecords(data.records);
        if (selected && data.status === "analyzing") timer = setTimeout(read, 2500);
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "读取失败"); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void read();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [open, selected, revision]);
  return <>
    <Button variant="outline" size="sm" className="gap-2 whitespace-nowrap" onClick={() => {setSelected(null); setOpen(true);}}><History size={16} />查看面试记录</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-5xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{selected ? "面试分析报告" : "面试记录"}</DialogTitle>
          <DialogDescription>{selected ? `${date(selected.createdAt)} · ${selected.candidateName}` : "按面试开始时间倒序排列 · 北京时间"}</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          {selected && <Button variant="outline" size="sm" onClick={() => setSelected(null)}>返回面试记录</Button>}
          <Button variant="outline" size="sm" onClick={() => setRevision(r => r + 1)}>刷新</Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto" aria-live="polite">
          {loading ? <div className="flex justify-center p-12"><Loader2 className="animate-spin" aria-label="加载中" /></div> : error ? <p className="p-6 text-destructive">{error}</p> : selected ? (
            report?.status === "ready" && report.markdown ? <ReportMarkdown text={report.markdown} /> :
              <p className="p-8 text-center text-muted-foreground">{report?.error || (report?.status === "analyzing" ? "正在分析，可以关闭窗口后再查看。" : report?.status === "interviewing" ? "本次面试尚未完成，暂无报告。" : "暂无可用报告。")}</p>
          ) : records.length === 0 ? <p className="p-8 text-center text-muted-foreground">暂无面试记录。</p> : <table className="w-full text-left text-sm">
            <thead><tr className="border-b"><th className="p-3">面试时间</th><th className="p-3">面试者</th><th className="p-3">状态</th><th className="p-3">面试报告</th></tr></thead>
            <tbody>{records.map(record => <tr key={record.id} className="border-b">
              <td className="whitespace-nowrap p-3">{date(record.createdAt)}</td><td className="p-3">{record.candidateName}</td><td className="whitespace-nowrap p-3">{labels[record.status]}</td>
              <td className="p-3"><button type="button" className="whitespace-nowrap text-primary underline underline-offset-4" onClick={() => setSelected(record)}>查看面试报告</button></td>
            </tr>)}</tbody>
          </table>}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}

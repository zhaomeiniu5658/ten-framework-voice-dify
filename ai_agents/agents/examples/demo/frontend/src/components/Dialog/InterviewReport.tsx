"use client";
import * as React from "react";
import { FileText, Loader2, Download } from "lucide-react";
import { useAppSelector } from "@/common";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ReportMarkdown } from "@/components/Chat/MBTIReport";

type Report = { status: "interviewing" | "analyzing" | "ready" | "failed";
  markdown?: string; error?: string; turnCount?: number };

export default function InterviewReportDialog() {
  const { interviewSessionId: liveId, interviewEnded: ended, chatItems } = useAppSelector(s => s.global);
  const [savedId, setSavedId] = React.useState("");
  React.useEffect(() => { setSavedId(sessionStorage.getItem("interview-report-session") || ""); }, []);
  React.useEffect(() => { if (liveId) sessionStorage.setItem("interview-report-session", liveId); }, [liveId]);
  const id = liveId || savedId;
  const [open, setOpen] = React.useState(false);
  const [report, setReport] = React.useState<Report | null>(null);
  const [error, setError] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const submitted = React.useRef("");
  const currentId = React.useRef(id);
  currentId.current = id;

  React.useEffect(() => { setReport(null); setError(""); setSending(false); submitted.current = ""; }, [id]);
  const submit = React.useCallback(async (retry = false) => {
    if (!id) return;
    const transcript = chatItems.filter(item => item.data_type === "text" && item.text.trim())
      .filter(item => item.type === "user" || item.isFinal !== false)
      .map(item => ({ role: item.type === "user" ? "user" : "assistant", time: item.time,
        text: item.text + (item.type === "user" && item.isFinal === false ? "（断开时尚未确认的转写）" : "") }));
    if (!retry && !transcript.some(t => t.role === "user")) {
      setError("暂无候选人回答，完成面试后可查看报告。");
      return;
    }
    setSending(true); setError("");
    try {
      const response = await fetch(`/api/interviews/${id}`, { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: retry ? "retry" : "finish", transcript }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "提交失败，请重试。");
      if (currentId.current === id) setReport(data);
    } catch (e) {
      if (currentId.current === id) setError(e instanceof Error ? e.message : "提交失败，请重试。");
    } finally { if (currentId.current === id) setSending(false); }
  }, [id, chatItems]);

  React.useEffect(() => {
    if (liveId && ended && submitted.current !== id) {
      submitted.current = id;
      void submit();
    }
  }, [id, liveId, ended, submit]);

  React.useEffect(() => {
    if (!id || (!open && report?.status !== "analyzing")) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const response = await fetch(`/api/interviews/${id}`, { cache: "no-store" });
        if (!response.ok) throw new Error("报告读取失败，请稍后重试。");
        const data = await response.json();
        if (!disposed) {
          setReport(data);
          if (data.status === "analyzing") timer = setTimeout(poll, 2500);
        }
      } catch (e) {
        if (!disposed) {
          setError(e instanceof Error ? e.message : "读取失败");
          timer = setTimeout(poll, 5000);
        }
      }
    };
    void poll();
    return () => { disposed = true; if (timer) clearTimeout(timer); };
  }, [id, open, report?.status]);

  const download = () => {
    const url = URL.createObjectURL(new Blob([report?.markdown || ""], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "管理个性V2-面试评估报告.md"; anchor.click(); URL.revokeObjectURL(url);
  };
  return <>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2 whitespace-nowrap">
      {report?.status === "analyzing" ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
      查看面试报告
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-5xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-5 pr-12">
          <DialogTitle>管理个性V2面试评估报告</DialogTitle>
          <DialogDescription>五方面 / 20 维度 · 基于面试行为证据 · 非正式测评</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-auto px-6 py-5" aria-live="polite">
          {report?.status === "ready" && report.markdown ? <ReportMarkdown text={report.markdown} /> :
            <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-center text-muted-foreground">
              {sending || report?.status === "analyzing" ? <><Loader2 className="animate-spin" /><p>面试已结束，正在分析完整面试记录与简历…</p><p className="text-xs">可以关闭窗口，报告会在后台继续生成。</p></> :
                <><FileText size={36} /><p>{report?.error || error || (id && !ended ? "面试进行中，结束后将自动生成分析报告。" : "尚无面试报告，请先完成一次面试。")}</p>
                  {id && ((ended && error) || report?.status === "failed") && <Button variant="outline" onClick={() => void submit(report?.status === "failed")}>重新分析</Button>}
                </>}
            </div>}
        </div>
        {report?.status === "ready" && <div className="flex justify-end border-t border-border px-6 py-3"><Button variant="outline" onClick={download} className="gap-2"><Download size={16} />下载 Markdown</Button></div>}
      </DialogContent>
    </Dialog>
  </>;
}

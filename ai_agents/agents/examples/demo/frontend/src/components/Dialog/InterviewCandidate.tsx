"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { Candidate } from "@/lib/interview/session";

export default function InterviewCandidate({ value, onChange, disabled }: {
  value: Candidate; onChange: (value: Candidate) => void; disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <Button variant="outline" size="sm" disabled={disabled} onClick={() => setOpen(true)}>本次面试者{value.name ? `：${value.name}` : "资料"}</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>本次面试者资料</DialogTitle><DialogDescription>仅用于即将开始的这次面试报告。可留空，后台只分析实际回答，不使用演示简历。</DialogDescription></DialogHeader>
        <label className="space-y-2">姓名（选填）<input aria-label="本次面试者姓名" maxLength={80} value={value.name} onChange={e => onChange({ ...value, name: e.target.value })} className="w-full rounded border bg-transparent p-2" /></label>
        <label className="space-y-2">简历（选填）<textarea aria-label="本次面试者简历" rows={8} maxLength={20000} value={value.resume} onChange={e => onChange({ ...value, resume: e.target.value })} className="w-full rounded border bg-transparent p-2" /></label>
        <Button onClick={() => setOpen(false)}>完成</Button>
      </DialogContent>
    </Dialog>
  </>;
}

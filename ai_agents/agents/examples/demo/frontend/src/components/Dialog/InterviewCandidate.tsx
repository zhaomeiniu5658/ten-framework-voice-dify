"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Candidate } from "@/lib/interview/session";

export default function InterviewCandidate({ value, onChange, disabled }: {
  value: Candidate; onChange: (value: Candidate) => void; disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <Button variant="outline" size="sm" disabled={disabled} onClick={() => setOpen(true)}>本次面试者{value.name ? `：${value.name}` : "资料"}</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>本次面试者资料</DialogTitle><DialogDescription>用于即将开始的这次面试提问及面试报告。可留空，后台只分析实际回答，不使用演示简历。</DialogDescription></DialogHeader>
        <div className="space-y-2">
          <label htmlFor="interview-type">面试类型</label>
          <Select value={value.interviewType || "cra"} onValueChange={interviewType => onChange({ ...value, interviewType: interviewType as NonNullable<Candidate["interviewType"]> })}>
            <SelectTrigger id="interview-type" aria-label="本次面试类型" className="border-white/25 bg-black/35 text-white backdrop-blur-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-white/25 bg-[#1e2024]/85 text-white backdrop-blur-md">
              <SelectItem value="personality" className="focus:bg-[#2d333b] focus:text-white">性格测试</SelectItem>
              <SelectItem value="cra" className="focus:bg-[#2d333b] focus:text-white">CRA模拟面试</SelectItem>
              <SelectItem value="clinical_pm" className="focus:bg-[#2d333b] focus:text-white">临床PM模拟面试</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <label className="space-y-2">姓名（选填）<input aria-label="本次面试者姓名" maxLength={80} value={value.name} onChange={e => onChange({ ...value, name: e.target.value })} className="w-full rounded border bg-transparent p-2" /></label>
        <label className="space-y-2">简历（选填）<textarea aria-label="本次面试者简历" rows={8} maxLength={20000} value={value.resume} onChange={e => onChange({ ...value, resume: e.target.value })} className="w-full rounded border bg-transparent p-2" /></label>
        <Button onClick={() => setOpen(false)}>完成</Button>
      </DialogContent>
    </Dialog>
  </>;
}

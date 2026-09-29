"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/common";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { setVolcengineVoiceId } from "@/store/reducers/global";
import type { VolcengineVoice } from "@/lib/volcengine/voices";

const STORAGE_KEY = "interview.volcengineVoiceId";

export default function VolcengineVoiceSelect() {
  const dispatch = useAppDispatch();
  const selected = useAppSelector(s => s.global.volcengineVoiceId);
  const locked = useAppSelector(s => s.global.agentConnected || s.global.agentConnecting);
  const [voices, setVoices] = useState<VolcengineVoice[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch("/api/voices/volcengine", { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("目录加载失败");
        const data = await response.json();
        if (!Array.isArray(data.voices) || !data.voices.length) throw new Error("音色目录为空");
        setVoices(data.voices);
        setNotice(data.notice);
      })
      .catch(err => { if (err.name !== "AbortError") setError("音色加载失败，请重试"); });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    // Never restore a stored preference into an already running session.
    if (!voices.length || locked || selected) return;
    let stored = "";
    try { stored = localStorage.getItem(STORAGE_KEY) || ""; } catch { /* storage may be disabled */ }
    if (voices.some(v => v.id === stored)) dispatch(setVolcengineVoiceId(stored));
    else dispatch(setVolcengineVoiceId(voices.find(v => v.id === "zh_male_baqiqingshu_uranus_bigtts")?.id || voices[0].id));
  }, [voices, locked, selected, dispatch]);

  useEffect(() => { if (locked) setOpen(false); }, [locked]);
  const voice = voices.find(v => v.id === selected);
  const filtered = voices.filter(v =>
    `${v.name} ${v.id} ${v.language} ${v.category}`.toLowerCase().includes(query.trim().toLowerCase())
  );
  const choose = (id: string) => {
    if (locked) return;
    dispatch(setVolcengineVoiceId(id));
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* selection still works */ }
    setOpen(false);
  };

  return (
    <div className="min-w-0 max-w-[240px]" title={locked ? "断开后可更换音色" : "选择本次面试使用的火山音色"}>
      <Popover open={open && !locked} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" disabled={locked} aria-label="选择火山音色"
            className="flex h-10 w-full items-center gap-2 rounded-md border border-input px-3 text-sm disabled:opacity-60">
            <span className="truncate">{voice?.name || "选择火山音色"}</span>
            <ChevronDown className="h-4 w-4 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[360px] max-w-[calc(100vw-24px)] p-2">
          <input aria-label="搜索音色" placeholder="搜索音色名称、语言或编号…" value={query}
            onChange={e => setQuery(e.target.value)}
            className="mb-2 h-10 w-full rounded border border-input bg-transparent px-3 text-sm" />
          <div className="max-h-72 overflow-y-auto" role="listbox" aria-label="火山引擎音色">
            {filtered.map(v => (
              <button type="button" key={v.id} role="option" aria-selected={v.id === selected}
                onClick={() => choose(v.id)}
                className="flex w-full items-center gap-2 rounded p-2 text-left hover:bg-accent focus:bg-accent">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">{v.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{v.category} · {v.resourceId === "seed-tts-2.0" ? "2.0" : "1.0"}</span>
                </span>
                {v.id === selected && <Check className="h-4 w-4" />}
              </button>
            ))}
            {!filtered.length && <p className="p-3 text-sm">{error || (voices.length ? "未找到匹配音色" : "正在加载音色…")}</p>}
          </div>
          {error && <button type="button" onClick={() => setAttempt(n => n + 1)} className="p-2 text-sm underline">重新加载</button>}
          <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">共 {voices.length} 个音色。{notice}</p>
        </PopoverContent>
      </Popover>
      <p className="mt-1 text-right text-xs text-muted-foreground">{locked ? "本次面试音色已锁定" : "火山音色 · 连接后生效"}</p>
    </div>
  );
}

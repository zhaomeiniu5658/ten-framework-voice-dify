"use client";

import { useAppDispatch, useAppSelector, VOICE_OPTIONS } from "@/common";
import { VoiceIcon } from "@/components/Icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setVoiceType } from "@/store/reducers/global";
import type { VoiceType } from "@/types";
import VolcengineVoiceSelect from "./VolcengineVoiceSelect";

export default function AgentVoicePresetSelect() {
  const dispatch = useAppDispatch();
  const graphName = useAppSelector((state) => state.global.graphName);
  const voiceType = useAppSelector((state) => state.global.voiceType);

  const onVoiceChange = (value: string) => {
    dispatch(setVoiceType(value as VoiceType));
  };

  if (graphName === "va_dify_azure") return <VolcengineVoiceSelect />;

  return (
    <Select value={voiceType} onValueChange={onVoiceChange}>
      <SelectTrigger className="w-[180px]">
        <div className="inline-flex items-center gap-2">
          <SelectValue placeholder="Voice" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {VOICE_OPTIONS.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="flex items-center gap-2"
          >
            <span className="flex items-center gap-2">
              <VoiceIcon className="h-4 w-4" />
              {option.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

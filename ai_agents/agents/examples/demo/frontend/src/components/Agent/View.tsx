"use client";

// import AudioVisualizer from "../audioVisualizer"
import type {
  IMicrophoneAudioTrack,
  IRemoteAudioTrack,
} from "agora-rtc-sdk-ng";
import { LoaderCircle, Radio, Volume2 } from "lucide-react";
import { useMultibandTrackVolume } from "@/common";
import AudioVisualizer from "@/components/Agent/AudioVisualizer";
import { cn } from "@/lib/utils";

export interface AgentViewProps {
  audioTrack?: IMicrophoneAudioTrack | IRemoteAudioTrack;
  roomConnected: boolean;
  agentConnected: boolean;
  agentConnecting: boolean;
}

export default function AgentView(props: AgentViewProps) {
  const { audioTrack, roomConnected, agentConnected, agentConnecting } = props;

  const subscribedVolumes = useMultibandTrackVolume(audioTrack, 12);
  const audioReady = Boolean(audioTrack);
  const progress = !roomConnected
    ? 0
    : agentConnecting
      ? 34
    : !agentConnected
      ? 0
      : !audioReady
        ? 68
        : 100;
  const statusText = !roomConnected
    ? "点击 Connect 开始"
    : agentConnecting
      ? "正在启动面试官"
    : !agentConnected
      ? "点击 Connect 启动"
      : !audioReady
        ? "等待数字人音频"
        : "可以开始说话";
  const StatusIcon = audioReady
    ? Volume2
    : agentConnecting || agentConnected
      ? LoaderCircle
      : Radio;

  return (
    <div
      className={cn(
        "flex h-auto w-full flex-col items-center justify-center px-4 py-5",
        "bg-[#0F0F11] bg-gradient-to-br from-[rgba(27,66,166,0.16)] via-[rgba(27,45,140,0.00)] to-[#11174E] shadow-[0px_3.999px_48.988px_0px_rgba(0,7,72,0.12)] backdrop-blur-[7px]"
      )}
    >
      <div className="mb-4 flex w-full items-center justify-between gap-3">
        <div className="font-semibold text-[#EAECF0] text-lg">Agent</div>
        <div
          className={cn(
            "flex items-center gap-2 rounded-md border border-[#2C3440] bg-[#171A1F] px-2.5 py-1 text-[#C9D3DF] text-xs",
            audioReady && "border-[#1F8F5F] text-[#81E6B0]"
          )}
        >
          <StatusIcon
            className={cn("h-3.5 w-3.5", {
              "animate-spin": agentConnecting || (agentConnected && !audioReady),
            })}
          />
          <span>{statusText}</span>
        </div>
      </div>
      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-[#242A33]">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            audioReady ? "bg-[#35D07F]" : "bg-[#0888FF]"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-8 h-14 w-full">
        <AudioVisualizer
          type="agent"
          frequencies={subscribedVolumes}
          barWidth={6}
          minBarHeight={6}
          maxBarHeight={56}
          borderRadius={2}
          gap={6}
        />
      </div>
    </div>
  );
}

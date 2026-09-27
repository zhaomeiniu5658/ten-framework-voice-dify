import { Bot, Brain } from "lucide-react";
import * as React from "react";
import { useAppSelector, useAutoScroll } from "@/common";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { EMessageDataType, EMessageType, type IChatItem } from "@/types";

export default function MessageList(props: { className?: string }) {
  const { className } = props;

  const chatItems = useAppSelector((state) => state.global.chatItems);

  const containerRef = React.useRef<HTMLDivElement>(null);

  useAutoScroll(containerRef);

  return (
    <div
      ref={containerRef}
      className={cn("flex-grow space-y-2 overflow-y-auto p-4", className)}
    >
      {chatItems.map((item, _index) => {
        return <MessageItem data={item} key={item.id ?? `${item.type}-${item.userId}-${item.time}-${_index}`} />;
      })}
    </div>
  );
}

export function MessageItem(props: { data: IChatItem }) {
  const { data } = props;


  return (
    <div
      className={cn("flex items-start gap-2", {
        "flex-row-reverse": data.type === EMessageType.USER,
      })}
    >
      {data.type === EMessageType.AGENT ? (
        data.data_type === EMessageDataType.REASON ? (
          <Avatar>
            <AvatarFallback>
              <Brain size={20} />
            </AvatarFallback>
          </Avatar>
        ) : (
          <Avatar>
            <AvatarFallback>
              <Bot />
            </AvatarFallback>
          </Avatar>
        )
      ) : null}
      <div
        className={cn(
          "rounded-lg bg-secondary text-secondary-foreground",
          "max-w-[80%] p-2"
        )}
      >
        {data.data_type === EMessageDataType.IMAGE ? (
          <img src={data.text} alt="chat" className="w-full" />
        ) : (
          <p
            className={
              data.data_type === EMessageDataType.REASON
                ? cn("whitespace-pre-wrap break-words text-xs text-zinc-500")
                : "whitespace-pre-wrap break-words leading-relaxed"
            }
          >
            {data.text}
          </p>
        )}
      </div>
    </div>
  );
}

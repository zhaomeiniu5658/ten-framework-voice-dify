import asyncio
import json
import time
from typing import Literal

from .agent.decorators import agent_event_handler
from ten_runtime import (
    AsyncExtension,
    AsyncTenEnv,
    Cmd,
    Data,
)

from .agent.agent import Agent
from .agent.events import (
    ASRResultEvent,
    LLMResponseEvent,
    ToolRegisterEvent,
    UserJoinedEvent,
    UserLeftEvent,
)
from .helper import _send_cmd, _send_data, parse_sentences
from .config import MainControlConfig  # assume extracted from your base model

import uuid


class MainControlExtension(AsyncExtension):
    """
    The entry point of the agent module.
    Consumes semantic AgentEvents from the Agent class and drives the runtime behavior.
    """

    def __init__(self, name: str):
        super().__init__(name)
        self.ten_env: AsyncTenEnv = None
        self.agent: Agent = None
        self.config: MainControlConfig = None

        self.stopped: bool = False
        self._rtc_user_count: int = 0
        self.sentence_fragment: str = ""
        self.turn_id: int = 0
        self.session_id: str = "0"
        self._pending_user_text: str = ""
        self._pending_user_stream_id: int | None = None
        self._pending_user_commit_task: asyncio.Task | None = None

    def _current_metadata(self) -> dict:
        return {"session_id": self.session_id, "turn_id": self.turn_id}

    async def on_init(self, ten_env: AsyncTenEnv):
        self.ten_env = ten_env

        # Load config from runtime properties
        config_json, _ = await ten_env.get_property_to_json(None)
        self.config = MainControlConfig.model_validate_json(config_json)

        self.agent = Agent(ten_env)

        # Now auto-register decorated methods
        for attr_name in dir(self):
            fn = getattr(self, attr_name)
            event_type = getattr(fn, "_agent_event_type", None)
            if event_type:
                self.agent.on(event_type, fn)

    # === Register handlers with decorators ===
    @agent_event_handler(UserJoinedEvent)
    async def _on_user_joined(self, event: UserJoinedEvent):
        self._rtc_user_count += 1
        if self._rtc_user_count == 1 and self.config and self.config.greeting:
            await self._send_to_tts(self.config.greeting, True)
            await self._send_transcript(
                "assistant", self.config.greeting, True, 100
            )

    @agent_event_handler(UserLeftEvent)
    async def _on_user_left(self, event: UserLeftEvent):
        self._rtc_user_count -= 1

    @agent_event_handler(ToolRegisterEvent)
    async def _on_tool_register(self, event: ToolRegisterEvent):
        await self.agent.register_llm_tool(event.tool, event.source)

    @agent_event_handler(ASRResultEvent)
    async def _on_asr_result(self, event: ASRResultEvent):
        self.session_id = event.metadata.get("session_id", "100")
        stream_id = int(self.session_id)
        text = (event.text or "").strip()
        if not text:
            return
        if self.config.interrupt_on_partial and (event.final or len(text) > 2):
            await self._interrupt()
        if event.final:
            self._pending_user_text = self._merge_user_text(
                self._pending_user_text, text
            )
            self._pending_user_stream_id = stream_id
            await self._send_transcript(
                "user", self._pending_user_text, False, stream_id
            )
            self._schedule_pending_user_commit()
            return

        if not self.config.interrupt_on_partial and self._pending_user_text:
            # Continuing speech postpones submission of the preceding segment.
            self._schedule_pending_user_commit()

        transcript_text = self._merge_user_text(self._pending_user_text, text)
        await self._send_transcript("user", transcript_text, False, stream_id)

    @agent_event_handler(LLMResponseEvent)
    async def _on_llm_response(self, event: LLMResponseEvent):
        if (
            self.config.report_tts_summary
            and event.type == "message"
            and (
                event.text.lstrip().startswith("# 临床PM AI面试报告")
                or event.text.lstrip().startswith("临床PM AI面试报告")
                or event.text.lstrip().startswith("MBTI 性格偏好报告")
            )
        ):
            self.sentence_fragment = ""
            if event.is_final:
                await self._send_to_tts(self.config.report_tts_summary, True)
            await self._send_transcript(
                "assistant", event.text, event.is_final, 100
            )
            return

        if not event.is_final and event.type == "message":
            sentences, self.sentence_fragment = parse_sentences(
                self.sentence_fragment, event.delta
            )
            for s in sentences:
                await self._send_to_tts(s, False)

        if event.is_final and event.type == "message":
            remaining_text = self.sentence_fragment or ""
            self.sentence_fragment = ""
            await self._send_to_tts(remaining_text, True)

        await self._send_transcript(
            "assistant",
            event.text,
            event.is_final,
            100,
            data_type=("reasoning" if event.type == "reasoning" else "text"),
        )

    async def on_start(self, ten_env: AsyncTenEnv):
        ten_env.log_info("[MainControlExtension] on_start")

    async def on_stop(self, ten_env: AsyncTenEnv):
        ten_env.log_info("[MainControlExtension] on_stop")
        self.stopped = True
        if self._pending_user_commit_task:
            self._pending_user_commit_task.cancel()
        await self.agent.stop()

    async def on_cmd(self, ten_env: AsyncTenEnv, cmd: Cmd):
        await self.agent.on_cmd(cmd)

    async def on_data(self, ten_env: AsyncTenEnv, data: Data):
        await self.agent.on_data(data)

    # === helpers ===
    async def _send_transcript(
        self,
        role: str,
        text: str,
        final: bool,
        stream_id: int,
        data_type: Literal["text", "reasoning"] = "text",
    ):
        """
        Sends the transcript (ASR or LLM output) to the message collector.
        """
        # Guard: Skip transcript if no_transcript is enabled
        if self.config.no_transcript:
            self.ten_env.log_info(
                f"[MainControlExtension] Transcript suppressed (no_transcript=true): role={role}, final={final}"
            )
            return

        if data_type == "text":
            await _send_data(
                self.ten_env,
                "message",
                "message_collector",
                {
                    "data_type": "transcribe",
                    "role": role,
                    "text": text,
                    "text_ts": int(time.time() * 1000),
                    "is_final": final,
                    "stream_id": stream_id,
                },
            )
        elif data_type == "reasoning":
            await _send_data(
                self.ten_env,
                "message",
                "message_collector",
                {
                    "data_type": "raw",
                    "role": role,
                    "text": json.dumps(
                        {
                            "type": "reasoning",
                            "data": {
                                "text": text,
                            },
                        }
                    ),
                    "text_ts": int(time.time() * 1000),
                    "is_final": final,
                    "stream_id": stream_id,
                },
            )
        self.ten_env.log_info(
            f"[MainControlExtension] Sent transcript: {role}, final={final}, text={text}"
        )

    async def _send_to_tts(self, text: str, is_final: bool):
        """
        Sends a sentence to the TTS system.
        """
        request_id = f"tts-request-{self.turn_id}"
        await _send_data(
            self.ten_env,
            "tts_text_input",
            "tts",
            {
                "request_id": request_id,
                "text": text,
                "text_input_end": is_final,
                "metadata": self._current_metadata(),
            },
        )
        self.ten_env.log_info(
            f"[MainControlExtension] Sent to TTS: is_final={is_final}, text={text}"
        )

    def _schedule_pending_user_commit(self):
        if (
            self._pending_user_commit_task
            and not self._pending_user_commit_task.done()
        ):
            self._pending_user_commit_task.cancel()
        self._pending_user_commit_task = asyncio.create_task(
            self._commit_pending_user_input()
        )

    async def _commit_pending_user_input(self):
        try:
            debounce_seconds = max(self.config.asr_final_debounce_ms, 0) / 1000
            await asyncio.sleep(debounce_seconds)

            text = self._pending_user_text.strip()
            stream_id = self._pending_user_stream_id
            if not text:
                return

            self._pending_user_text = ""
            self._pending_user_stream_id = None
            if not self.config.interrupt_on_partial:
                await self._interrupt()
            self.turn_id += 1
            await self._send_transcript(
                "user", text, True, stream_id or int(self.session_id)
            )
            await self.agent.queue_llm_input(text)
        except asyncio.CancelledError:
            raise
        finally:
            if self._pending_user_commit_task is asyncio.current_task():
                self._pending_user_commit_task = None

    def _merge_user_text(self, previous: str, current: str) -> str:
        previous = previous.strip()
        current = current.strip()
        if not previous:
            return current
        if not current:
            return previous
        if current.startswith(previous):
            return current
        if previous.endswith(current):
            return previous

        needs_space = previous[-1].isascii() and current[0].isascii()
        separator = " " if needs_space else ""
        return f"{previous}{separator}{current}"

    async def _interrupt(self):
        """
        Interrupts ongoing LLM and TTS generation. Typically called when user speech is detected.
        """
        self.sentence_fragment = ""
        await self.agent.flush_llm()
        await _send_data(
            self.ten_env, "tts_flush", "tts", {"flush_id": str(uuid.uuid4())}
        )
        await _send_cmd(self.ten_env, "flush", "agora_rtc")
        self.ten_env.log_info("[MainControlExtension] Interrupt signal sent")

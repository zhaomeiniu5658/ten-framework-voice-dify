# ------------------------------
# Config
# ------------------------------
from dataclasses import dataclass
import json
import re
from typing import AsyncGenerator, Optional

import aiohttp
from pydantic import BaseModel
from ten_ai_base.struct import (
    LLMMessageContent,
    LLMRequest,
    LLMResponse,
    LLMResponseMessageDelta,
    LLMResponseMessageDone,
)
from ten_runtime import AsyncTenEnv


def _normalize_for_duplicate_check(text: str) -> str:
    return re.sub(r"[\s*_`#>\-—:：|]+", "", text)


def _remove_consecutive_duplicate_sentences(text: str) -> str:
    pieces = re.findall(r"[^。！？!?]+[。！？!?]?", text)
    result: list[str] = []
    last_normalized = ""
    for piece in pieces:
        current = piece.strip()
        if not current:
            continue
        normalized = _normalize_for_duplicate_check(current)
        if normalized and normalized == last_normalized:
            continue
        result.append(current)
        last_normalized = normalized
    return "".join(result).strip()


def _is_evaluation_report(text: str) -> bool:
    report_markers = [
        "评价报告",
        "面试评价",
        "综合评分",
        "评分维度",
        "推荐结论",
        "候选人基本信息",
        "临床PM AI面试报告",
        "AI面试报告",
        "AI 面试评价报告",
        "AI面试评价报告",
    ]
    return any(marker in text for marker in report_markers)


def _sanitize_interview_answer(text: str) -> str:
    """Keep report Markdown intact; the Dify code node controls timing."""
    text = _strip_thinking_blocks(text)
    if _is_evaluation_report(text):
        return text.strip()
    text = re.sub(r"[*_`#>\-|]+", "", text)
    return re.sub(r"\s+", " ", text).strip()


def _sanitize_stream_delta(text: str) -> str:
    return re.sub(r"[*_`#>\-|]+", "", text)


def _strip_thinking_blocks(text: str) -> str:
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    text = re.sub(r"<think>.*", "", text, flags=re.DOTALL)
    text = re.sub(r"</?think>?", "", text, flags=re.IGNORECASE)
    return text


def _visible_delta_from_raw(raw_content: str, streamed_content: str) -> str:
    visible_content = _strip_thinking_blocks(raw_content)
    if visible_content.startswith(streamed_content):
        return visible_content[len(streamed_content) :]
    return visible_content


def _dedupe_repeated_answer(text: str) -> str:
    stripped = text.strip()
    if not stripped:
        return text
    if stripped.startswith("MBTI ") and "报告" in stripped.split("\n", 1)[0]:
        return stripped

    normalized = _normalize_for_duplicate_check(stripped)
    for split in range(1, len(stripped)):
        left = stripped[:split].strip()
        right = stripped[split:].strip()
        if (
            left
            and right
            and _normalize_for_duplicate_check(left)
            == _normalize_for_duplicate_check(right)
        ):
            return left

    parts = [p for p in stripped.replace("？", "？\n").splitlines() if p]
    if len(parts) == 2 and _normalize_for_duplicate_check(
        parts[0]
    ) == _normalize_for_duplicate_check(parts[1]):
        return parts[0]

    midpoint = len(normalized) // 2
    if (
        len(normalized) % 2 == 0
        and normalized[:midpoint] == normalized[midpoint:]
    ):
        return stripped[: len(stripped) // 2].strip()

    return _remove_consecutive_duplicate_sentences(stripped)


@dataclass
class DifyLLM2Config(BaseModel):
    api_key: str = ""
    base_url: str = "https://api.dify.ai/v1"
    user_id: str = "TenAgent"
    prompt: str = ""
    # Networking
    connect_timeout_s: float = 15.0
    total_timeout_s: float = 60.0
    # Provider specific additions (ignored by Dify)


# ------------------------------
# Thin Dify streaming client
# ------------------------------
class DifyChatClient:
    def __init__(self, ten_env: AsyncTenEnv, config: DifyLLM2Config):
        self.ten_env = ten_env
        self.config = config
        self._session: Optional[aiohttp.ClientSession] = None
        self._conversation_id: str = ""

    async def _ensure_session(self):
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(
                connect=self.config.connect_timeout_s,
                total=self.config.total_timeout_s,
            )
            self._session = aiohttp.ClientSession(timeout=timeout)

    async def aclose(self):
        if self._session and not self._session.closed:
            await self._session.close()
        self._session = None

    def _headers(self):
        return {
            "Authorization": f"Bearer {self.config.api_key.strip()}",
            "Content-Type": "application/json",
        }

    def _url(self, path: str) -> str:
        base = self.config.base_url.strip().rstrip("/")
        return f"{base}/{path.lstrip('/')}"

    async def get_chat_completions(
        self, request_input: LLMRequest
    ) -> AsyncGenerator[LLMResponse, None]:
        """
        Map LLMRequest -> Dify /chat-messages streaming API.
        Emit LLMResponseMessageDelta and LLMResponseMessageDone, mirroring the OpenAI LLM2 sample.
        """
        await self._ensure_session()
        assert self._session is not None

        # Dify takes a single "query" string. We choose the latest user message text for parity with your old code.
        query_text = ""
        for m in reversed(request_input.messages or []):
            if isinstance(m, LLMMessageContent) and m.role == "user":
                if isinstance(m.content, str):
                    query_text = m.content
                    break
                if isinstance(m.content, list):
                    # Flatten simple text chunks if present
                    text_chunks = [
                        getattr(x, "text", "")
                        for x in m.content
                        if hasattr(x, "text")
                    ]
                    query_text = "\n".join([t for t in text_chunks if t])
                    break

        if not query_text:
            # As a fallback, take the very last text-looking message
            for m in reversed(request_input.messages or []):
                if isinstance(m, LLMMessageContent) and isinstance(
                    m.content, str
                ):
                    query_text = m.content
                    break

        # NOTE: Dify does not support tool calls in this endpoint; we ignore tools/messages of function types.
        # Keep behavior symmetrical with your OpenAI extension: we only stream assistant text.
        if self.config.prompt:
            query_text = (
                f"{self.config.prompt}\n\n"
                f"候选人刚才说：{query_text}\n\n"
                "请按模拟面试官身份继续。"
            )

        payload = {
            "inputs": {},
            "query": query_text,
            "response_mode": "streaming",
        }
        if self._conversation_id:
            payload["conversation_id"] = self._conversation_id
        if self.config.user_id:
            payload["user"] = self.config.user_id

        # Candidate answers may contain private work information. Log only
        # request metadata, never the query or API key.
        self.ten_env.log_info(
            f"[Dify] POST {self._url('chat-messages')} "
            f"response_mode={payload['response_mode']} "
            f"has_conversation={bool(self._conversation_id)}"
        )

        full_content = ""
        streamed_content = ""
        response_id = ""
        created = 0
        suppress_stream = False
        async with self._session.post(
            self._url("chat-messages"), json=payload, headers=self._headers()
        ) as resp:
            if resp.status != 200:
                try:
                    err = await resp.json()
                except Exception:
                    err = {"status": resp.status, "text": await resp.text()}
                raise RuntimeError(f"Dify chat-messages failed: {err}")

            async for raw in resp.content:
                if not raw:
                    continue
                line = raw.decode("utf-8").strip()
                if not line.startswith("data:"):
                    continue

                content = line[5:].strip()
                if content == "[DONE]":
                    # Close event: send MessageDone
                    break

                # Each line is a JSON object like:
                # {"event":"message","id":"...","task_id":"...","answer":"...","conversation_id":"...","created_at":1705398420}
                try:
                    evt = json.loads(content)
                except Exception:
                    continue

                event_type = evt.get("event")
                if event_type in ("message", "agent_message"):
                    # cache conversation id once
                    if not self._conversation_id and evt.get("conversation_id"):
                        self._conversation_id = evt["conversation_id"]
                        self.ten_env.log_info(
                            f"[Dify] conversation_id={self._conversation_id}"
                        )

                    answer = evt.get("answer") or ""
                    if not answer:
                        continue
                    if answer.startswith(full_content):
                        delta = answer[len(full_content) :]
                        full_content = answer
                    else:
                        delta = answer
                        full_content += delta
                    if not delta:
                        continue
                    response_id = str(evt.get("id") or response_id)
                    created = int(evt.get("created_at") or created)
                    visible_content = _strip_thinking_blocks(full_content)
                    if _is_evaluation_report(visible_content):
                        suppress_stream = True
                        continue

                    visible_delta = _visible_delta_from_raw(
                        full_content, streamed_content
                    )
                    sanitized_delta = _sanitize_stream_delta(visible_delta)
                    if not suppress_stream and sanitized_delta:
                        streamed_content += sanitized_delta
                        yield LLMResponseMessageDelta(
                            response_id=response_id,
                            role="assistant",
                            content=streamed_content,
                            delta=sanitized_delta,
                            created=created,
                        )

                elif event_type == "message_end":
                    # Can log metadata; final "DONE" still closes the stream
                    meta = evt.get("metadata", {})
                    self.ten_env.log_debug(
                        f"[Dify] message_end metadata={meta}"
                    )

                elif event_type == "error":
                    msg = evt.get("message") or "unknown provider error"
                    raise RuntimeError(f"Dify stream error: {msg}")

        full_content = _sanitize_interview_answer(
            _dedupe_repeated_answer(_strip_thinking_blocks(full_content))
        )
        normalized_final = _normalize_for_duplicate_check(full_content)
        normalized_streamed = _normalize_for_duplicate_check(streamed_content)
        tail_delta = ""
        if full_content.startswith(streamed_content):
            tail_delta = full_content[len(streamed_content) :]
        if full_content and normalized_final != normalized_streamed and tail_delta:
            yield LLMResponseMessageDelta(
                response_id=response_id,
                role="assistant",
                content=full_content,
                delta=tail_delta,
                created=created,
            )

        # Emit the terminal message (even if empty) to mirror OpenAI sample
        yield LLMResponseMessageDone(
            response_id="",
            role="assistant",
            content=full_content,
            created=0,
        )

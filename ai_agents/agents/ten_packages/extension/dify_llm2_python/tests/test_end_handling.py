import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

from ten_ai_base.struct import (
    LLMMessageContent,
    LLMRequest,
    LLMResponseMessageDelta,
    LLMResponseMessageDone,
)

from dify_llm2_python.dify import (
    DifyChatClient,
    DifyLLM2Config,
    _is_empty_placeholder,
    _is_interview_end_query,
)


class DifyEndHandlingTests(unittest.TestCase):
    def test_explicit_end_phrases(self):
        for text in (
            "好的，今天面试到这里吧。",
            "结束面试",
            "先到这里",
            "拜拜。",
            "再见",
        ):
            with self.subTest(text=text):
                self.assertTrue(_is_interview_end_query(text))

    def test_normal_answer_is_not_treated_as_end(self):
        for text in (
            "我先把这个问题说完",
            "不要结束面试",
            "项目结束后我做了复盘",
            "我对同事说了再见，然后继续整理记录",
        ):
            with self.subTest(text=text):
                self.assertFalse(_is_interview_end_query(text))

    def test_dify_empty_placeholder_is_hidden(self):
        self.assertTrue(_is_empty_placeholder("（无内容）"))
        self.assertTrue(_is_empty_placeholder("没有内容"))
        self.assertFalse(_is_empty_placeholder("无内容，所以我再补充一点"))


class DifyStreamingEndTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.client = DifyChatClient(
            Mock(), DifyLLM2Config(opening_delivered=True)
        )
        self.client._ensure_session = AsyncMock()

    async def responses(self, text):
        request = LLMRequest(
            request_id="test-end",
            messages=[LLMMessageContent(role="user", content=text)],
        )
        return [r async for r in self.client.get_chat_completions(request)]

    def mock_stream(self, chunks):
        async def lines():
            for chunk in chunks:
                event = {"event": "message", "answer": chunk}
                yield ("data: " + json.dumps(event) + "\n").encode()
            yield b'data: {"event": "message_end"}\n'

        response = SimpleNamespace(status=200, content=lines())
        context = AsyncMock()
        context.__aenter__.return_value = response
        self.client._session = Mock()
        self.client._session.post.return_value = context

    async def test_explicit_end_needs_no_dify_request(self):
        for text in ("好的，今天面试到这里吧。", "结束面试", "拜拜。"):
            with self.subTest(text=text):
                responses = await self.responses(text)
                self.assertEqual(len(responses), 1)
                self.assertIsInstance(responses[0], LLMResponseMessageDone)
                self.assertEqual(
                    responses[0].content, "[[INTERVIEW_COMPLETED]]"
                )
        self.client._ensure_session.assert_not_awaited()

    async def test_empty_or_chunked_placeholder_has_one_spoken_fallback(self):
        for chunks in ([], ["（", "无", "内容", "）"], ["暂无", "内容"]):
            with self.subTest(chunks=chunks):
                self.mock_stream(chunks)
                responses = await self.responses("我负责协调项目进度。")
                deltas = [
                    r.delta
                    for r in responses
                    if isinstance(r, LLMResponseMessageDelta)
                ]
                fallback = "抱歉，刚才没有收到有效回复，请再说一遍。"
                self.assertEqual(deltas, [fallback])
                self.assertEqual(responses[-1].content, fallback)

    async def test_real_answer_sharing_placeholder_prefix_is_not_lost(self):
        self.mock_stream(["没有", "内容", "方面的限制，请继续介绍。"])
        responses = await self.responses("我先把这个问题说完")
        text = "没有内容方面的限制，请继续介绍。"
        self.assertEqual(
            "".join(
                r.delta
                for r in responses
                if isinstance(r, LLMResponseMessageDelta)
            ),
            text,
        )
        self.assertEqual(responses[-1].content, text)


if __name__ == "__main__":
    unittest.main()

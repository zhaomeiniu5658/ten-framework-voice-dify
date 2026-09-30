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

END_QUERIES = (
    "那次是方案调整了 AE 分级判定标准，涉及12家中心。"
    "我先把修订点提炼成一页对比清单。好了，今天面试到此结束吧。",
    "今天的面试到此结束。",
    "面试就到这吧，拜拜。",
    "有的，有变化，有很大的变化。好的，我们今天面试到这里吧。",
    "好的，今天面试到这里吧。",
    "结束面试",
    "面试结束",
    "请结束面试",
    "我想结束面试了",
    "我们结束今天的面试吧",
    "今天的面试就到这里吧",
    "好了今天面试到此结束吧",
    "现在结束面试吧",
    "这次访谈先到这儿吧",
    "本次面试到此结束",
    "好的，我们今天的面试就到这里吧，谢谢。",
    "追回进度了，今天的面试到此结束，谢谢您。",
    "先到这里",
    "今天就到这里吧",
    "就到这吧",
    "不聊了",
    "停止面试",
    "退出面试",
    "拜拜。",
    "再见",
)

CONTINUE_QUERIES = (
    "我先把这个问题说完",
    "不要结束面试",
    "今天的面试不要到此结束",
    "我不想结束面试",
    "还不能结束面试",
    "面试结束了吗",
    "面试结束后能出报告吗",
    "项目结束后我做了复盘",
    "我对同事说了再见，然后继续整理记录",
    "项目结束后我们今天继续面试",
    "负责人说，今天的面试到此结束。",
    "我曾说过，结束面试。",
    "我对同事说：今天面试到此结束。",
    "我引用了“今天的面试到此结束”。",
    "结束面试，不对，继续。",
    "结束面试。我还想补充一个例子。",
    "我负责的部分先到这里，下面还有补充。",
    "今天的面试很有价值，谢谢。",
    "谢谢",
)


class DifyEndHandlingTests(unittest.TestCase):
    def test_explicit_end_phrases(self):
        for text in END_QUERIES:
            with self.subTest(text=text):
                self.assertTrue(_is_interview_end_query(text))

    def test_normal_answer_is_not_treated_as_end(self):
        for text in CONTINUE_QUERIES:
            with self.subTest(text=text):
                self.assertFalse(_is_interview_end_query(text))

    def test_dify_empty_placeholder_is_hidden(self):
        self.assertTrue(_is_empty_placeholder("（无内容）"))
        self.assertTrue(_is_empty_placeholder("没有内容"))
        self.assertFalse(_is_empty_placeholder("无内容，所以我再补充一点"))


class DifyStreamingEndTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.client = DifyChatClient(
            Mock(),
            DifyLLM2Config.model_validate_json('{"opening_delivered": true}'),
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

    async def test_first_answer_includes_delivered_opening_context(self):
        answer = "我姓孙，做过药物CRA，负责临床项目。我的介绍到这里。"
        self.mock_stream(["请介绍一个你负责的项目。"])
        await self.responses(answer)
        payload = self.client._session.post.call_args.kwargs["json"]
        self.assertIn("面试官已向候选人说过", payload["query"])
        self.assertTrue(payload["query"].endswith(answer))
        self.assertNotIn("conversation_id", payload)

    async def test_later_answers_keep_conversation_without_reseeding(self):
        self.client._conversation_id = "existing-conversation"
        self.mock_stream(["你是怎么处理的？"])
        await self.responses("我负责十家中心。")
        payload = self.client._session.post.call_args.kwargs["json"]
        self.assertEqual(payload["query"], "我负责十家中心。")
        self.assertEqual(payload["conversation_id"], "existing-conversation")

    async def test_no_transport_greeting_keeps_query_unchanged(self):
        self.client.config.opening_delivered = False
        self.mock_stream(["请介绍一下自己。"])
        await self.responses("你好")
        payload = self.client._session.post.call_args.kwargs["json"]
        self.assertEqual(payload["query"], "你好")

    async def test_candidate_inputs_are_separate_from_answer_and_per_client(self):
        self.client.config.candidate_name = "测试甲"
        self.client.config.candidate_position = "CRA"
        self.client.config.candidate_resume = "仅有青桥眼科项目"
        for conversation in ("", "test-conversation"):
            self.client._conversation_id = conversation
            self.mock_stream(["你如何核查数据？"])
            await self.responses("我完成了SDV。")
            payload = self.client._session.post.call_args.kwargs["json"]
            self.assertEqual(payload["inputs"]["candidate_name"], "测试甲")
            self.assertEqual(payload["inputs"]["candidate_position"], "CRA")
            self.assertEqual(payload["inputs"]["candidate_resume"], "仅有青桥眼科项目")
            self.assertNotIn("青桥", payload["query"])
        other = DifyLLM2Config.model_validate_json("{}")
        self.assertEqual(other.candidate_resume, "")
        self.assertEqual(other.candidate_position, "")

    async def test_explicit_end_needs_no_dify_request(self):
        for text in END_QUERIES:
            with self.subTest(text=text):
                responses = await self.responses(text)
                self.assertEqual(len(responses), 1)
                self.assertIsInstance(responses[0], LLMResponseMessageDone)
                self.assertEqual(
                    responses[0].content, "[[INTERVIEW_COMPLETED]]"
                )
        self.client._ensure_session.assert_not_awaited()

    async def test_negative_and_reported_phrases_still_go_to_dify(self):
        for text in CONTINUE_QUERIES:
            with self.subTest(text=text):
                self.mock_stream(["请继续介绍。"])
                responses = await self.responses(text)
                self.assertEqual(responses[-1].content, "请继续介绍。")
                self.client._session.post.assert_called_once()

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

import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock

from main_cascade_python.config import MainControlConfig
from main_cascade_python.extension import MainControlExtension
from main_cascade_python.agent.events import ASRResultEvent, LLMResponseEvent


class InterruptionTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.control = MainControlExtension("test")
        self.control.config = MainControlConfig(
            interrupt_on_partial=False, asr_final_debounce_ms=40
        )
        self.control.agent = SimpleNamespace(queue_llm_input=AsyncMock())
        self.control._interrupt = AsyncMock()
        self.control._send_transcript = AsyncMock()

    async def asyncTearDown(self):
        task = self.control._pending_user_commit_task
        if task and not task.done():
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)

    async def send(self, text, final=False):
        await self.control._on_asr_result(
            ASRResultEvent(
                text=text, final=final, metadata={"session_id": "100"}
            )
        )

    async def test_tentative_recognition_does_not_interrupt(self):
        await self.send("嗯")
        await self.send("背景里的声音")
        await self.send("", final=True)
        await asyncio.sleep(0.06)
        self.control._interrupt.assert_not_awaited()
        self.control.agent.queue_llm_input.assert_not_awaited()

    async def test_short_confirmed_answer_is_preserved(self):
        await self.send("好", final=True)
        self.control._interrupt.assert_not_awaited()
        await self.control._pending_user_commit_task
        self.control._interrupt.assert_awaited_once()
        self.control.agent.queue_llm_input.assert_awaited_once_with("好")

    async def test_continuing_speech_postpones_and_merges_input(self):
        await self.send("我喜欢", final=True)
        previous_task = self.control._pending_user_commit_task
        await self.send("独处")
        await asyncio.sleep(0)
        self.assertTrue(previous_task.cancelled())
        self.control._interrupt.assert_not_awaited()
        await self.send("独处", final=True)
        await self.control._pending_user_commit_task
        self.control._interrupt.assert_awaited_once()
        self.control.agent.queue_llm_input.assert_awaited_once_with(
            "我喜欢独处"
        )

    async def test_default_keeps_other_graphs_behavior(self):
        self.control.config = MainControlConfig(asr_final_debounce_ms=40)
        await self.send("我喜欢独处")
        self.control._interrupt.assert_awaited_once()
        await self.send("好", final=True)
        self.assertEqual(self.control._interrupt.await_count, 2)
        await self.control._pending_user_commit_task
        self.assertEqual(self.control._interrupt.await_count, 2)

    async def test_report_displays_full_text_but_speaks_summary_once(self):
        self.control.config.report_tts_summary = "报告已生成，谢谢您的配合。"
        self.control._send_to_tts = AsyncMock()
        report = "MBTI 性格偏好报告\n初步倾向：INFP\n一、类型概览。"
        await self.control._on_llm_response(
            LLMResponseEvent(delta=report, text=report, is_final=False)
        )
        self.control._send_to_tts.assert_not_awaited()
        await self.control._on_llm_response(
            LLMResponseEvent(delta="", text=report, is_final=True)
        )
        self.control._send_to_tts.assert_awaited_once_with(
            self.control.config.report_tts_summary, True
        )
        self.control._send_transcript.assert_awaited_with(
            "assistant", report, True, 100
        )


if __name__ == "__main__":
    unittest.main()

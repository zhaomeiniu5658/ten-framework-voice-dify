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

    async def test_interview_acknowledgements_never_interrupt_or_ask(self):
        self.control.config.ignore_acknowledgements = True
        for text in ["嗯", "好的哦。", "哦", "OK"]:
            await self.send(text, final=True)
            await self.control._pending_user_commit_task
        self.control._interrupt.assert_not_awaited()
        self.control.agent.queue_llm_input.assert_not_awaited()

    async def test_meaningful_short_answer_and_end_are_not_filtered(self):
        self.control.config.ignore_acknowledgements = True
        for text in ["没有", "三个月", "结束面试"]:
            await self.send(text, final=True)
            await self.control._pending_user_commit_task
        self.assertEqual(self.control.agent.queue_llm_input.await_count, 3)

    async def test_short_fragment_waits_longer_and_merges_continuation(self):
        self.control.config.ignore_acknowledgements = True
        self.control.config.asr_short_answer_debounce_ms = 150
        await self.send("第一步是查。", final=True)
        await asyncio.sleep(0.07)
        self.control.agent.queue_llm_input.assert_not_awaited()
        await self.send("医院系统里的用药记录。", final=True)
        await self.control._pending_user_commit_task
        self.control.agent.queue_llm_input.assert_awaited_once_with(
            "第一步是查。医院系统里的用药记录。"
        )

    async def test_default_keeps_other_graphs_behavior(self):
        self.control.config = MainControlConfig(asr_final_debounce_ms=40)
        await self.send("我喜欢独处")
        self.control._interrupt.assert_awaited_once()
        await self.send("好", final=True)
        self.assertEqual(self.control._interrupt.await_count, 2)
        await self.control._pending_user_commit_task
        self.assertEqual(self.control._interrupt.await_count, 2)

    async def test_long_answer_waits_for_tail_final_before_replying(self):
        self.control._send_to_tts = AsyncMock()

        async def reply(text):
            response = "这个中心最终取得了什么结果？"
            await self.control._on_llm_response(
                LLMResponseEvent(delta=response, text=response, is_final=False)
            )
            await self.control._on_llm_response(
                LLMResponseEvent(delta="", text=response, is_final=True)
            )

        self.control.agent.queue_llm_input.side_effect = reply
        await self.send("我协调公司增派CRC。", final=True)
        await self.send("同时与PI对齐每周目标")
        # Reproduce the vendor's delayed final after partial updates stop.
        await asyncio.sleep(0.12)
        self.control.agent.queue_llm_input.assert_not_awaited()
        self.control._interrupt.assert_not_awaited()
        self.control._send_to_tts.assert_not_awaited()
        await self.send("同时与PI对齐每周目标，最终追回进度。", final=True)
        await self.control._pending_user_commit_task
        self.control.agent.queue_llm_input.assert_awaited_once_with(
            "我协调公司增派CRC。同时与PI对齐每周目标，最终追回进度。"
        )
        self.control._interrupt.assert_awaited_once()
        final_audio = [
            call
            for call in self.control._send_to_tts.await_args_list
            if call.args[1]
        ]
        self.assertEqual(len(final_audio), 1)

    async def test_short_pause_between_final_segments_merges_one_turn(self):
        await self.send("先核查原因。", final=True)
        await asyncio.sleep(0.01)
        await self.send("再明确分工。", final=True)
        await self.control._pending_user_commit_task
        self.control.agent.queue_llm_input.assert_awaited_once_with(
            "先核查原因。再明确分工。"
        )

    async def test_new_partial_does_not_cancel_submission_in_progress(self):
        entered = asyncio.Event()
        release = asyncio.Event()

        async def slow_interrupt():
            entered.set()
            await release.wait()

        self.control._interrupt.side_effect = slow_interrupt
        await self.send("已确认的回答。", final=True)
        submission = self.control._pending_user_commit_task
        await asyncio.wait_for(entered.wait(), 1)
        await self.send("下一轮回答还在识别")
        release.set()
        await submission
        self.control.agent.queue_llm_input.assert_awaited_once_with(
            "已确认的回答。"
        )

    async def test_explicit_end_sends_farewell_and_marks_interview_complete(
        self,
    ):
        self.control._send_to_tts = AsyncMock()
        await self.send("尚未提交的迟到语音", final=True)
        pending = self.control._pending_user_commit_task
        await self.control._on_llm_response(
            LLMResponseEvent(
                delta="",
                text="[[INTERVIEW_COMPLETED]]",
                is_final=True,
            )
        )
        await asyncio.sleep(0)
        self.assertTrue(self.control._interview_completed)
        self.assertTrue(pending.cancelled())
        self.assertEqual(self.control._pending_user_text, "")
        self.control._send_to_tts.assert_awaited_once()
        self.assertTrue(
            self.control._send_to_tts.await_args.args[0].startswith(
                "好的，本次面试已结束"
            )
        )
        self.assertEqual(self.control._send_to_tts.await_args.args[1], True)
        completed = [
            call
            for call in self.control._send_transcript.await_args_list
            if call.kwargs.get("data_type") == "interview_completed"
        ]
        self.assertEqual(len(completed), 1)
        await self.control._on_llm_response(
            LLMResponseEvent(
                delta="", text="[[INTERVIEW_COMPLETED]]", is_final=True
            )
        )
        self.control._send_to_tts.assert_awaited_once()
        self.control.agent.queue_llm_input.assert_not_awaited()

    async def test_completed_interview_ignores_late_speech(self):
        self.control._interview_completed = True
        await self.send("拜拜", final=True)
        self.control.agent.queue_llm_input.assert_not_awaited()

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

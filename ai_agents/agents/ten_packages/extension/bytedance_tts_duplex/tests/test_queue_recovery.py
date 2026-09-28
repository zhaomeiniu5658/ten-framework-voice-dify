"""Regression coverage for interrupted requests blocking later speech."""

import asyncio
import unittest
from unittest.mock import AsyncMock, Mock

from ten_ai_base.struct import TTSTextInput
from ten_ai_base.tts2 import RequestState
from bytedance_tts_duplex.extension import BytedanceTTSDuplexExtension


class QueueRecoveryTests(unittest.IsolatedAsyncioTestCase):
    async def test_late_cancelled_chunk_does_not_block_following_turns(self):
        extension = BytedanceTTSDuplexExtension("test")
        extension.ten_env = Mock()
        extension.client = Mock()
        extension.last_completed_request_id = "cancelled"
        original = extension.request_tts
        spoken = []

        async def synthesize(item):
            if item.request_id == "cancelled":
                await original(item)
            else:
                spoken.append(item.text)
                await extension.finish_request(item.request_id)

        extension.request_tts = synthesize
        for request_id, text in [
            ("cancelled", ""),
            ("third", "第三句"),
            ("fourth", "第四句"),
        ]:
            extension.request_states[request_id] = RequestState.QUEUED
            await extension.input_queue.put(
                TTSTextInput(
                    request_id=request_id, text=text, text_input_end=True
                )
            )
        await extension.input_queue.put(None)
        await asyncio.wait_for(
            extension._process_input_queue(extension.ten_env), timeout=1
        )
        self.assertEqual(spoken, ["第三句", "第四句"])
        self.assertIsNone(extension._processing_request_id)
        self.assertFalse(extension._pending_messages)

    async def test_session_finishes_before_finish_session_returns(self):
        extension = BytedanceTTSDuplexExtension("test")
        extension.ten_env = Mock()
        extension.client = Mock()
        extension.client.send_text = AsyncMock()
        extension.client.finish_connection = AsyncMock()
        extension.finish_request = AsyncMock()
        extension.current_request_id = "fast"
        extension.is_first_message_of_request = False
        extension.last_completed_has_reset_synthesizer = True

        async def finish_immediately():
            extension.stop_event.set()
            extension.stop_event = None

        extension.client.finish_session = finish_immediately
        await asyncio.wait_for(
            extension.request_tts(
                TTSTextInput(
                    request_id="fast", text="", text_input_end=True
                )
            ),
            timeout=1,
        )
        extension.finish_request.assert_awaited_once_with("fast")


if __name__ == "__main__":
    unittest.main()

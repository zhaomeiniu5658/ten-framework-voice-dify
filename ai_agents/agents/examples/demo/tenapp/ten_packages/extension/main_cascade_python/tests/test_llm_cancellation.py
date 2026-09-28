import asyncio
import unittest
from unittest.mock import Mock, AsyncMock
from main_cascade_python.agent.llm_exec import LLMExec

class CancelTest(unittest.IsolatedAsyncioTestCase):
    async def test_cancelled_response_has_no_late_normal_completion(self):
        llm=LLMExec(Mock())
        llm.on_response=AsyncMock()
        started=asyncio.Event()
        async def stream(*args):
            llm.current_text='unfinished speech'
            started.set()
            await asyncio.Event().wait()
        llm._send_to_llm=stream
        await llm.queue_input('test')
        await started.wait()
        await llm.stop()
        await asyncio.sleep(0)
        await asyncio.sleep(0)
        llm.on_response.assert_not_awaited()

unittest.main()

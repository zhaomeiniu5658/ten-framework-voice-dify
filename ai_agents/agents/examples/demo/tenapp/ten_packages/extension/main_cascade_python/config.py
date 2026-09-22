from pydantic import BaseModel


class MainControlConfig(BaseModel):
    greeting: str = "Hello, I am your AI assistant."
    no_transcript: bool = False
    asr_final_debounce_ms: int = 1200
    # False waits for confirmed, debounced input before stopping playback.
    interrupt_on_partial: bool = True
    report_tts_summary: str = ""

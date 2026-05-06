"""One-shot validation that Anthropic + OpenAI keys work and credits are available.

No DB writes. Run from backend/:
    python scripts/smoke_keys.py
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")


def check_anthropic() -> tuple[bool, str]:
    try:
        import anthropic
    except ImportError as exc:
        return False, f"anthropic package not installed: {exc}"
    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key:
        return False, "ANTHROPIC_API_KEY not set"
    client = anthropic.Anthropic(api_key=key)
    model = os.environ.get("INTENT_MODEL", "claude-haiku-4-5-20251001")
    try:
        resp = client.messages.create(
            model=model,
            max_tokens=32,
            messages=[{"role": "user", "content": "Reply with the single word: ok"}],
        )
    except Exception as exc:
        return False, f"{type(exc).__name__}: {exc}"
    text = resp.content[0].text.strip() if resp.content else ""
    return True, f"model={model} reply={text!r} input_tokens={resp.usage.input_tokens} output_tokens={resp.usage.output_tokens}"


def check_openai() -> tuple[bool, str]:
    try:
        from openai import OpenAI
    except ImportError as exc:
        return False, f"openai package not installed: {exc}"
    key = os.environ.get("OPENAI_API_KEY", "")
    if not key:
        return False, "OPENAI_API_KEY not set"
    client = OpenAI(api_key=key)
    model = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-small")
    try:
        resp = client.embeddings.create(
            model=model,
            input="StratIQ smoke test",
        )
    except Exception as exc:
        return False, f"{type(exc).__name__}: {exc}"
    dim = len(resp.data[0].embedding) if resp.data else 0
    return True, f"model={model} dim={dim} usage={resp.usage.total_tokens}tok"


def main() -> int:
    print("=== Anthropic ===")
    ok_a, msg_a = check_anthropic()
    print(("OK   " if ok_a else "FAIL ") + msg_a)
    print()
    print("=== OpenAI ===")
    ok_o, msg_o = check_openai()
    print(("OK   " if ok_o else "FAIL ") + msg_o)
    return 0 if (ok_a and ok_o) else 1


if __name__ == "__main__":
    sys.exit(main())

import asyncio
from anthropic import AsyncAnthropic
import os
from dotenv import load_dotenv

load_dotenv()
client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

async def test_model(model_name):
    try:
        res = await client.messages.create(
            model=model_name,
            max_tokens=10,
            messages=[{"role": "user", "content": "hi"}]
        )
        print(f"SUCCESS {model_name}")
    except Exception as e:
        print(f"ERROR {model_name}:", type(e).__name__, str(e))

async def main():
    await test_model("claude-3-haiku-20240307")
    await test_model("claude-3-5-sonnet-20240620")
    await test_model("claude-3-5-sonnet-20241022")
    await test_model("claude-3-opus-20240229")

asyncio.run(main())

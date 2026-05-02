import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import json
from uuid import uuid4
from datetime import datetime

async def test():
    engine = create_async_engine("postgresql+asyncpg://stratiq:stratiq@localhost:5432/stratiq")
    async with engine.begin() as conn:
        try:
            await conn.execute(text("""
                INSERT INTO runs (id, workflow, question, filters, status, created_at)
                VALUES (:id, :workflow, :question, CAST(:filters AS jsonb), 'running', :now)
            """), {
                "id": str(uuid4()), "workflow": "churn",
                "question": "test",
                "filters": json.dumps({}),
                "now": datetime.utcnow()
            })
            print("INSERT SUCCESS")
        except Exception as e:
            print("INSERT ERROR:", repr(e))

asyncio.run(test())

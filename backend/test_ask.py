import asyncio
from app.schemas import AskRequest
from app.services.orchestrator import run_workflow
from app.db.session import get_db

async def test():
    async for db in get_db():
        request = AskRequest(question="What is the churn risk for George Group?", workflow="churn")
        try:
            res = await run_workflow(request, db)
            print("SUCCESS:", res.summary[:100])
        except Exception as e:
            print("ERROR IN WORKFLOW:", type(e), repr(e))
            import traceback
            traceback.print_exc()

asyncio.run(test())

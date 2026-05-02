"""StratIQ — /api/feedback"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from uuid import uuid4
from app.db.session import get_db
from app.schemas import FeedbackCreate

router = APIRouter()

@router.post("/feedback", status_code=201)
async def submit_feedback(payload: FeedbackCreate, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        INSERT INTO feedback (id, run_id, rating, comment)
        VALUES (:id, :run_id, :rating, :comment)
    """), {"id": str(uuid4()), "run_id": str(payload.run_id),
           "rating": payload.rating, "comment": payload.comment})
    await db.commit()
    return {"status": "ok"}

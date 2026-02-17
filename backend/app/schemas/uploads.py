from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Literal


class UploadedFileOut(BaseModel):
    id: UUID
    org_id: UUID
    user_id: UUID
    original_filename: str
    file_type: str
    template_type: str
    status: Literal["pending", "validating", "processing", "complete", "error"]
    row_count: int | None = None
    error_message: str | None = None
    processed_at: datetime | None = None
    created_at: datetime

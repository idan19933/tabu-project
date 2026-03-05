from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class DocumentBrief(BaseModel):
    id: UUID
    document_type: str
    file_path: str
    upload_date: datetime
    extraction_status: str = "Pending"

    model_config = {"from_attributes": True}


class DocumentOut(DocumentBrief):
    project_id: UUID
    extraction_error: str | None = None
    extracted_data: dict | None = None
